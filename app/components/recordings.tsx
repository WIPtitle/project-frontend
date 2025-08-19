"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
  getRTSPCamera,
} from "@/lib/api"
import type { Recording, RTSPCamera, StorageInfo, Permission } from "@/types"
import { FileVideo2, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"

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
  const [showAlarmRecordings, setShowAlarmRecordings] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [currentOffset, setCurrentOffset] = useState(0)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef<HTMLDivElement | null>(null)

  const fetchRecordings = useCallback(async (type: RecordingType, offset: number) => {
    try {
      const recordings = await getAllRecordings({ offset, type })
      const completedRecordings = recordings
        .filter((recording) => recording.is_completed)
        .sort((a, b) => b.name.localeCompare(a.name))

      return completedRecordings
    } catch (error) {
      console.error(`Failed to fetch ${type} recordings:`, error)
      throw error
    }
  }, []) // Remove all dependencies

  const fetchCameraInfo = useCallback(async (recordings: Recording[]) => {
    const uniqueCameraIps = Array.from(new Set(recordings.map((r) => r.camera_ip)))

    setCameras((prevCameras) => {
      const newCameraIps = uniqueCameraIps.filter((ip) => !(ip in prevCameras))

      if (newCameraIps.length === 0) return prevCameras

      // Fetch new camera info asynchronously
      const fetchNewCameras = async () => {
        const cameraPromises = newCameraIps.map(async (ip) => {
          try {
            return await getRTSPCamera(ip)
          } catch (error) {
            return null
          }
        })

        const cameraResults = await Promise.all(cameraPromises)
        const newCameraMap = cameraResults.reduce((acc: { [key: string]: RTSPCamera | null }, camera) => {
          if (camera) {
            acc[camera.ip] = camera
          }
          return acc
        }, {})

        setCameras((currentCameras) => ({ ...currentCameras, ...newCameraMap }))
      }

      fetchNewCameras()
      return prevCameras
    })
  }, []) // Remove cameras dependency

  // Load initial data (first page)
  const loadInitialData = useCallback(async () => {
    setInitialLoading(true)
    try {
      const currentType = showAlarmRecordings ? RecordingType.ALARM : RecordingType.NORMAL

      const [initialRecordings, storage] = await Promise.all([fetchRecordings(currentType, 0), getStorageInfo()])

      setRecordings(initialRecordings)
      setStorageInfo(storage)

      // Set pagination state
      setCurrentOffset(PAGE_SIZE)
      setHasMore(initialRecordings.length === PAGE_SIZE)

      // Fetch camera info
      await fetchCameraInfo(initialRecordings)
    } catch (error) {
      console.error("Failed to load initial data:", error)
      setErrorMessage("Failed to fetch recordings and storage information")
    } finally {
      setInitialLoading(false)
    }
  }, [showAlarmRecordings]) // Only depend on showAlarmRecordings

  // Load more recordings (pagination)
  const loadMoreRecordings = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      const currentType = showAlarmRecordings ? RecordingType.ALARM : RecordingType.NORMAL
      const newRecordings = await fetchRecordings(currentType, currentOffset)

      if (newRecordings.length === 0) {
        setHasMore(false)
      } else {
        setRecordings((prev) => [...prev, ...newRecordings])
        setCurrentOffset((prev) => prev + PAGE_SIZE)
        setHasMore(newRecordings.length === PAGE_SIZE)
        await fetchCameraInfo(newRecordings)
      }
    } catch (error) {
      console.error("Failed to load more recordings:", error)
      setErrorMessage(`Failed to fetch more ${showAlarmRecordings ? "alarm" : "normal"} recordings`)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, showAlarmRecordings, currentOffset]) // Keep necessary dependencies only

  // Reset and load data when switching between alarm/normal
  useEffect(() => {
    setRecordings([])
    setCurrentOffset(0)
    setHasMore(true)
    loadInitialData()
  }, [showAlarmRecordings, loadInitialData])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !initialLoading && hasMore) {
          loadMoreRecordings()
        }
      },
      { threshold: 0.1 },
    )

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loadMoreRecordings, loading, initialLoading, hasMore])

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

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 GB"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  }

  const formatRecordingName = (filename: string) => {
    const [year, month, day, hour, minute, second] = filename.split("_").slice(0, 6)
    return `${hour}:${minute}:${second} ${day}/${month}/${year}`
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
        <span className="text-zinc-300">Normal recordings</span>
        <Switch
          checked={showAlarmRecordings}
          onCheckedChange={setShowAlarmRecordings}
          className="data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:border-zinc-700"
        />
        <span className="text-zinc-300">Alarm recordings</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recordings.length === 0 ? (
          <p className="text-zinc-400 col-span-full">No {showAlarmRecordings ? "alarm" : "normal"} recordings found.</p>
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
        <div ref={loadingRef} className="flex items-center justify-center py-8">
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
