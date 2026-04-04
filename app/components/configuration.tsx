"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Activity, Trash2, Plus, Save } from "lucide-react"
import {
  getNtfyCredentials,
  updateNtfyCredentials,
  getAlarmAudioConfig,
  createAlarmAudioConfig,
  updateAlarmAudioConfig,
  deleteAlarmAudioConfig,
  downloadAlarmAudio,
  getWarningAudioConfig,
  createWarningAudioConfig,
  updateWarningAudioConfig,
  deleteWarningAudioConfig,
  downloadWarningAudio,
  getHealthStatus,
  getSystemConfig,
  updateSystemConfig,
  getGpioServers,
  createGpioServer,
  deleteGpioServer,
  getMp3Servers,
  createMp3Server,
  updateMp3Server,
  deleteMp3Server,
  getValveServer,
  setValveServer as saveValveServerApi,
  deleteValveServer,
  getFirebaseStatus,
  setFirebaseCredentials,
  deleteFirebaseCredentials,
} from "@/lib/api"
import {
  type NtfyCredentials,
  type FirebaseStatus,
  type AlarmAudioConfig,
  type WarningAudioConfig,
  type SystemConfig,
  type GpioServerConfig,
  type Mp3ServerConfig,
  type ValveServerConfig,
  Permission,
} from "@/types"

const VALVE_TIMEZONES = [
  "UTC",
  "Europe/Rome",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Bucharest",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
]

type ConfigurationProps = {
  permissions: Permission[]
}


export default function Configuration({ permissions }: ConfigurationProps) {
  const [ntfyCredentials, setNtfyCredentials] = useState<NtfyCredentials | null>(null)
  const [alarmAudioConfig, setAlarmAudioConfig] = useState<AlarmAudioConfig | null>(null)
  const [warningAudioConfig, setWarningAudioConfig] = useState<WarningAudioConfig | null>(null)
  const [healthStatus, setHealthStatus] = useState<Record<string, string>>({})
  const [isAudioDialogOpen, setIsAudioDialogOpen] = useState(false)
  const [isWarningAudioDialogOpen, setIsWarningAudioDialogOpen] = useState(false)
  const [editingAudioConfig, setEditingAudioConfig] = useState<AlarmAudioConfig | null>(null)
  const [editingWarningAudioConfig, setEditingWarningAudioConfig] = useState<WarningAudioConfig | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [warningUploadProgress, setWarningUploadProgress] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [warningDownloadProgress, setWarningDownloadProgress] = useState<number | null>(null)

  // System config state
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({})
  const [editedConfig, setEditedConfig] = useState<SystemConfig>({})
  const [gpioServers, setGpioServers] = useState<GpioServerConfig[]>([])
  const [mp3Servers, setMp3Servers] = useState<Mp3ServerConfig[]>([])
  const [savedMp3Servers, setSavedMp3Servers] = useState<Mp3ServerConfig[]>([])
  const [newGpioUrl, setNewGpioUrl] = useState("")
  const [newMp3Url, setNewMp3Url] = useState("")
  const [newMp3Alarm, setNewMp3Alarm] = useState(true)
  const [newMp3Waiting, setNewMp3Waiting] = useState(true)
  const [newMp3Warning, setNewMp3Warning] = useState(true)
  const [newMp3VolumeAlarm, setNewMp3VolumeAlarm] = useState(100)
  const [newMp3VolumeWaiting, setNewMp3VolumeWaiting] = useState(100)
  const [newMp3VolumeWarning, setNewMp3VolumeWarning] = useState(100)
  const [isGpioDialogOpen, setIsGpioDialogOpen] = useState(false)
  const [isMp3DialogOpen, setIsMp3DialogOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState<string | null>(null)

  // Valve controller server state
  const [valveServer, setValveServer] = useState<ValveServerConfig | null>(null)
  const [newValveUrl, setNewValveUrl] = useState("")
  const [newValveTz, setNewValveTz] = useState("UTC")
  const [isValveDialogOpen, setIsValveDialogOpen] = useState(false)
  const [valveError, setValveError] = useState<string | null>(null)
  const [valveSaving, setValveSaving] = useState(false)
  const [showTzWarning, setShowTzWarning] = useState(false)

  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus | null>(null)
  const [firebaseCredentialsInput, setFirebaseCredentialsInput] = useState("")
  const [firebaseLoading, setFirebaseLoading] = useState(false)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)

  const canChangeNotificationsConfig = permissions.includes(Permission.UPDATE_NOTIFICATIONS_CONFIG)
  const canChangeAlarmSound = permissions.includes(Permission.CHANGE_ALARM_SOUND)
  const canModifyDevices = permissions.includes(Permission.MODIFY_DEVICES)

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
          const warningAudio = await getWarningAudioConfig()
          setWarningAudioConfig(warningAudio)
        } catch (error) {
          console.error("Failed to fetch warning audio configuration:", error)
        }

        try {
          const health = await getHealthStatus()
          setHealthStatus(health)
        } catch (error) {
          console.error("Failed to fetch health status:", error)
        }

        try {
          const config = await getSystemConfig()
          setSystemConfig(config)
          setEditedConfig(config)
        } catch (error) {
          console.error("Failed to fetch system config:", error)
        }

        try {
          const gpio = await getGpioServers()
          setGpioServers(gpio)
        } catch (error) {
          console.error("Failed to fetch GPIO servers:", error)
        }

        try {
          const mp3 = await getMp3Servers()
          setMp3Servers(mp3)
          setSavedMp3Servers(mp3)
        } catch (error) {
          console.error("Failed to fetch MP3 servers:", error)
        }

        try {
          const vs = await getValveServer()
          setValveServer(vs)
        } catch (error) {
          console.error("Failed to fetch valve server:", error)
        }

        try {
          const status = await getFirebaseStatus()
          setFirebaseStatus(status)
        } catch {
          // non-blocking
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

  const handleSaveFirebaseCredentials = async () => {
    if (!firebaseCredentialsInput.trim()) return
    setFirebaseLoading(true)
    setFirebaseError(null)
    try {
      await setFirebaseCredentials(firebaseCredentialsInput)
      setFirebaseStatus({ configured: true })
      setFirebaseCredentialsInput("")
    } catch (e: unknown) {
      setFirebaseError(e instanceof Error ? e.message : "Failed to save credentials")
    } finally {
      setFirebaseLoading(false)
    }
  }

  const handleDeleteFirebaseCredentials = async () => {
    setFirebaseLoading(true)
    setFirebaseError(null)
    try {
      await deleteFirebaseCredentials()
      setFirebaseStatus({ configured: false })
    } catch (e: unknown) {
      setFirebaseError(e instanceof Error ? e.message : "Failed to delete credentials")
    } finally {
      setFirebaseLoading(false)
    }
  }

  // --- Alarm audio handlers ---
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

  // --- Warning audio handlers ---
  const handleAddWarningAudioConfig = () => {
    setEditingWarningAudioConfig({ audio: null })
    setIsWarningAudioDialogOpen(true)
  }

  const handleEditWarningAudioConfig = () => {
    setEditingWarningAudioConfig(warningAudioConfig)
    setIsWarningAudioDialogOpen(true)
  }

  const handleDeleteWarningAudioConfig = async () => {
    try {
      await deleteWarningAudioConfig()
      setWarningAudioConfig(null)
    } catch (error) {
      setErrorMessage("Failed to delete warning audio configuration")
    }
  }

  const handleSaveWarningAudioConfig = async (config: WarningAudioConfig) => {
    try {
      setWarningUploadProgress(0)
      if (warningAudioConfig) {
        const updatedConfig = await updateWarningAudioConfig(config, (progress) => {
          setWarningUploadProgress(progress)
        })
        setWarningAudioConfig(updatedConfig)
      } else {
        const newConfig = await createWarningAudioConfig(config, (progress) => {
          setWarningUploadProgress(progress)
        })
        setWarningAudioConfig(newConfig)
      }
      setIsWarningAudioDialogOpen(false)
      setWarningUploadProgress(null)
    } catch (error) {
      setErrorMessage("Failed to save warning audio configuration")
      setWarningUploadProgress(null)
    }
  }

  const handleDownloadWarningAudioConfig = async () => {
    try {
      setWarningDownloadProgress(0)
      await downloadWarningAudio((progress) => {
        setWarningDownloadProgress(progress)
      })
      setWarningDownloadProgress(null)
    } catch (error) {
      setErrorMessage("Failed to download warning audio file")
      setWarningDownloadProgress(null)
    }
  }

  const handleWarningFormSubmit = () => {
    if (editingWarningAudioConfig) {
      handleSaveWarningAudioConfig(editingWarningAudioConfig)
    }
  }

  // --- System config handlers ---
  const handleSaveConfigKey = async (key: string) => {
    const value = editedConfig[key]
    if (value === systemConfig[key]) return

    try {
      setSavingConfig(key)
      await updateSystemConfig(key, value)
      setSystemConfig((prev) => ({ ...prev, [key]: value }))
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message :`Failed to update ${key}`)
      setEditedConfig((prev) => ({ ...prev, [key]: systemConfig[key] }))
    } finally {
      setSavingConfig(null)
    }
  }

  const configChanged = (key: string) => editedConfig[key] !== systemConfig[key]

  // --- GPIO server handlers ---
  const handleAddGpioServer = async () => {
    if (!newGpioUrl.trim()) return
    try {
      const created = await createGpioServer(newGpioUrl.trim())
      setGpioServers((prev) => [...prev, created])
      setNewGpioUrl("")
      setIsGpioDialogOpen(false)
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message :"Failed to add GPIO server")
    }
  }

  const handleDeleteGpioServer = async (id: number) => {
    try {
      await deleteGpioServer(id)
      setGpioServers((prev) => prev.filter((s) => s.id !== id))
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message :"Failed to delete GPIO server")
    }
  }

  // --- MP3 server handlers ---
  const handleAddMp3Server = async () => {
    if (!newMp3Url.trim()) return
    try {
      const created = await createMp3Server({
        url: newMp3Url.trim(),
        audio_type_alarm: newMp3Alarm,
        audio_type_waiting: newMp3Waiting,
        audio_type_warning: newMp3Warning,
        volume_alarm: newMp3VolumeAlarm,
        volume_waiting: newMp3VolumeWaiting,
        volume_warning: newMp3VolumeWarning,
      })
      setMp3Servers((prev) => [...prev, created])
      setSavedMp3Servers((prev) => [...prev, created])
      setNewMp3Url("")
      setNewMp3Alarm(true)
      setNewMp3Waiting(true)
      setNewMp3Warning(true)
      setNewMp3VolumeAlarm(100)
      setNewMp3VolumeWaiting(100)
      setNewMp3VolumeWarning(100)
      setIsMp3DialogOpen(false)
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message :"Failed to add MP3 server")
    }
  }

  const handleSaveMp3Server = async (server: Mp3ServerConfig) => {
    if (!server.id) return
    try {
      const updated = await updateMp3Server(server.id, server)
      setMp3Servers((prev) => prev.map((s) => (s.id === server.id ? updated : s)))
      setSavedMp3Servers((prev) => prev.map((s) => (s.id === server.id ? updated : s)))
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message :"Failed to update MP3 server")
    }
  }

  const isMp3ServerChanged = (server: Mp3ServerConfig) => {
    const saved = savedMp3Servers.find((s) => s.id === server.id)
    if (!saved) return false
    return saved.audio_type_alarm !== server.audio_type_alarm ||
      saved.audio_type_waiting !== server.audio_type_waiting ||
      saved.audio_type_warning !== server.audio_type_warning ||
      saved.volume_alarm !== server.volume_alarm ||
      saved.volume_waiting !== server.volume_waiting ||
      saved.volume_warning !== server.volume_warning
  }

  const handleDeleteMp3Server = async (id: number) => {
    try {
      await deleteMp3Server(id)
      setMp3Servers((prev) => prev.filter((s) => s.id !== id))
      setSavedMp3Servers((prev) => prev.filter((s) => s.id !== id))
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message :"Failed to delete MP3 server")
    }
  }

  // --- Valve controller server handlers ---
  const handleSaveValveServer = async () => {
    const tzChanged = valveServer?.configured && valveServer.timezone !== newValveTz
    if (tzChanged && !showTzWarning) {
      setShowTzWarning(true)
      return
    }
    setValveSaving(true)
    setValveError(null)
    try {
      const saved = await saveValveServerApi(newValveUrl, newValveTz)
      setValveServer(saved)
      setIsValveDialogOpen(false)
      setShowTzWarning(false)
    } catch (e: unknown) {
      setValveError(e instanceof Error ? e.message : "Failed to save valve server")
    } finally {
      setValveSaving(false)
    }
  }

  const handleDeleteValveServer = async () => {
    try {
      await deleteValveServer()
      setValveServer({ configured: false })
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete valve server")
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
    <div className="p-6 overflow-hidden">
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
              <div key={url} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                <span className="text-sm text-zinc-400 font-mono truncate sm:mr-4">{url}</span>
                <span
                  className={`text-sm font-medium px-2 py-1 rounded inline-block ${
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* Ntfy Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Ntfy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ntfyCredentials ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-300">URL</Label>
                  <Input
                    value={`${typeof window !== "undefined" ? window.location.protocol : "https:"}//${typeof window !== "undefined" ? window.location.hostname : ""}`}
                    readOnly
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-300">User</Label>
                  <Input value={ntfyCredentials.user} readOnly className="bg-zinc-700 text-zinc-50 border-zinc-600" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-300">Password</Label>
                  <Input value={ntfyCredentials.password} readOnly className="bg-zinc-700 text-zinc-50 border-zinc-600" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-300">Topic</Label>
                  <Input value={ntfyCredentials.topic} readOnly className="bg-zinc-700 text-zinc-50 border-zinc-600" />
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

        {/* Firebase Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50 flex items-center gap-2">
              Firebase
              {firebaseStatus && (
                <span
                  className={`text-xs font-normal px-2 py-0.5 rounded-full ${
                    firebaseStatus.configured
                      ? "bg-green-900/40 text-green-400"
                      : "bg-zinc-700 text-zinc-400"
                  }`}
                >
                  {firebaseStatus.configured ? "● Configured" : "● Not configured"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-zinc-400 text-sm">
              {firebaseStatus?.configured
                ? "Firebase Cloud Messaging is active. Android app will use FCM instead of ntfy."
                : "Paste your Firebase service account JSON to enable FCM push notifications."}
            </p>
            {canChangeNotificationsConfig && !firebaseStatus?.configured && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-300">
                  Service Account JSON
                </Label>
                <textarea
                  value={firebaseCredentialsInput}
                  onChange={(e) => setFirebaseCredentialsInput(e.target.value)}
                  placeholder='{"type": "service_account", "project_id": "...", ...}'
                  rows={6}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono resize-none"
                />
                {firebaseError && (
                  <p className="text-red-400 text-xs">{firebaseError}</p>
                )}
              </div>
            )}
          </CardContent>
          {canChangeNotificationsConfig && (
            <CardFooter className="flex gap-2">
              {!firebaseStatus?.configured ? (
                <Button
                  variant="outline"
                  className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 w-full"
                  onClick={handleSaveFirebaseCredentials}
                  disabled={firebaseLoading || !firebaseCredentialsInput.trim()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {firebaseLoading ? "Saving..." : "Save credentials"}
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="bg-red-900 hover:bg-red-800 w-full"
                      disabled={firebaseLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {firebaseLoading ? "Removing..." : "Remove Firebase"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-800 border-zinc-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-zinc-50">Remove Firebase configuration?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        All registered device tokens will be deleted. Android app will switch back to ntfy on next launch.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 border-zinc-600">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteFirebaseCredentials}
                        className="bg-red-800 hover:bg-red-700 text-white"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardFooter>
          )}
        </Card>

        {/* Alarm audio Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Alarm audio</CardTitle>
          </CardHeader>
          <CardContent>
            {alarmAudioConfig?.audio ? (
              <div className="space-y-2">
                <p className="text-zinc-300">Audio file: {alarmAudioConfig.audio.name}</p>
                {downloadProgress !== null && <Progress value={downloadProgress} className="w-full" />}
              </div>
            ) : (
              <p className="text-zinc-400">No alarm audio configuration saved</p>
            )}
          </CardContent>
          {canChangeAlarmSound && (
            <CardFooter>
              {alarmAudioConfig ? (
                <div className="flex justify-between items-center w-full">
                  <Button variant="outline" size="sm" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleDownloadAudioConfig} disabled={downloadProgress !== null}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <div className="flex space-x-2">
                    <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleEditAudioConfig}>Edit</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="bg-red-900 hover:bg-red-800">Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete the alarm audio configuration.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAudioConfig} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 w-full" onClick={handleAddAudioConfig}>Add audio</Button>
              )}
            </CardFooter>
          )}
        </Card>

        {/* Warning audio Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Warning audio</CardTitle>
          </CardHeader>
          <CardContent>
            {warningAudioConfig?.audio ? (
              <div className="space-y-2">
                <p className="text-zinc-300">Audio file: {warningAudioConfig.audio.name}</p>
                {warningDownloadProgress !== null && <Progress value={warningDownloadProgress} className="w-full" />}
              </div>
            ) : (
              <p className="text-zinc-400">No warning audio configuration saved</p>
            )}
          </CardContent>
          {canChangeAlarmSound && (
            <CardFooter>
              {warningAudioConfig ? (
                <div className="flex justify-between items-center w-full">
                  <Button variant="outline" size="sm" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleDownloadWarningAudioConfig} disabled={warningDownloadProgress !== null}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <div className="flex space-x-2">
                    <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleEditWarningAudioConfig}>Edit</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="bg-red-900 hover:bg-red-800">Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete the warning audio configuration.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteWarningAudioConfig} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 w-full" onClick={handleAddWarningAudioConfig}>Add audio</Button>
              )}
            </CardFooter>
          )}
        </Card>

        {/* Durations Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Durations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Alarm recording duration (seconds)</Label>
              <Input
                type="number"
                min={10}
                value={editedConfig.alarm_recording_duration_seconds || ""}
                onChange={(e) => setEditedConfig((prev) => ({ ...prev, alarm_recording_duration_seconds: e.target.value }))}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
                disabled={!canModifyDevices}
              />
              {canModifyDevices && configChanged("alarm_recording_duration_seconds") && (
                <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveConfigKey("alarm_recording_duration_seconds")} disabled={savingConfig === "alarm_recording_duration_seconds"}>
                  <Save className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Always recording duration (seconds)</Label>
              <Input
                type="number"
                min={10}
                value={editedConfig.always_recording_duration_seconds || ""}
                onChange={(e) => setEditedConfig((prev) => ({ ...prev, always_recording_duration_seconds: e.target.value }))}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
                disabled={!canModifyDevices}
              />
              {canModifyDevices && configChanged("always_recording_duration_seconds") && (
                <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveConfigKey("always_recording_duration_seconds")} disabled={savingConfig === "always_recording_duration_seconds"}>
                  <Save className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Warning cooldown (seconds)</Label>
              <Input
                type="number"
                min={0}
                value={editedConfig.warning_cooldown_seconds || ""}
                onChange={(e) => setEditedConfig((prev) => ({ ...prev, warning_cooldown_seconds: e.target.value }))}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
                disabled={!canModifyDevices}
              />
              {canModifyDevices && configChanged("warning_cooldown_seconds") && (
                <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveConfigKey("warning_cooldown_seconds")} disabled={savingConfig === "warning_cooldown_seconds"}>
                  <Save className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Warning notification delay (seconds)</Label>
              <Input
                type="number"
                min={0}
                value={editedConfig.warning_notification_delay_seconds || ""}
                onChange={(e) => setEditedConfig((prev) => ({ ...prev, warning_notification_delay_seconds: e.target.value }))}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
                disabled={!canModifyDevices}
              />
              {canModifyDevices && configChanged("warning_notification_delay_seconds") && (
                <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveConfigKey("warning_notification_delay_seconds")} disabled={savingConfig === "warning_notification_delay_seconds"}>
                  <Save className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detection settings Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Detection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">YOLO model</Label>
              <select
                value={editedConfig.detection_yolo_model || ""}
                onChange={(e) => setEditedConfig((prev) => ({ ...prev, detection_yolo_model: e.target.value }))}
                className="w-full bg-zinc-700 text-zinc-50 border border-zinc-600 rounded-md px-3 py-2 text-sm"
                disabled={!canModifyDevices}
              >
                {["yolo11n", "yolo11s", "yolo11m", "yolo11l", "yolo11x", "yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolov8x", "yolo26n", "yolo26s", "yolo26m", "yolo26l", "yolo26x"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {canModifyDevices && configChanged("detection_yolo_model") && (
                <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveConfigKey("detection_yolo_model")} disabled={savingConfig === "detection_yolo_model"}>
                  <Save className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">
                Motion sensitivity: {editedConfig.motion_sensitivity || 50}%
              </Label>
              <div className="flex flex-col gap-2">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={editedConfig.motion_sensitivity || 50}
                  onChange={(e) => setEditedConfig((prev) => ({ ...prev, motion_sensitivity: e.target.value }))}
                  className="w-full accent-zinc-400"
                  disabled={!canModifyDevices}
                />
                {canModifyDevices && configChanged("motion_sensitivity") && (
                  <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveConfigKey("motion_sensitivity")} disabled={savingConfig === "motion_sensitivity"}>
                    <Save className="h-4 w-4 text-white" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">
                YOLO confidence: {editedConfig.detection_confidence || 50}%
              </Label>
              <div className="flex flex-col gap-2">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={editedConfig.detection_confidence || 50}
                  onChange={(e) => setEditedConfig((prev) => ({ ...prev, detection_confidence: e.target.value }))}
                  className="w-full accent-zinc-400"
                  disabled={!canModifyDevices}
                />
                {canModifyDevices && configChanged("detection_confidence") && (
                  <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveConfigKey("detection_confidence")} disabled={savingConfig === "detection_confidence"}>
                    <Save className="h-4 w-4 text-white" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GPIO Servers Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">GPIO Monitor Servers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {gpioServers.length === 0 ? (
              <p className="text-zinc-400">No GPIO servers configured. Add them below.</p>
            ) : (
              gpioServers.map((server) => (
                <div key={server.id} className="flex items-center justify-between gap-2 p-2 bg-zinc-700/50 rounded">
                  <span className="text-sm text-zinc-300 font-mono truncate">{server.url}</span>
                  {canModifyDevices && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-zinc-700 shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete GPIO server?</AlertDialogTitle>
                          <AlertDialogDescription>Remove {server.url}. This will fail if sensors are using it.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteGpioServer(server.id!)} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))
            )}
          </CardContent>
          {canModifyDevices && (
            <CardFooter>
              <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 w-full" onClick={() => setIsGpioDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add server
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* MP3 Servers Card */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">MP3 Player Servers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mp3Servers.length === 0 ? (
              <p className="text-zinc-400">No MP3 servers configured. Add them below.</p>
            ) : (
              mp3Servers.map((server) => (
                <div key={server.id} className="flex flex-col gap-2 p-3 bg-zinc-700/50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 font-mono truncate">{server.url}</span>
                    {canModifyDevices && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-zinc-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete MP3 server?</AlertDialogTitle>
                            <AlertDialogDescription>Remove {server.url} from MP3 player servers.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMp3Server(server.id!)} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([["Alarm", "audio_type_alarm", "volume_alarm"], ["Waiting", "audio_type_waiting", "volume_waiting"], ["Warning", "audio_type_warning", "volume_warning"]] as const).map(([label, typeKey, volKey]) => (
                      <div key={typeKey} className="flex flex-col gap-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`mp3-${server.id}-${typeKey}`}
                            checked={server[typeKey]}
                            onCheckedChange={(checked) => {
                              setMp3Servers((prev) => prev.map((s) => (s.id === server.id ? { ...s, [typeKey]: !!checked } : s)))
                            }}
                            disabled={!canModifyDevices}
                            className="border-zinc-500"
                          />
                          <label htmlFor={`mp3-${server.id}-${typeKey}`} className="text-sm text-zinc-300">{label}</label>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={server[volKey]}
                            onChange={(e) => {
                              const vol = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                              setMp3Servers((prev) => prev.map((s) => (s.id === server.id ? { ...s, [volKey]: vol } : s)))
                            }}
                            disabled={!canModifyDevices || !server[typeKey]}
                            className="bg-zinc-700 text-zinc-50 border-zinc-600 h-7 text-xs w-16"
                          />
                          <span className="text-xs text-zinc-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {canModifyDevices && isMp3ServerChanged(server) && (
                    <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 w-full" onClick={() => handleSaveMp3Server(server)}>
                      <Save className="h-4 w-4 text-white" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
          {canModifyDevices && (
            <CardFooter>
              <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 w-full" onClick={() => setIsMp3DialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add server
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Valve Controller Server */}
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-zinc-50">Valve Controller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {valveServer?.configured ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-zinc-300">URL</Label>
                  <p className="text-sm text-zinc-50 font-mono">{valveServer.url}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-zinc-300">Timezone</Label>
                  <p className="text-sm text-zinc-50">{valveServer.timezone}</p>
                </div>
              </div>
            ) : (
              <p className="text-zinc-400 text-sm">No valve controller server configured.</p>
            )}
            {valveError && <p className="text-sm text-red-400">{valveError}</p>}
          </CardContent>
          {canModifyDevices && (
            <CardFooter className="flex gap-2">
              <Button
                variant="outline"
                className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 flex-1"
                onClick={() => {
                  setNewValveUrl(valveServer?.url ?? "")
                  setNewValveTz(valveServer?.timezone ?? "UTC")
                  setValveError(null)
                  setShowTzWarning(false)
                  setIsValveDialogOpen(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                {valveServer?.configured ? "Update" : "Add Server"}
              </Button>
              {valveServer?.configured && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-red-900">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-800 border-zinc-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-zinc-50">Remove Valve Controller?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will remove the valve controller configuration. All irrigation settings will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-700 text-zinc-50">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-900 hover:bg-red-800"
                        onClick={handleDeleteValveServer}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Audio dialogs */}
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
            {uploadProgress !== null && <Progress value={uploadProgress} className="w-full" />}
            <Button onClick={handleFormSubmit} className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600" disabled={!editingAudioConfig?.audio || uploadProgress !== null}>
              {alarmAudioConfig ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWarningAudioDialogOpen} onOpenChange={setIsWarningAudioDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{warningAudioConfig ? "Edit" : "Add"} Warning audio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".mp3"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && file.name.toLowerCase().endsWith(".mp3")) {
                  setEditingWarningAudioConfig((prev) => (prev ? { ...prev, audio: file } : null))
                } else {
                  alert("Please select an MP3 file.")
                  e.target.value = ""
                }
              }}
              className="bg-zinc-700 text-zinc-50 border-zinc-600"
              required
            />
            {warningUploadProgress !== null && <Progress value={warningUploadProgress} className="w-full" />}
            <Button onClick={handleWarningFormSubmit} className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600" disabled={!editingWarningAudioConfig?.audio || warningUploadProgress !== null}>
              {warningAudioConfig ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GPIO server dialog */}
      <Dialog open={isGpioDialogOpen} onOpenChange={setIsGpioDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Add GPIO Monitor Server</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Server URL</Label>
              <Input
                value={newGpioUrl}
                onChange={(e) => setNewGpioUrl(e.target.value)}
                placeholder="http://192.168.1.100:8787"
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
            </div>
            <Button onClick={handleAddGpioServer} className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600" disabled={!newGpioUrl.trim()}>
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MP3 server dialog */}
      <Dialog open={isMp3DialogOpen} onOpenChange={setIsMp3DialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Add MP3 Player Server</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Server URL</Label>
              <Input
                value={newMp3Url}
                onChange={(e) => setNewMp3Url(e.target.value)}
                placeholder="http://192.168.1.100:8888"
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Audio types & volume</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="new-mp3-alarm" checked={newMp3Alarm} onCheckedChange={(c) => setNewMp3Alarm(!!c)} className="border-zinc-500" />
                    <label htmlFor="new-mp3-alarm" className="text-sm text-zinc-300">Alarm</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={100} value={newMp3VolumeAlarm} onChange={(e) => setNewMp3VolumeAlarm(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} disabled={!newMp3Alarm} className="bg-zinc-700 text-zinc-50 border-zinc-600 h-7 text-xs w-16" />
                    <span className="text-xs text-zinc-400">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="new-mp3-waiting" checked={newMp3Waiting} onCheckedChange={(c) => setNewMp3Waiting(!!c)} className="border-zinc-500" />
                    <label htmlFor="new-mp3-waiting" className="text-sm text-zinc-300">Waiting</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={100} value={newMp3VolumeWaiting} onChange={(e) => setNewMp3VolumeWaiting(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} disabled={!newMp3Waiting} className="bg-zinc-700 text-zinc-50 border-zinc-600 h-7 text-xs w-16" />
                    <span className="text-xs text-zinc-400">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="new-mp3-warning" checked={newMp3Warning} onCheckedChange={(c) => setNewMp3Warning(!!c)} className="border-zinc-500" />
                    <label htmlFor="new-mp3-warning" className="text-sm text-zinc-300">Warning</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={100} value={newMp3VolumeWarning} onChange={(e) => setNewMp3VolumeWarning(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} disabled={!newMp3Warning} className="bg-zinc-700 text-zinc-50 border-zinc-600 h-7 text-xs w-16" />
                    <span className="text-xs text-zinc-400">%</span>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleAddMp3Server} className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600" disabled={!newMp3Url.trim()}>
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Valve Server Dialog */}
      <Dialog open={isValveDialogOpen} onOpenChange={setIsValveDialogOpen}>
        <DialogContent className="bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">
              {valveServer?.configured ? "Update" : "Add"} Valve Controller Server
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-zinc-300">Server URL</Label>
              <Input
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
                placeholder="http://192.168.1.x:8686"
                value={newValveUrl}
                onChange={(e) => setNewValveUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-zinc-300">Timezone</Label>
              <Select value={newValveTz} onValueChange={setNewValveTz}>
                <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {VALVE_TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz} className="text-zinc-50">{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {valveServer?.configured && (
                <p className="text-xs text-amber-400 mt-1">
                  Changing timezone will delete all irrigation schedules and settings.
                </p>
              )}
            </div>
            {valveError && <p className="text-sm text-red-400">{valveError}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              className="bg-zinc-700 text-zinc-50"
              onClick={() => setIsValveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-zinc-600 text-zinc-50 hover:bg-zinc-500"
              disabled={valveSaving || !newValveUrl.trim()}
              onClick={handleSaveValveServer}
            >
              {valveSaving ? "Saving..." : showTzWarning ? "Confirm (deletes schedules)" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error dialog */}
      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent className="bg-zinc-800 text-zinc-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMessage(null)} className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
