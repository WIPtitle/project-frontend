"use client"

import { useState, useEffect } from "react"
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
import { FileVideo2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"

type RecordingsProps = {
  permissions: Permission[]
}

export default function Recordings({ permissions }: RecordingsProps) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [cameras, setCameras] = useState<{ [key: string]: RTSPCamera | null }>({})
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [showAlarmRecordings, setShowAlarmRecordings] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allRecordings = await getAllRecordings()
        const completedRecordings = allRecordings
          .filter((recording) => recording.is_completed)
          .sort((a, b) => b.name.localeCompare(a.name))
        setRecordings(completedRecordings)

        // Get unique camera IPs
        const uniqueCameraIps = Array.from(new Set(completedRecordings.map((r) => r.camera_ip)))

        // Fetch camera info only for unique IPs
        const cameraPromises = uniqueCameraIps.map(async (ip) => {
          try {
            return await getRTSPCamera(ip)
          } catch (error) {
            return null
          }
        })

        const cameraResults = await Promise.all(cameraPromises)
        const cameraMap = cameraResults.reduce(
          (acc: { [key: string]: RTSPCamera | null }, camera) => {
            if (camera) {
              acc[camera.ip] = camera
            }
            return acc
          },
          {} as { [key: string]: RTSPCamera | null },
        )
        setCameras(cameraMap)

        const storage = await getStorageInfo()
        setStorageInfo(storage)
      } catch (error) {
        console.log(error)
        setErrorMessage("Failed to fetch recordings and storage information")
      }
    }
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await deleteRecording(id)
      setRecordings(recordings.filter((recording) => recording.id !== id))
    } catch (error) {
      setErrorMessage("Failed to delete recording")
    }
  }

  const handleDeleteAll = async () => {
    try {
      await deleteAllRecordings()
      setRecordings([])
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
    // Extract date and time parts from filename (ignoring camera IP and extension)
    const [year, month, day, hour, minute, second] = filename.split("_").slice(0, 6)

    // Format as "hh:mm:ss DD/MM/YYYY"
    return `${hour}:${minute}:${second} ${day}/${month}/${year}`
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
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

      {recordings.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-zinc-300">{showAlarmRecordings ? "Other recordings" : "Alarm recordings"}</span>
          <Switch
            checked={showAlarmRecordings}
            onCheckedChange={setShowAlarmRecordings}
            className="data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:border-zinc-700"
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recordings.length === 0 ? (
          <p className="text-zinc-400 col-span-full">No recordings found.</p>
        ) : (
          recordings
            .filter((recording) =>
              showAlarmRecordings
                ? !recording.path.includes("alarm_recordings")
                : recording.path.includes("alarm_recordings"),
            )
            .map((recording) => (
              <Card key={recording.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
                <CardContent className="flex flex-col items-center justify-center pt-6">
                  <FileVideo2 size={48} className="text-zinc-400 mb-2" />
                  <p className="text-zinc-300 text-center">{formatRecordingName(recording.name)}</p>
                  <p className="text-zinc-400 text-sm mt-1">
                    Camera: {cameras[recording.camera_ip]?.name || "Unknown Camera"}
                  </p>
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

      {/* Video Streaming Dialog */}
      <Dialog open={!!selectedRecording} onOpenChange={() => setSelectedRecording(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Recording: {selectedRecording ? formatRecordingName(selectedRecording.name) : ""}</DialogTitle>
            <DialogDescription>
              Camera: {cameras[selectedRecording?.camera_ip || ""]?.name || "Unknown Camera"}
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

