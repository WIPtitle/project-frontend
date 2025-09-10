"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Activity } from "lucide-react"
import {
  getNtfyCredentials,
  updateNtfyCredentials,
  getAlarmAudioConfig,
  createAlarmAudioConfig,
  updateAlarmAudioConfig,
  deleteAlarmAudioConfig,
  downloadAlarmAudio,
  getHealthStatus,
} from "@/lib/api"
import { type NtfyCredentials, type AlarmAudioConfig, Permission } from "@/types"

type ConfigurationProps = {
  permissions: Permission[]
}

export default function Configuration({ permissions }: ConfigurationProps) {
  const [ntfyCredentials, setNtfyCredentials] = useState<NtfyCredentials | null>(null)
  const [alarmAudioConfig, setAlarmAudioConfig] = useState<AlarmAudioConfig | null>(null)
  const [healthStatus, setHealthStatus] = useState<Record<string, string>>({})
  const [isAudioDialogOpen, setIsAudioDialogOpen] = useState(false)
  const [editingAudioConfig, setEditingAudioConfig] = useState<AlarmAudioConfig | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)

  const canChangeNotificationsConfig = permissions.includes(Permission.UPDATE_NOTIFICATIONS_CONFIG)
  const canChangeAlarmSound = permissions.includes(Permission.CHANGE_ALARM_SOUND)

  useEffect(() => {
    const fetchConfigs = async () => {
      let ntfyError = false
      let audioError = false

      try {
        try {
          const credentials = await getNtfyCredentials()
          setNtfyCredentials(credentials)
        } catch (error) {
          ntfyError = true
          console.error("Failed to fetch Ntfy credentials:", error)
        }

        try {
          const audio = await getAlarmAudioConfig()
          setAlarmAudioConfig(audio)
        } catch (error) {
          audioError = true
          console.error("Failed to fetch audio configuration:", error)
        }

        try {
          const health = await getHealthStatus()
          setHealthStatus(health)
        } catch (error) {
          console.error("Failed to fetch health status:", error)
        }

        if (ntfyError && audioError) {
          setErrorMessage("Failed to fetch configurations")
        } else if (ntfyError) {
          setErrorMessage("Failed to fetch Ntfy configuration")
        } else if (audioError) {
          setErrorMessage("Failed to fetch audio configuration")
        }
      } finally {
        setIsLoading(false)
      }
    }
    fetchConfigs()
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const health = await getHealthStatus()
        setHealthStatus(health)
      } catch (error) {
        console.error("Failed to fetch health status:", error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleRefreshNotificationsConfig = async () => {
    try {
      const updatedCredentials = await updateNtfyCredentials()
      setNtfyCredentials(updatedCredentials)
    } catch (error) {
      setErrorMessage("Failed to refresh notifications configuration")
    }
  }

  const handleAddAudioConfig = () => {
    setEditingAudioConfig({ audio: null })
    setIsAudioDialogOpen(true)
  }

  const handleEditAudioConfig = () => {
    setEditingAudioConfig(alarmAudioConfig)
    setIsAudioDialogOpen(true)
  }

  const handleDeleteAudioConfig = async () => {
    try {
      await deleteAlarmAudioConfig()
      setAlarmAudioConfig(null)
    } catch (error) {
      setErrorMessage("Failed to delete alarm audio configuration")
    }
  }

  const handleSaveAudioConfig = async (config: AlarmAudioConfig) => {
    try {
      setUploadProgress(0)
      if (alarmAudioConfig) {
        const updatedConfig = await updateAlarmAudioConfig(config, (progress) => {
          setUploadProgress(progress)
        })
        setAlarmAudioConfig(updatedConfig)
      } else {
        const newConfig = await createAlarmAudioConfig(config, (progress) => {
          setUploadProgress(progress)
        })
        setAlarmAudioConfig(newConfig)
      }
      setIsAudioDialogOpen(false)
      setUploadProgress(null)
    } catch (error) {
      setErrorMessage("Failed to save alarm audio configuration")
      setUploadProgress(null)
    }
  }

  const handleDownloadAudioConfig = async () => {
    try {
      setDownloadProgress(0)
      await downloadAlarmAudio((progress) => {
        setDownloadProgress(progress)
      })
      setDownloadProgress(null)
    } catch (error) {
      setErrorMessage("Failed to download alarm audio file")
      setDownloadProgress(null)
    }
  }

  const handleFormSubmit = () => {
    if (editingAudioConfig) {
      handleSaveAudioConfig(editingAudioConfig)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-bold text-zinc-50">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-3xl font-bold text-zinc-50 mb-2 sm:mb-0">Configuration</h1>
      </div>

      {Object.keys(healthStatus).length > 0 && (
        <div className="mb-6 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">Server Status</span>
          </div>
          <div className="grid gap-2">
            {Object.entries(healthStatus).map(([url, status]) => (
              <div key={url} className="flex items-center justify-between">
                <span className="text-sm text-zinc-400 font-mono truncate mr-4">{url}</span>
                <span
                  className={`text-sm font-medium px-2 py-1 rounded ${
                    status === "healthy"
                      ? "bg-green-900/30 text-green-400"
                      : "bg-red-900/30 text-red-400"
                  }`}
                >
                  {status === "healthy" ? "● Healthy" : "● Unreachable"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 items-start">
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Ntfy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ntfyCredentials ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-sm font-medium text-zinc-300">
                    URL
                  </Label>
                  <Input
                    id="url"
                    value={`${window.location.protocol}//${window.location.hostname}`}
                    readOnly
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 overflow-x-auto whitespace-nowrap"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user" className="text-sm font-medium text-zinc-300">
                    User
                  </Label>
                  <Input
                    id="user"
                    value={ntfyCredentials.user}
                    readOnly
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 overflow-x-auto whitespace-nowrap"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-zinc-300">
                    Password
                  </Label>
                  <Input
                    id="password"
                    value={ntfyCredentials.password}
                    readOnly
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 overflow-x-auto whitespace-nowrap"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topic" className="text-sm font-medium text-zinc-300">
                    Topic
                  </Label>
                  <Input
                    id="topic"
                    value={ntfyCredentials.topic}
                    readOnly
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 overflow-x-auto whitespace-nowrap"
                  />
                </div>
              </>
            ) : (
              <p className="text-zinc-400">No Ntfy configuration saved</p>
            )}
          </CardContent>
          {canChangeNotificationsConfig && (
            <CardFooter>
              <Button
                variant="outline"
                className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 w-full"
                onClick={handleRefreshNotificationsConfig}
              >
                Refresh configuration
              </Button>
            </CardFooter>
          )}
        </Card>
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Alarm audio</CardTitle>
          </CardHeader>
          <CardContent>
            {alarmAudioConfig?.audio ? (
              <div className="space-y-2">
                <p className="text-zinc-300">Audio file: {alarmAudioConfig.audio.name}</p>
                {downloadProgress !== null && (
                  <Progress value={downloadProgress} className="w-full" />
                )}
              </div>
            ) : (
              <p className="text-zinc-400">No alarm audio configuration saved</p>
            )}
          </CardContent>
          {canChangeAlarmSound && (
            <CardFooter>
              {alarmAudioConfig ? (
                <div className="flex justify-between items-center w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                    onClick={handleDownloadAudioConfig}
                    disabled={downloadProgress !== null}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                      onClick={handleEditAudioConfig}
                    >
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="bg-red-900 hover:bg-red-800">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the alarm audio configuration.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAudioConfig}
                            className="bg-red-900 hover:bg-red-800  text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 w-full"
                  onClick={handleAddAudioConfig}
                >
                  Add audio
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
      </div>
      <Dialog open={isAudioDialogOpen} onOpenChange={setIsAudioDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{alarmAudioConfig ? "Edit" : "Add"} Alarm audio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".mp3"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && file.name.toLowerCase().endsWith(".mp3")) {
                  setEditingAudioConfig((prev) => (prev ? { ...prev, audio: file } : null))
                } else {
                  alert("Please select an MP3 file.")
                  e.target.value = ""
                }
              }}
              className="bg-zinc-700 text-zinc-50 border-zinc-600"
              required
            />
            {uploadProgress !== null && (
              <Progress value={uploadProgress} className="w-full" />
            )}
            <Button
              onClick={handleFormSubmit}
              className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
              disabled={!editingAudioConfig?.audio || uploadProgress !== null}
            >
              {alarmAudioConfig ? "Update" : "Create"}
            </Button>
          </div>
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