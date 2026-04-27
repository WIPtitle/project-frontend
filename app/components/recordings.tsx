"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
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
  getAllRecordings,
  deleteRecording,
  deleteAllRecordings,
  getStorageInfo,
  getRecordingStreamUrl,
  getRecordingDownloadUrl,
  getAllRtspCameras,
} from "@/lib/api"
import type { Recording, RTSPCamera, StorageInfo, Permission } from "@/types"
import { FileVideo2, Loader2, Filter } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"

export enum RecordingType {
  ALARM = "ALARM",
  NORMAL = "NORMAL",
}

type RecordingsProps = {
  permissions: Permission[]
}

const PAGE_SIZE = 20


export default function Recordings({ permissions }: RecordingsProps) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [cameras, setCameras] = useState<{ [key: string]: RTSPCamera | null }>({})
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [showAlarmRecordings, setShowAlarmRecordings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [currentOffset, setCurrentOffset] = useState(0)

  // Filter modal state
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [tempShowAlarmRecordings, setTempShowAlarmRecordings] = useState(false)
  const [selectedCameraIp, setSelectedCameraIp] = useState<string | null>(null)
  const [tempSelectedCameraIp, setTempSelectedCameraIp] = useState<string | null>(null)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreCallbackRef = useRef<() => void>(() => {})
  const loadingNodeRef = useRef<HTMLDivElement | null>(null)

  // Callback ref that handles observer attachment
  const setLoadingRef = useCallback((node: HTMLDivElement | null) => {
    console.log("[Recordings] setLoadingRef called with node:", node ? "element" : "null")
    // Disconnect from previous node
    if (loadingNodeRef.current && observerRef.current) {
      console.log("[Recordings] Unobserving previous node")
      observerRef.current.unobserve(loadingNodeRef.current)
    }

    loadingNodeRef.current = node

    // Observe new node
    if (node && observerRef.current) {
      console.log("[Recordings] Observing new node")
      observerRef.current.observe(node)
    } else if (node && !observerRef.current) {
      console.log("[Recordings] WARNING: Node exists but observer is null!")
    }
  }, [])

  const fetchRecordings = useCallback(async (type: RecordingType, offset: number, cameraIp: string | null) => {
    console.log(`[Recordings] Fetching ${type} recordings with offset ${offset}, camera_ip=${cameraIp}`)
    try {
      const params: { offset: number; type: RecordingType; camera_ip?: string } = { offset, type }
      if (cameraIp) {
        params.camera_ip = cameraIp
      }
      const recordings = await getAllRecordings(params)
      const apiCount = recordings.length
      console.log(`[Recordings] Got ${apiCount} recordings from API`)
      const completedRecordings = recordings
        .filter((recording) => recording.is_completed)
        .sort((a, b) => b.name.localeCompare(a.name))

      console.log(`[Recordings] After filtering completed: ${completedRecordings.length} recordings`)
      return { recordings: completedRecordings, apiCount }
    } catch (error) {
      console.error(`[Recordings] Failed to fetch ${type} recordings:`, error)
      throw error
    }
  }, [])

  // Get cameras relevant to the current recording type
  const relevantCameras = useMemo(() => {
    const cameraList = Object.values(cameras).filter((c): c is RTSPCamera => c !== null)
    if (showAlarmRecordings) {
      return cameraList.filter((c) => !c.always_recording)
    } else {
      return cameraList.filter((c) => c.always_recording)
    }
  }, [cameras, showAlarmRecordings])

  // Track if cameras have been loaded
  const camerasLoadedRef = useRef(false)

  // Load all cameras on mount
  useEffect(() => {
    if (camerasLoadedRef.current) return
    camerasLoadedRef.current = true

    const loadCameras = async () => {
      console.log("[Recordings] Loading all cameras...")
      try {
        const allCameras = await getAllRtspCameras()
        console.log(`[Recordings] Got ${allCameras.length} cameras`)
        const cameraMap: { [key: string]: RTSPCamera } = {}
        allCameras.forEach((camera) => {
          cameraMap[camera.ip] = camera
        })
        setCameras(cameraMap)
      } catch (error) {
        console.error("[Recordings] Failed to load cameras:", error)
      }
    }

    loadCameras()
  }, [])

  // Load initial data (first page of recordings)
  const loadInitialData = useCallback(async () => {
    console.log("[Recordings] loadInitialData called, showAlarmRecordings:", showAlarmRecordings, "cameraIp:", selectedCameraIp)
    setInitialLoading(true)
    try {
      const currentType = showAlarmRecordings ? RecordingType.ALARM : RecordingType.NORMAL

      const [result, storage] = await Promise.all([fetchRecordings(currentType, 0, selectedCameraIp), getStorageInfo()])

      setRecordings(result.recordings)
      setStorageInfo(storage)

      setCurrentOffset(PAGE_SIZE)
      const hasMoreData = result.apiCount === PAGE_SIZE
      setHasMore(hasMoreData)
      console.log(`[Recordings] Initial load complete. ${result.recordings.length} recordings (${result.apiCount} from API), hasMore: ${hasMoreData}`)
    } catch (error) {
      console.error("[Recordings] Failed to load initial data:", error)
      setErrorMessage("Failed to fetch recordings and storage information")
    } finally {
      setInitialLoading(false)
    }
  }, [showAlarmRecordings, selectedCameraIp, fetchRecordings])

  // Load more recordings (pagination)
  const loadMoreRecordings = useCallback(async () => {
    console.log(`[Recordings] loadMoreRecordings called. loading: ${loading}, hasMore: ${hasMore}, offset: ${currentOffset}`)
    if (loading || !hasMore) {
      console.log("[Recordings] Skipping loadMore - already loading or no more data")
      return
    }

    setLoading(true)
    try {
      const currentType = showAlarmRecordings ? RecordingType.ALARM : RecordingType.NORMAL
      const result = await fetchRecordings(currentType, currentOffset, selectedCameraIp)

      if (result.apiCount === 0) {
        console.log("[Recordings] No more recordings, setting hasMore=false")
        setHasMore(false)
      } else {
        setRecordings((prev) => [...prev, ...result.recordings])
        setCurrentOffset((prev) => prev + PAGE_SIZE)
        const hasMoreData = result.apiCount === PAGE_SIZE
        setHasMore(hasMoreData)
        console.log(`[Recordings] Loaded ${result.recordings.length} recordings (${result.apiCount} from API), hasMore: ${hasMoreData}`)
      }
    } catch (error) {
      console.error("[Recordings] Failed to load more recordings:", error)
      setErrorMessage(`Failed to fetch more ${showAlarmRecordings ? "alarm" : "normal"} recordings`)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, showAlarmRecordings, currentOffset, selectedCameraIp, fetchRecordings])

  // Reset and reload when filter changes (type or camera)
  useEffect(() => {
    setRecordings([])
    setCurrentOffset(0)
    setHasMore(true)
    loadInitialData()
  }, [showAlarmRecordings, selectedCameraIp, loadInitialData])

  // Keep loadMoreCallbackRef in sync with latest loadMoreRecordings
  useEffect(() => {
    loadMoreCallbackRef.current = () => {
      console.log(`[Recordings] Callback ref triggered. loading: ${loading}, initialLoading: ${initialLoading}, hasMore: ${hasMore}`)
      if (!loading && !initialLoading && hasMore) {
        console.log("[Recordings] Calling loadMoreRecordings from callback ref")
        loadMoreRecordings()
      } else {
        console.log("[Recordings] Skipping loadMoreRecordings from callback ref")
      }
    }
  }, [loadMoreRecordings, loading, initialLoading, hasMore])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    console.log("[Recordings] Setting up IntersectionObserver")
    const observer = new IntersectionObserver(
      (entries) => {
        console.log("[Recordings] IntersectionObserver callback, isIntersecting:", entries[0].isIntersecting)
        if (entries[0].isIntersecting) {
          loadMoreCallbackRef.current()
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    )
    observerRef.current = observer

    // If we already have a node (from callback ref), start observing
    if (loadingNodeRef.current) {
      console.log("[Recordings] Node already exists, observing it")
      observer.observe(loadingNodeRef.current)
    } else {
      console.log("[Recordings] No node yet when observer created")
    }

    return () => {
      console.log("[Recordings] Cleaning up IntersectionObserver")
      observer.disconnect()
    }
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await deleteRecording(id)
      setRecordings((prev) => prev.filter((recording) => recording.id !== id))
    } catch (error) {
      setErrorMessage("Failed to delete recording")
    }
  }

  const handleDeleteAll = async () => {
    try {
      await deleteAllRecordings()
      setRecordings([])
      setCurrentOffset(0)
      setHasMore(true)
    } catch (error) {
      setErrorMessage("Failed to delete all recordings")
    }
  }

  const openFilterModal = () => {
    setTempShowAlarmRecordings(showAlarmRecordings)
    setTempSelectedCameraIp(selectedCameraIp)
    setFilterModalOpen(true)
  }

  const handleApplyFilters = () => {
    setSelectedCameraIp(tempSelectedCameraIp)
    setShowAlarmRecordings(tempShowAlarmRecordings)
    setFilterModalOpen(false)
  }

  const handleSelectCamera = (cameraIp: string | null) => {
    setTempSelectedCameraIp(cameraIp)
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 GB"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  }

  const formatRecordingName = (filename: string) => {
    try {
      const [year, month, day, hour, minute, second] = filename.split("_").slice(0, 6)
      // Filename timestamps are UTC — convert to local time for display
      const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second))
      return date.toLocaleString(undefined, {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    } catch {
      return filename
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <span className="ml-2 text-zinc-400">Loading recordings...</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-3xl font-bold text-zinc-50 mb-2 sm:mb-0">Recordings</h1>
        {storageInfo && (
          <p className="text-zinc-300">
            Disk usage: {formatBytes(storageInfo.used, 2)} / {formatBytes(storageInfo.total, 0)}
          </p>
        )}
      </div>

      {recordings.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full max-w-md mx-auto mb-4 block bg-red-900 hover:bg-red-800">
              Delete All Recordings
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-zinc-800 text-zinc-50">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all recordings?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all recordings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAll} className="bg-red-900 hover:bg-red-800 text-white">
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="flex items-center justify-center gap-2 mb-4">
        <Button
          variant="outline"
          onClick={openFilterModal}
          className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 border-zinc-600"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {selectedCameraIp && (
            <span className="ml-2 text-xs bg-zinc-500 px-1.5 py-0.5 rounded">
              {cameras[selectedCameraIp]?.name || selectedCameraIp}
            </span>
          )}
        </Button>
        <span className="text-zinc-400 text-sm">
          Showing {showAlarmRecordings ? "alarm" : "normal"} recordings
          {selectedCameraIp && ` — ${cameras[selectedCameraIp]?.name || selectedCameraIp}`}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recordings.length === 0 ? (
          <p className="text-zinc-400 col-span-full">
            No {showAlarmRecordings ? "alarm" : "normal"} recordings found
            {selectedCameraIp ? ` for ${cameras[selectedCameraIp]?.name || selectedCameraIp}` : ""}.
          </p>
        ) : (
          recordings.map((recording) => (
            <Card key={recording.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardContent className="flex flex-col items-center justify-center pt-6">
                <FileVideo2 size={48} className="text-zinc-400 mb-2" />
                <p className="text-zinc-300 text-center">{formatRecordingName(recording.name)}</p>
                <p className="text-zinc-400 text-sm mt-1">
                  Camera: {cameras[recording.camera_ip]?.name || "Unknown Camera"}
                </p>
                <p className="text-zinc-500 text-xs mt-1">Type: {recording.type}</p>
              </CardContent>
              <CardFooter className="flex flex-col">
                <div className="flex w-full mb-2">
                  <Button
                    variant="outline"
                    className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                    onClick={() => setSelectedRecording(recording)}
                  >
                    Stream
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 ml-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                    onClick={() => window.open(getRecordingDownloadUrl(recording.id), "_blank")}
                  >
                    Download
                  </Button>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full bg-red-900 hover:bg-red-800">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the recording.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(recording.id)}
                        className="bg-red-900 hover:bg-red-800 text-white"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Loading indicator and intersection observer target */}
      {hasMore && recordings.length > 0 && (
        <div ref={setLoadingRef} className="flex items-center justify-center py-8">
          {loading && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              <span className="ml-2 text-zinc-400">Loading more recordings...</span>
            </>
          )}
        </div>
      )}

      {/* Video Streaming Dialog */}
      <Dialog open={!!selectedRecording} onOpenChange={() => setSelectedRecording(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Recording: {selectedRecording ? formatRecordingName(selectedRecording.name) : ""}</DialogTitle>
            <DialogDescription>
              Camera: {cameras[selectedRecording?.camera_ip || ""]?.name || "Unknown Camera"} | Type:{" "}
              {selectedRecording?.type}
            </DialogDescription>
          </DialogHeader>

          {selectedRecording && (
            <div className="flex-grow overflow-hidden">
              <video
                controls
                autoPlay
                className="w-full h-full object-contain"
                src={getRecordingStreamUrl(selectedRecording.id)}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Filter Modal */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Filter Recordings</DialogTitle>
            <DialogDescription>
              Filter recordings by type and camera
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Recording Type Toggle */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Recording Type</Label>
              <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
                <span className={`text-sm ${!tempShowAlarmRecordings ? "text-zinc-50" : "text-zinc-400"}`}>
                  Normal
                </span>
                <Switch
                  checked={tempShowAlarmRecordings}
                  onCheckedChange={setTempShowAlarmRecordings}
                  className="data-[state=unchecked]:bg-zinc-700 data-[state=checked]:bg-red-600"
                />
                <span className={`text-sm ${tempShowAlarmRecordings ? "text-zinc-50" : "text-zinc-400"}`}>
                  Alarm
                </span>
              </div>
            </div>

            {/* Camera Filter */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Camera</Label>
              <ScrollArea className="h-48 rounded-lg border border-zinc-700 bg-zinc-900">
                <div className="p-3 space-y-2">
                  {/* All cameras option */}
                  <div
                    className={`flex items-center space-x-3 p-2 rounded cursor-pointer ${tempSelectedCameraIp === null ? "bg-zinc-700" : "hover:bg-zinc-800"}`}
                    onClick={() => handleSelectCamera(null)}
                  >
                    <Checkbox
                      id="camera-all"
                      checked={tempSelectedCameraIp === null}
                      onCheckedChange={() => handleSelectCamera(null)}
                      className="border-zinc-600 data-[state=checked]:bg-zinc-600 data-[state=checked]:border-zinc-600"
                    />
                    <Label htmlFor="camera-all" className="text-sm text-zinc-300 cursor-pointer flex-1">
                      All cameras
                    </Label>
                  </div>
                  {/* Individual cameras based on recording type */}
                  {Object.values(cameras)
                    .filter((c): c is RTSPCamera => c !== null)
                    .filter((c) => tempShowAlarmRecordings ? !c.always_recording : c.always_recording)
                    .sort((a, b) => a.ip.localeCompare(b.ip))
                    .map((camera) => (
                      <div
                        key={camera.ip}
                        className={`flex items-center space-x-3 p-2 rounded cursor-pointer ${tempSelectedCameraIp === camera.ip ? "bg-zinc-700" : "hover:bg-zinc-800"}`}
                        onClick={() => handleSelectCamera(camera.ip)}
                      >
                        <Checkbox
                          id={`camera-${camera.ip}`}
                          checked={tempSelectedCameraIp === camera.ip}
                          onCheckedChange={() => handleSelectCamera(camera.ip)}
                          className="border-zinc-600 data-[state=checked]:bg-zinc-600 data-[state=checked]:border-zinc-600"
                        />
                        <Label
                          htmlFor={`camera-${camera.ip}`}
                          className="text-sm text-zinc-300 cursor-pointer flex-1"
                        >
                          {camera.name || camera.ip}
                        </Label>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFilterModalOpen(false)}
              className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 border-zinc-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyFilters}
              className="bg-zinc-600 text-zinc-50 hover:bg-zinc-500"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent className="bg-zinc-800 text-zinc-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setErrorMessage(null)}
              className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
