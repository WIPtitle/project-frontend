"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  getValveServer,
  getIrrigationZones,
  syncIrrigationZones,
  updateZoneName,
  getZoneStatusStream,
  getSetups,
  createSetup,
  deleteSetup,
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
} from "@/types"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// Days in each month for leap year 2000
const LEAP_YEAR_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

type IrrigationProps = {
  permissions: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function trimSeconds(time: string): string {
  // "HH:MM:SS" → "HH:MM"
  if (!time) return time
  const parts = time.split(":")
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : time
}

function formatMonthDay(mmdd: string): string {
  // "MM-DD" → "Mon Day"
  if (!mmdd) return mmdd
  const [mm, dd] = mmdd.split("-")
  const monthIndex = parseInt(mm, 10) - 1
  const monthName = MONTH_NAMES[monthIndex] ?? mm
  return `${monthName} ${parseInt(dd, 10)}`
}

// ─── YearCalendar ───────────────────────────────────────────────────────────

function YearCalendar({ dateRanges }: { dateRanges: SetupDateRange[] }) {
  // Build a Set of "MM-DD" strings that fall inside any range
  const activeDays = new Set<string>()

  for (const range of dateRanges) {
    const [startMM, startDD] = range.start_date.split("-").map(Number)
    const [endMM, endDD] = range.end_date.split("-").map(Number)

    // Iterate through all days of the leap year to find days in range
    let month = 1
    for (const daysInMonth of LEAP_YEAR_DAYS) {
      for (let day = 1; day <= daysInMonth; day++) {
        const mm = month
        const dd = day

        // Check if this day is within the range (handles wrap-around across year boundary)
        const isInRange = (() => {
          const startVal = startMM * 100 + startDD
          const endVal = endMM * 100 + endDD
          const dayVal = mm * 100 + dd

          if (startVal <= endVal) {
            // Normal range within a year
            return dayVal >= startVal && dayVal <= endVal
          } else {
            // Wrap-around range (e.g., Nov-15 to Mar-10)
            return dayVal >= startVal || dayVal <= endVal
          }
        })()

        if (isInRange) {
          const key = `${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
          activeDays.add(key)
        }
      }
      month++
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-zinc-300 mb-2">Year overview (leap year):</p>
      <div className="space-y-1">
        {LEAP_YEAR_DAYS.map((daysInMonth, monthIdx) => {
          const monthNum = monthIdx + 1
          return (
            <div key={monthIdx} className="flex items-center gap-1">
              <span className="text-xs text-zinc-400 w-7 shrink-0">{MONTH_NAMES[monthIdx]}</span>
              <div className="flex gap-[2px] flex-wrap">
                {Array.from({ length: daysInMonth }, (_, dayIdx) => {
                  const day = dayIdx + 1
                  const key = `${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const isActive = activeDays.has(key)
                  return (
                    <div
                      key={dayIdx}
                      className={`w-2 h-2 rounded-sm ${isActive ? "bg-green-500" : "bg-zinc-600"}`}
                      title={key}
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
}: {
  canModify: boolean
}) {
  const [zones, setZones] = useState<IrrigationZone[]>([])
  const [valveStatus, setValveStatus] = useState<ValveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [renameZone, setRenameZone] = useState<IrrigationZone | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    getIrrigationZones()
      .then(setZones)
      .catch((e) => console.error("Failed to load zones:", e))
      .finally(() => setLoading(false))

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
  }, [])

  const handleSync = async () => {
    setSyncError(null)
    try {
      const updated = await syncIrrigationZones()
      setZones(updated)
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : "Sync failed")
    }
  }

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
        <Button
          size="sm"
          className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
          onClick={handleSync}
        >
          Sync from Controller
        </Button>
      </div>

      {syncError && (
        <p className="text-red-400 text-sm mb-3">{syncError}</p>
      )}

      {zones.length === 0 ? (
        <p className="text-zinc-400 text-sm">No zones found. Try syncing from the controller.</p>
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
                      size="sm"
                      variant="ghost"
                      className="text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 px-2 py-1 h-auto"
                      onClick={() => handleRenameOpen(zone)}
                    >
                      Rename
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
                variant="ghost"
                className="text-zinc-300 hover:text-zinc-50 hover:bg-zinc-700"
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
}: {
  setup: IrrigationSetup
  zones: IrrigationZone[]
  canModify: boolean
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

  // Add range dialog
  const [addRangeOpen, setAddRangeOpen] = useState(false)
  const [rangeFrom, setRangeFrom] = useState("")
  const [rangeTo, setRangeTo] = useState("")
  const [rangeError, setRangeError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingSchedules(true)
    getSchedules(setup.id)
      .then(setSchedules)
      .catch((e) => console.error("Failed to load schedules:", e))
      .finally(() => setLoadingSchedules(false))

    setLoadingRanges(true)
    getDateRanges(setup.id)
      .then(setDateRanges)
      .catch((e) => console.error("Failed to load date ranges:", e))
      .finally(() => setLoadingRanges(false))
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
      setDateRanges((prev) => prev.filter((r) => r.id !== rangeId))
    } catch (e: unknown) {
      console.error("Failed to delete date range:", e)
    }
  }

  const handleAddRange = async () => {
    setRangeError(null)
    try {
      const created = await addDateRange(setup.id, rangeFrom, rangeTo)
      setDateRanges((prev) => [...prev, created])
      setAddRangeOpen(false)
      setRangeFrom("")
      setRangeTo("")
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
                setRangeFrom("")
                setRangeTo("")
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

        {/* Year Calendar */}
        <YearCalendar dateRanges={dateRanges} />
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

            <p className="text-xs text-zinc-500">Note: leave a 1-minute gap between overlapping slots on the same zone.</p>

            {slotError && <p className="text-red-400 text-sm">{slotError}</p>}

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                className="text-zinc-300 hover:text-zinc-50 hover:bg-zinc-700"
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
                <Label className="text-sm font-medium text-zinc-300">From (MM-DD)</Label>
                <Input
                  className="bg-zinc-700 text-zinc-50 border-zinc-600 mt-1"
                  placeholder="03-15"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-300">To (MM-DD)</Label>
                <Input
                  className="bg-zinc-700 text-zinc-50 border-zinc-600 mt-1"
                  placeholder="09-30"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                />
              </div>
            </div>

            {rangeError && <p className="text-red-400 text-sm">{rangeError}</p>}

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                className="text-zinc-300 hover:text-zinc-50 hover:bg-zinc-700"
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

  // Create setup dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

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
      if (selectedSetup?.id === setupId) {
        setSelectedSetup(remaining.length > 0 ? remaining[0] : null)
      }
    } catch (e: unknown) {
      console.error("Failed to delete setup:", e)
    }
  }

  if (loading) {
    return <p className="text-zinc-400 text-sm">Loading setups...</p>
  }

  return (
    <div className="space-y-4">
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

      {/* Setup tabs row */}
      {setups.length === 0 ? (
        <p className="text-zinc-400 text-sm">No setups yet. Create one to get started.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {setups.map((setup) => (
            <div key={setup.id} className="flex items-center gap-1">
              <button
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedSetup?.id === setup.id
                    ? "bg-zinc-600 text-zinc-50"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50 border border-zinc-700"
                }`}
                onClick={() => setSelectedSetup(setup)}
              >
                {setup.name}
              </button>
              {canModify && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="text-zinc-500 hover:text-red-400 text-sm px-1"
                      aria-label={`Delete setup ${setup.name}`}
                    >
                      ×
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-800 border-zinc-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-zinc-50">Delete Setup</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Are you sure you want to delete &quot;{setup.name}&quot;? This will also remove all its schedules and date ranges.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-700 text-zinc-50 border-zinc-600 hover:bg-zinc-600">
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* Setup Detail */}
      {selectedSetup && (
        <Card className="bg-zinc-800 border-zinc-700">
          <CardContent className="p-4">
            <SetupDetail setup={selectedSetup} zones={zones} canModify={canModify} />
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
                variant="ghost"
                className="text-zinc-300 hover:text-zinc-50 hover:bg-zinc-700"
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
    </div>
  )
}

// ─── IrrigationDashboard ─────────────────────────────────────────────────────

function IrrigationDashboard({ permissions }: IrrigationProps) {
  const canModify = permissions.includes("MODIFY_DEVICES")
  const [zones, setZones] = useState<IrrigationZone[]>([])

  // Load zones once so SetupsSection can reference zone names
  useEffect(() => {
    getIrrigationZones()
      .then(setZones)
      .catch((e) => console.error("Failed to load zones for dashboard:", e))
  }, [])

  return (
    <div className="p-4 space-y-8">
      <ZonesSection canModify={canModify} />
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
