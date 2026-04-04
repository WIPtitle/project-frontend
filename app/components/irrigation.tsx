"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Pencil } from "lucide-react"
import {
  getValveServer,
  syncIrrigationZones,
  getZonesMismatch,
  updateZoneName,
  getZoneStatusStream,
  getSetups,
  createSetup,
  deleteSetup,
  renameSetup,
  getSchedules,
  addSchedule,
  deleteSchedule,
  getDateRanges,
  addDateRange,
  deleteDateRange,
} from "@/lib/api"
import type {
  ValveServerConfig,
  IrrigationZone,
  IrrigationSetup,
  SetupZoneSchedule,
  SetupDateRange,
  ValveStatus,
  ZoneMismatch,
} from "@/types"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTH_FULL_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// Days in each month for leap year 2000
const LEAP_YEAR_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

type IrrigationProps = {
  permissions: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function trimSeconds(time: string): string {
  if (!time) return time
  const parts = time.split(":")
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : time
}

// dateStr is "2000-MM-DD" (or "MM-DD" fallback)
function formatMonthDay(dateStr: string): string {
  if (!dateStr) return dateStr
  const parts = dateStr.split("-")
  let month: number
  let day: number
  if (parts.length === 3) {
    // "2000-MM-DD"
    month = parseInt(parts[1], 10)
    day = parseInt(parts[2], 10)
  } else {
    // "MM-DD" legacy
    month = parseInt(parts[0], 10)
    day = parseInt(parts[1], 10)
  }
  const d = new Date(2000, month - 1, day)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ─── YearCalendar ───────────────────────────────────────────────────────────

function YearCalendar({ dateRanges }: { dateRanges: SetupDateRange[] }) {
  const isInRange = (month: number, day: number): boolean => {
    // month is 0-indexed (JS Date convention)
    const checkMonth = month + 1
    const checkDay = day
    return dateRanges.some((r) => {
      // r.start_date and r.end_date are strings like "2000-03-15"
      const [, sm, sd] = r.start_date.split("-").map(Number)
      const [, em, ed] = r.end_date.split("-").map(Number)
      const checkVal = checkMonth * 100 + checkDay
      const startVal = sm * 100 + sd
      const endVal = em * 100 + ed
      if (startVal <= endVal) {
        return checkVal >= startVal && checkVal <= endVal
      } else {
        // Wrap-around range: e.g. Nov–Mar (crosses year boundary)
        return checkVal >= startVal || checkVal <= endVal
      }
    })
  }

  return (
    <div className="w-full">
      <p className="text-sm font-medium text-zinc-300 mb-2">Year overview:</p>
      <div className="space-y-1 w-full">
        {LEAP_YEAR_DAYS.map((daysInMonth, monthIdx) => {
          return (
            <div key={monthIdx} className="flex items-center gap-1">
              <span className="text-xs text-zinc-400 w-7 shrink-0">{MONTH_NAMES[monthIdx]}</span>
              <div className="flex gap-[2px] flex-wrap flex-1">
                {Array.from({ length: daysInMonth }, (_, dayIdx) => {
                  const day = dayIdx + 1
                  const active = isInRange(monthIdx, day)
                  const mmdd = `${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  return (
                    <div
                      key={dayIdx}
                      className={`w-3 h-3 rounded-sm ${active ? "bg-green-500" : "bg-zinc-600"}`}
                      title={mmdd}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ZonesSection ───────────────────────────────────────────────────────────

function ZonesSection({
  canModify,
  onZonesLoaded,
}: {
  canModify: boolean
  onZonesLoaded: (zones: IrrigationZone[]) => void
}) {
  const [zones, setZones] = useState<IrrigationZone[]>([])
  const [valveStatus, setValveStatus] = useState<ValveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState<ZoneMismatch | null>(null)
  const [renameZone, setRenameZone] = useState<IrrigationZone | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Auto-sync on load
    syncIrrigationZones()
      .then((synced) => {
        setZones(synced)
        onZonesLoaded(synced)
      })
      .catch((e) => {
        setSyncError(e instanceof Error ? e.message : "Sync failed")
      })
      .finally(() => setLoading(false))

    // Check zone mismatch
    getZonesMismatch()
      .then(setMismatch)
      .catch(() => { /* non-critical, ignore */ })

    // SSE subscription
    const es = getZoneStatusStream()
    eventSourceRef.current = es

    es.onmessage = (evt) => {
      try {
        const data: ValveStatus = JSON.parse(evt.data)
        setValveStatus(data)
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      // EventSource will auto-reconnect; no special action needed
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRenameOpen = (zone: IrrigationZone) => {
    setRenameZone(zone)
    setRenameValue(zone.name ?? "")
    setRenameError(null)
  }

  const handleRenameSubmit = async () => {
    if (!renameZone) return
    setRenameError(null)
    try {
      const updated = await updateZoneName(renameZone.id, renameValue)
      setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)))
      setRenameZone(null)
    } catch (e: unknown) {
      setRenameError(e instanceof Error ? e.message : "Failed to rename")
    }
  }

  const isZoneOpen = (zone: IrrigationZone): boolean => {
    if (!valveStatus?.active) return false
    return valveStatus.active_zone === zone.zone_number
  }

  if (loading) {
    return <p className="text-zinc-400 text-sm">Loading zones...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-zinc-100">Zones</h2>
      </div>

      {syncError && (
        <p className="text-red-400 text-sm mb-3">{syncError}</p>
      )}

      {mismatch?.has_mismatch && !mismatch?.unreachable && (mismatch.missing_in_controller?.length ?? 0) > 0 && (
        <p className="text-amber-400 text-sm mb-3">
          Warning: zone(s) {mismatch.missing_in_controller?.join(", ")} are configured but not found in the valve controller. Their schedules will be skipped.
        </p>
      )}

      {zones.length === 0 ? (
        <p className="text-zinc-400 text-sm">No zones found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {zones.map((zone) => {
            const open = isZoneOpen(zone)
            return (
              <Card
                key={zone.id}
                className={open ? "bg-green-950 border-green-700" : "bg-zinc-800 border-zinc-700"}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${open ? "bg-green-400" : "bg-zinc-500"}`}
                    />
                    <span className="text-zinc-50 font-medium text-sm truncate">
                      {zone.name || `Zone ${zone.zone_number}`}
                    </span>
                  </div>
                  <p className={`text-xs font-semibold ${open ? "text-green-400" : "text-zinc-400"}`}>
                    {open ? "OPEN" : "CLOSED"}
                  </p>
                  {canModify && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                      onClick={() => handleRenameOpen(zone)}
                      aria-label="Rename zone"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={!!renameZone} onOpenChange={(open) => { if (!open) setRenameZone(null) }}>
        <DialogContent className="bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Rename Zone</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-zinc-300">Zone Name</Label>
              <Input
                className="bg-zinc-700 text-zinc-50 border-zinc-600 mt-1"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit() }}
              />
            </div>
            {renameError && <p className="text-red-400 text-sm">{renameError}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                className="bg-zinc-700 border border-zinc-600 text-zinc-50 hover:bg-zinc-600"
                onClick={() => setRenameZone(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                onClick={handleRenameSubmit}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── SetupDetail ─────────────────────────────────────────────────────────────

function SetupDetail({
  setup,
  zones,
  canModify,
  onDateRangesChange,
}: {
  setup: IrrigationSetup
  zones: IrrigationZone[]
  canModify: boolean
  onDateRangesChange: (ranges: SetupDateRange[]) => void
}) {
  const [schedules, setSchedules] = useState<SetupZoneSchedule[]>([])
  const [dateRanges, setDateRanges] = useState<SetupDateRange[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [loadingRanges, setLoadingRanges] = useState(true)

  // Add slot dialog
  const [addSlotOpen, setAddSlotOpen] = useState(false)
  const [slotZoneId, setSlotZoneId] = useState<number>(zones[0]?.id ?? 0)
  const [slotDay, setSlotDay] = useState<number>(0)
  const [slotStart, setSlotStart] = useState("06:00")
  const [slotEnd, setSlotEnd] = useState("06:30")
  const [slotError, setSlotError] = useState<string | null>(null)

  // Add range dialog — using day+month selects
  const [addRangeOpen, setAddRangeOpen] = useState(false)
  const [rangeStartDay, setRangeStartDay] = useState("01")
  const [rangeStartMonth, setRangeStartMonth] = useState("01")
  const [rangeEndDay, setRangeEndDay] = useState("31")
  const [rangeEndMonth, setRangeEndMonth] = useState("12")
  const [rangeError, setRangeError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingSchedules(true)
    getSchedules(setup.id)
      .then(setSchedules)
      .catch((e) => console.error("Failed to load schedules:", e))
      .finally(() => setLoadingSchedules(false))

    setLoadingRanges(true)
    getDateRanges(setup.id)
      .then((ranges) => {
        setDateRanges(ranges)
        onDateRangesChange(ranges)
      })
      .catch((e) => console.error("Failed to load date ranges:", e))
      .finally(() => setLoadingRanges(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.id])

  const zoneName = (zoneId: number) => {
    const z = zones.find((z) => z.id === zoneId)
    return z ? (z.name || `Zone ${z.zone_number}`) : `Zone ${zoneId}`
  }

  const handleDeleteSchedule = async (scheduleId: number) => {
    try {
      await deleteSchedule(setup.id, scheduleId)
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
    } catch (e: unknown) {
      console.error("Failed to delete schedule:", e)
    }
  }

  const handleAddSlot = async () => {
    setSlotError(null)
    try {
      const created = await addSchedule(setup.id, slotZoneId, slotDay, slotStart, slotEnd)
      setSchedules((prev) => [...prev, created])
      setAddSlotOpen(false)
    } catch (e: unknown) {
      setSlotError(e instanceof Error ? e.message : "Failed to add slot")
    }
  }

  const handleDeleteRange = async (rangeId: number) => {
    try {
      await deleteDateRange(setup.id, rangeId)
      const updated = dateRanges.filter((r) => r.id !== rangeId)
      setDateRanges(updated)
      onDateRangesChange(updated)
    } catch (e: unknown) {
      console.error("Failed to delete date range:", e)
    }
  }

  const handleAddRange = async () => {
    setRangeError(null)
    // Build MM-DD strings for the API
    const startMmDd = `${rangeStartMonth}-${rangeStartDay.padStart(2, "0")}`
    const endMmDd = `${rangeEndMonth}-${rangeEndDay.padStart(2, "0")}`
    try {
      const created = await addDateRange(setup.id, startMmDd, endMmDd)
      const updated = [...dateRanges, created]
      setDateRanges(updated)
      onDateRangesChange(updated)
      setAddRangeOpen(false)
    } catch (e: unknown) {
      setRangeError(e instanceof Error ? e.message : "Failed to add range")
    }
  }

  // Group schedules by day_of_week (0=Monday … 6=Sunday)
  const schedulesByDay: Record<number, SetupZoneSchedule[]> = {}
  for (let d = 0; d < 7; d++) schedulesByDay[d] = []
  for (const s of schedules) {
    const d = s.day_of_week
    if (d >= 0 && d <= 6) schedulesByDay[d].push(s)
  }

  return (
    <div className="space-y-6">
      {/* Schedules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-zinc-100">Schedules</h3>
          {canModify && (
            <Button
              size="sm"
              className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
              onClick={() => {
                setSlotError(null)
                setSlotZoneId(zones[0]?.id ?? 0)
                setSlotDay(0)
                setSlotStart("06:00")
                setSlotEnd("06:30")
                setAddSlotOpen(true)
              }}
            >
              Add Slot
            </Button>
          )}
        </div>

        {loadingSchedules ? (
          <p className="text-zinc-400 text-sm">Loading schedules...</p>
        ) : (
          <div className="space-y-2">
            {DAYS.map((dayName, dayIdx) => {
              const daySlots = schedulesByDay[dayIdx]
              return (
                <div key={dayIdx} className="flex items-start gap-3">
                  <span className="text-xs text-zinc-400 w-20 shrink-0 pt-1">{dayName}</span>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.length === 0 ? (
                      <span className="text-xs text-zinc-600 italic">—</span>
                    ) : (
                      daySlots.map((slot) => (
                        <span
                          key={slot.id}
                          className="inline-flex items-center gap-1 bg-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                        >
                          {zoneName(slot.zone_id)} {trimSeconds(slot.start_time)}–{trimSeconds(slot.end_time)}
                          {canModify && (
                            <button
                              className="ml-1 text-zinc-400 hover:text-red-400"
                              onClick={() => handleDeleteSchedule(slot.id)}
                              aria-label="Delete schedule slot"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Date Ranges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-zinc-100">Date Ranges</h3>
          {canModify && (
            <Button
              size="sm"
              className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
              onClick={() => {
                setRangeError(null)
                setRangeStartDay("01")
                setRangeStartMonth("01")
                setRangeEndDay("31")
                setRangeEndMonth("12")
                setAddRangeOpen(true)
              }}
            >
              Add Range
            </Button>
          )}
        </div>

        {loadingRanges ? (
          <p className="text-zinc-400 text-sm">Loading date ranges...</p>
        ) : dateRanges.length === 0 ? (
          <p className="text-zinc-500 text-xs italic">No date ranges configured.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dateRanges.map((range) => (
              <span
                key={range.id}
                className="inline-flex items-center gap-1 bg-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
              >
                {formatMonthDay(range.start_date)} – {formatMonthDay(range.end_date)}
                {canModify && (
                  <button
                    className="ml-1 text-zinc-400 hover:text-red-400"
                    onClick={() => handleDeleteRange(range.id)}
                    aria-label="Delete date range"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add Slot Dialog */}
      <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
        <DialogContent className="bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Add Schedule Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-zinc-300">Zone</Label>
              <select
                className="mt-1 w-full bg-zinc-700 text-zinc-50 border border-zinc-600 rounded-md px-3 py-2 text-sm"
                value={slotZoneId}
                onChange={(e) => setSlotZoneId(Number(e.target.value))}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name || `Zone ${z.zone_number}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium text-zinc-300">Day of Week</Label>
              <select
                className="mt-1 w-full bg-zinc-700 text-zinc-50 border border-zinc-600 rounded-md px-3 py-2 text-sm"
                value={slotDay}
                onChange={(e) => setSlotDay(Number(e.target.value))}
              >
                {DAYS.map((day, idx) => (
                  <option key={idx} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-zinc-300">Start Time</Label>
                <Input
                  type="time"
                  className="bg-zinc-700 text-zinc-50 border-zinc-600 mt-1"
                  value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-300">End Time</Label>
                <Input
                  type="time"
                  className="bg-zinc-700 text-zinc-50 border-zinc-600 mt-1"
                  value={slotEnd}
                  onChange={(e) => setSlotEnd(e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              Note: a 1-minute gap is required between any two slots on the same day, across all zones (only one valve can be open at a time).
            </p>

            {slotError && <p className="text-red-400 text-sm">{slotError}</p>}

            <div className="flex gap-2 justify-end">
              <Button
                className="bg-zinc-700 border border-zinc-600 text-zinc-50 hover:bg-zinc-600"
                onClick={() => setAddSlotOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleAddSlot}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Range Dialog */}
      <Dialog open={addRangeOpen} onOpenChange={setAddRangeOpen}>
        <DialogContent className="bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Add Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-zinc-300">From</Label>
                <div className="flex gap-1 mt-1">
                  <select
                    className="w-16 bg-zinc-700 text-zinc-50 border border-zinc-600 rounded-md px-2 py-2 text-sm"
                    value={rangeStartDay}
                    onChange={(e) => setRangeStartDay(e.target.value)}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d).padStart(2, "0")}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    className="flex-1 bg-zinc-700 text-zinc-50 border border-zinc-600 rounded-md px-2 py-2 text-sm"
                    value={rangeStartMonth}
                    onChange={(e) => setRangeStartMonth(e.target.value)}
                  >
                    {MONTH_FULL_NAMES.map((name, idx) => (
                      <option key={idx} value={String(idx + 1).padStart(2, "0")}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-300">To</Label>
                <div className="flex gap-1 mt-1">
                  <select
                    className="w-16 bg-zinc-700 text-zinc-50 border border-zinc-600 rounded-md px-2 py-2 text-sm"
                    value={rangeEndDay}
                    onChange={(e) => setRangeEndDay(e.target.value)}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d).padStart(2, "0")}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    className="flex-1 bg-zinc-700 text-zinc-50 border border-zinc-600 rounded-md px-2 py-2 text-sm"
                    value={rangeEndMonth}
                    onChange={(e) => setRangeEndMonth(e.target.value)}
                  >
                    {MONTH_FULL_NAMES.map((name, idx) => (
                      <option key={idx} value={String(idx + 1).padStart(2, "0")}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {rangeError && <p className="text-red-400 text-sm">{rangeError}</p>}

            <div className="flex gap-2 justify-end">
              <Button
                className="bg-zinc-700 border border-zinc-600 text-zinc-50 hover:bg-zinc-600"
                onClick={() => setAddRangeOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleAddRange}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── SetupsSection ───────────────────────────────────────────────────────────

function SetupsSection({
  zones,
  canModify,
}: {
  zones: IrrigationZone[]
  canModify: boolean
}) {
  const [setups, setSetups] = useState<IrrigationSetup[]>([])
  const [selectedSetup, setSelectedSetup] = useState<IrrigationSetup | null>(null)
  const [loading, setLoading] = useState(true)
  // All date ranges from all setups, keyed by setupId
  const [allDateRanges, setAllDateRanges] = useState<Record<number, SetupDateRange[]>>({})

  // Create setup dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  // Rename setup dialog
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<IrrigationSetup | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)

  useEffect(() => {
    getSetups()
      .then((data) => {
        setSetups(data)
        if (data.length > 0) setSelectedSetup(data[0])
      })
      .catch((e) => console.error("Failed to load setups:", e))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    setCreateError(null)
    try {
      const created = await createSetup(createName)
      setSetups((prev) => [...prev, created])
      setSelectedSetup(created)
      setCreateOpen(false)
      setCreateName("")
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create setup")
    }
  }

  const handleDelete = async (setupId: number) => {
    try {
      await deleteSetup(setupId)
      const remaining = setups.filter((s) => s.id !== setupId)
      setSetups(remaining)
      setAllDateRanges((prev) => {
        const next = { ...prev }
        delete next[setupId]
        return next
      })
      if (selectedSetup?.id === setupId) {
        setSelectedSetup(remaining.length > 0 ? remaining[0] : null)
      }
    } catch (e: unknown) {
      console.error("Failed to delete setup:", e)
    }
  }

  const handleRenameOpen = (setup: IrrigationSetup) => {
    setRenameTarget(setup)
    setRenameValue(setup.name)
    setRenameError(null)
    setRenameOpen(true)
  }

  const handleRenameSubmit = async () => {
    if (!renameTarget) return
    setRenameError(null)
    try {
      const updated = await renameSetup(renameTarget.id, renameValue)
      setSetups((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      if (selectedSetup?.id === updated.id) setSelectedSetup(updated)
      setRenameOpen(false)
      setRenameTarget(null)
    } catch (e: unknown) {
      setRenameError(e instanceof Error ? e.message : "Failed to rename")
    }
  }

  const handleDateRangesChange = (setupId: number, ranges: SetupDateRange[]) => {
    setAllDateRanges((prev) => ({ ...prev, [setupId]: ranges }))
  }

  // Combine all date ranges from all setups for the calendar
  const combinedDateRanges: SetupDateRange[] = Object.values(allDateRanges).flat()

  if (loading) {
    return <p className="text-zinc-400 text-sm">Loading setups...</p>
  }

  return (
    <div className="space-y-4">
      {/* Shared Year Calendar — shows all setups' ranges combined */}
      <Card className="bg-zinc-800 border-zinc-700">
        <CardContent className="p-4">
          <YearCalendar dateRanges={combinedDateRanges} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Setups</h2>
        {canModify && (
          <Button
            size="sm"
            className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => {
              setCreateError(null)
              setCreateName("")
              setCreateOpen(true)
            }}
          >
            New Setup
          </Button>
        )}
      </div>

      {/* Setup Cards grid */}
      {setups.length === 0 ? (
        <p className="text-zinc-400 text-sm">No setups yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {setups.map((setup) => {
            const isSelected = selectedSetup?.id === setup.id
            return (
              <Card
                key={setup.id}
                className={`bg-zinc-800 cursor-pointer transition-colors ${
                  isSelected ? "border-zinc-500" : "border-zinc-700 hover:border-zinc-600"
                }`}
                onClick={() => setSelectedSetup(setup)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-zinc-50 text-sm font-medium">{setup.name}</CardTitle>
                </CardHeader>
                {canModify && (
                  <CardFooter className="pt-0 flex gap-2 justify-between">
                    <Button
                      size="sm"
                      className="bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRenameOpen(setup)
                      }}
                    >
                      Rename
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          className="bg-red-900 hover:bg-red-800 text-zinc-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 border-zinc-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-zinc-50">Delete Setup</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            Are you sure you want to delete &quot;{setup.name}&quot;? This will also remove all its schedules and date ranges.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 border border-zinc-600 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-900 hover:bg-red-800 text-zinc-50"
                            onClick={() => handleDelete(setup.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Setup Detail */}
      {selectedSetup && (
        <Card className="bg-zinc-800 border-zinc-700">
          <CardContent className="p-4">
            <SetupDetail
              setup={selectedSetup}
              zones={zones}
              canModify={canModify}
              onDateRangesChange={(ranges) => handleDateRangesChange(selectedSetup.id, ranges)}
            />
          </CardContent>
        </Card>
      )}

      {/* Create Setup Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">New Setup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-zinc-300">Setup Name</Label>
              <Input
                className="bg-zinc-700 text-zinc-50 border-zinc-600 mt-1"
                placeholder="e.g. Summer Schedule"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
              />
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                className="bg-zinc-700 border border-zinc-600 text-zinc-50 hover:bg-zinc-600"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Setup Dialog */}
      <Dialog open={renameOpen} onOpenChange={(open) => { if (!open) setRenameOpen(false) }}>
        <DialogContent className="bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Rename Setup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-zinc-300">Setup Name</Label>
              <Input
                className="bg-zinc-700 text-zinc-50 border-zinc-600 mt-1"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit() }}
              />
            </div>
            {renameError && <p className="text-red-400 text-sm">{renameError}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                className="bg-zinc-700 border border-zinc-600 text-zinc-50 hover:bg-zinc-600"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleRenameSubmit}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── IrrigationDashboard ─────────────────────────────────────────────────────

function IrrigationDashboard({ permissions }: IrrigationProps) {
  const canModify = permissions.includes("MODIFY_DEVICES")
  const [zones, setZones] = useState<IrrigationZone[]>([])

  return (
    <div className="p-4 space-y-8">
      <ZonesSection canModify={canModify} onZonesLoaded={setZones} />
      <SetupsSection zones={zones} canModify={canModify} />
    </div>
  )
}

// ─── Irrigation (main export) ────────────────────────────────────────────────

export default function Irrigation({ permissions }: IrrigationProps) {
  const [valveServer, setValveServer] = useState<ValveServerConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getValveServer()
      .then(setValveServer)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-zinc-400 p-4">Loading irrigation settings...</div>
  }

  if (!valveServer?.configured) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">No valve controller server configured. Go to Configuration to add one.</p>
      </div>
    )
  }

  return <IrrigationDashboard permissions={permissions} />
}
