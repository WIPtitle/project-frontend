'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { getAllRecordings, getCamera, deleteRecording, getStorageInfo } from "@/lib/api"
import { Recording, Camera, StorageInfo, Permission } from "@/types"
import { FileVideo2 } from "lucide-react"

type RecordingsProps = {
  permissions: Permission[]
}

export default function Recordings({ permissions }: RecordingsProps) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [cameras, setCameras] = useState<{[key: string]: Camera}>({})
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allRecordings = await getAllRecordings()
        const completedRecordings = allRecordings
          .filter(recording => recording.is_completed)
          .sort((a, b) => a.filename.localeCompare(b.filename))
        setRecordings(completedRecordings)

        const cameraPromises = completedRecordings.map(recording => getCamera(recording.camera_ip))
        const cameraResults = await Promise.all(cameraPromises)
        const cameraMap = cameraResults.reduce((acc, camera) => {
          acc[camera.ip] = camera
          return acc
        }, {} as {[key: string]: Camera})
        setCameras(cameraMap)

        const storage = await getStorageInfo()
        setStorageInfo(storage)
      } catch (error) {
        setErrorMessage("Failed to fetch recordings and storage information")
      }
    }
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await deleteRecording(id)
      setRecordings(recordings.filter(recording => recording.id !== id))
    } catch (error) {
      setErrorMessage("Failed to delete recording")
    }
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 GB'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-zinc-50">Recordings</h1>
        {storageInfo && (
          <p className="text-zinc-300">
            Space left: {formatBytes(storageInfo.free_space, 2)} / {formatBytes(storageInfo.total_space, 0)}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recordings.map((recording) => (
          <Card key={recording.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
            <CardContent className="flex flex-col items-center justify-center pt-6">
              <FileVideo2 size={48} className="text-zinc-400 mb-2" />
              <p className="text-zinc-300 text-center">{recording.filename}</p>
              <p className="text-zinc-400 text-sm mt-1">
                {cameras[recording.camera_ip]?.name || 'Unknown Camera'}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col">
              <div className="flex w-full mb-2">
                <Button
                  variant="outline"
                  className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                  onClick={() => window.open(`http://localhost/stream/${recording.id}`, '_blank')}
                >
                  Stream
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 ml-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                  onClick={() => window.open(`http://localhost/download/${recording.id}`, '_blank')}
                >
                  Download
                </Button>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full bg-red-900 hover:bg-red-800">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the recording.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(recording.id)} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent className="bg-zinc-800 text-zinc-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMessage(null)} className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}