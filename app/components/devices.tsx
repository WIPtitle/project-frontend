"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Camera, Wifi, WifiOff, Loader2 } from "lucide-react"

// Import your actual API functions here
import {
  getAllRtspCameras,
  getAllSensors,
  createRTSPCamera,
  createSensor,
  updateSensor,
  deleteRTSPCamera,
  deleteSensor,
  getSensorStatusStream,
  getAvailableGpioServers,
  getCameraStreamUrl,
} from "@/lib/api"

import { type RTSPCamera, type Sensor, Permission, type SensorStatus } from "@/types"

type DeviceProps = {
  permissions: Permission[]
}

type CameraInputDto = {
  name: string
  ip: string
  port: number
  username: string
  password: string
  path: string
  always_recording: boolean
}

type SensorInputDto = {
  id?: string
  name: string
  gpio_pin_number: number
  gpio_server_url: string
}

export default function Component({ permissions }: DeviceProps) {
  const [rtspCameras, setRtspCameras] = useState<RTSPCamera[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [gpioServers, setGpioServers] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<CameraInputDto | SensorInputDto | null>(null)
  const [deviceType, setDeviceType] = useState<"camera" | "sensor">("camera")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sensorStatuses, setSensorStatuses] = useState<Record<string, SensorStatus>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingCameras, setIsLoadingCameras] = useState(true)
  const [isLoadingSensors, setIsLoadingSensors] = useState(true)
  const [isLoadingServers, setIsLoadingServers] = useState(true)
  const [streamErrors, setStreamErrors] = useState<{ [key: string]: number }>({})
  const [connectionStatus, setConnectionStatus] = useState<{
    [key: string]: "connected" | "connecting" | "error" | "unknown"
  }>({})

  // State for camera streaming
  const [selectedStreamCamera, setSelectedStreamCamera] = useState<RTSPCamera | null>(null)
  const [streamLoading, setStreamLoading] = useState(false)

  const canModifyDevices = permissions.includes(Permission.MODIFY_DEVICES)
  const eventSources = useRef<{ [key: string]: EventSource }>({})
  const reconnectTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setIsLoadingCameras(true)
        setIsLoadingSensors(true)
        setIsLoadingServers(true)
        const [cameras, sensorDevices, servers] = await Promise.all([
          getAllRtspCameras(),
          getAllSensors(),
          getAvailableGpioServers(),
        ])
        setRtspCameras(cameras)
        setSensors(sensorDevices)
        setGpioServers(servers)
      } catch (error) {
        setErrorMessage("Failed to fetch devices")
      } finally {
        setIsLoadingCameras(false)
        setIsLoadingSensors(false)
        setIsLoadingServers(false)
      }
    }
    fetchDevices()
  }, [])

  // Sensor event source management (unchanged)
  useEffect(() => {
    for (const sensorId in eventSources.current) {
      if (!sensors.some((sensor) => sensor.id === sensorId)) {
        eventSources.current[sensorId].close()
        delete eventSources.current[sensorId]

        if (reconnectTimeouts.current[sensorId]) {
          clearTimeout(reconnectTimeouts.current[sensorId])
          delete reconnectTimeouts.current[sensorId]
        }
      }
    }

    for (const sensor of sensors) {
      if (!eventSources.current[sensor.id]) {
        const createEventSource = () => {
          setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "connecting" }))

          const stream = getSensorStatusStream(sensor.id)
          eventSources.current[sensor.id] = stream

          stream.onmessage = (event) => {
            const status = event.data as SensorStatus
            setSensorStatuses((prevStatuses) => ({
              ...prevStatuses,
              [sensor.id]: status,
            }))
            setStreamErrors((prev) => ({ ...prev, [sensor.id]: 0 }))
            setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "connected" }))
          }

          stream.onerror = (error) => {
            console.error(`Error in sensor stream for sensor ${sensor.id}:`, error)
            setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "error" }))

            setStreamErrors((prev) => {
              const errorCount = (prev[sensor.id] || 0) + 1

              if (errorCount > 3) {
                console.warn(`Sensor ${sensor.id} stream has failed ${errorCount} times`)
              }

              setSensorStatuses((prevStatuses) => ({
                ...prevStatuses,
                [sensor.id]: "UNKNOWN" as SensorStatus,
              }))

              return { ...prev, [sensor.id]: errorCount }
            })

            const errorCount = streamErrors[sensor.id] || 0
            if (errorCount > 10) {
              console.error(`Too many failures for sensor ${sensor.id}, implementing backoff`)
              stream.close()
              delete eventSources.current[sensor.id]

              const backoffTime = Math.min(30000 * Math.pow(2, Math.floor(errorCount / 10) - 1), 300000)

              reconnectTimeouts.current[sensor.id] = setTimeout(() => {
                console.log(
                  `Attempting to reconnect sensor ${sensor.id} stream after ${backoffTime}ms backoff`,
                )
                setStreamErrors((prev) => ({ ...prev, [sensor.id]: 0 }))
                createEventSource()
              }, backoffTime)
            }
          }

          stream.onopen = () => {
            console.log(`Connected to sensor stream for sensor ${sensor.id}`)
            setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "connected" }))
            setStreamErrors((prev) => ({ ...prev, [sensor.id]: 0 }))
          }
        }

        createEventSource()
      }
    }

    return () => {
      for (const timeout of Object.values(reconnectTimeouts.current)) {
        clearTimeout(timeout)
      }
    }
  }, [sensors, streamErrors])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const sensorId in eventSources.current) {
        eventSources.current[sensorId].close()
      }
      for (const timeout of Object.values(reconnectTimeouts.current)) {
        clearTimeout(timeout)
      }
    }
  }, [])

  const handleAddDevice = (type: "camera" | "sensor") => {
    setDeviceType(type)
    setEditingDevice(
      type === "camera"
        ? { name: "", ip: "", port: 554, username: "", password: "", path: "", always_recording: false }
        : { name: "", gpio_pin_number: 0, gpio_server_url: gpioServers[0] || "" },
    )
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleEditDevice = (device: RTSPCamera | Sensor, type: "camera" | "sensor") => {
    if (type === "sensor") {
      const sensor = device as Sensor
      setDeviceType(type)
      setEditingDevice({
        id: sensor.id,
        name: sensor.name,
        gpio_pin_number: sensor.gpio_pin_number,
        gpio_server_url: sensor.gpio_server_url,
      })
      setIsCreating(false)
      setIsDialogOpen(true)
    }
  }

  const handleDeleteDevice = async (id: string, type: "camera" | "sensor") => {
    try {
      if (type === "camera") {
        await deleteRTSPCamera(id)
        setRtspCameras(rtspCameras.filter((camera) => camera.ip !== id))
      } else if (type === "sensor") {
        if (eventSources.current[id]) {
          eventSources.current[id].close()
          delete eventSources.current[id]
        }
        if (reconnectTimeouts.current[id]) {
          clearTimeout(reconnectTimeouts.current[id])
          delete reconnectTimeouts.current[id]
        }
        await deleteSensor(id)
        setSensors(sensors.filter((sensor) => sensor.id !== id))
      }
    } catch (error) {
      setErrorMessage(`Failed to delete ${type}`)
    }
  }

  const handleSaveDevice = async () => {
    if (!editingDevice) return

    try {
      if (deviceType === "camera") {
        const camera = editingDevice as CameraInputDto
        if (isCreating) {
          const newCamera = await createRTSPCamera(camera)
          setRtspCameras([...rtspCameras, newCamera])
        }
      } else if (deviceType === "sensor") {
        const sensor = editingDevice as SensorInputDto
        if (isCreating) {
          const { id, ...sensorData } = sensor
          const newSensor = await createSensor(sensorData)
          setSensors([...sensors, newSensor])
        } else if (sensor.id) {
          const updatedSensor = await updateSensor(sensor.id, sensor)
          setSensors(sensors.map((s) => (s.id === updatedSensor.id ? updatedSensor : s)))
        }
      }
      setIsDialogOpen(false)
      setEditingDevice(null)
    } catch (error) {
      setErrorMessage(`Failed to ${isCreating ? "create" : "update"} ${deviceType}`)
    }
  }

  const getStatusDisplay = (sensorId: string): string => {
    const status = sensorStatuses[sensorId]
    const connection = connectionStatus[sensorId]

    if (connection === "connecting") return "Connecting..."
    if (connection === "error" && streamErrors[sensorId] > 3) return "Connection Error"
    if (!status || status === "UNKNOWN") return "Unknown"

    return status
  }

  const getStatusColor = (sensorId: string): string => {
    const connection = connectionStatus[sensorId]
    const status = sensorStatuses[sensorId]

    if (connection === "error" && streamErrors[sensorId] > 3) return "text-red-500"
    if (connection === "connecting") return "text-yellow-500"
    if (!status || status === "UNKNOWN") return "text-gray-500"
    if (status === "HIGH") return "text-red-500"

    return "text-zinc-300"
  }

  const handleOpenLiveStream = (camera: RTSPCamera) => {
    setSelectedStreamCamera(camera)
    setStreamLoading(true)
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-zinc-50 mb-6">Devices</h1>

      {/* Cameras Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">RTSP cameras</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice("camera")}
          >
            Add camera
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {isLoadingCameras ? (
          <p className="text-zinc-300">Loading RTSP cameras...</p>
        ) : rtspCameras.length === 0 ? (
          <p className="text-zinc-300">No RTSP cameras found.</p>
        ) : (
          rtspCameras.map((camera) => (
            <Card key={camera.ip} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50">{camera.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <div>
                  <p className="text-zinc-300">IP: {camera.ip}</p>
                  <p className="text-zinc-300">Path: {camera.path}</p>
                  <p className="text-zinc-300">Always recording: {camera.always_recording ? "Yes" : "No"}</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col mt-auto">
                <div className="flex w-full">
                  <Button
                    variant="outline"
                    className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                    onClick={() => handleOpenLiveStream(camera)}
                  >
                    <Wifi className="mr-2 h-4 w-4" />
                    Live Stream
                  </Button>
                  {canModifyDevices && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="flex-1 ml-1 bg-red-900 hover:bg-red-800">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the camera.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDevice(camera.ip, "camera")}
                            className="bg-red-900 hover:bg-red-800 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Sensors Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">Sensors</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice("sensor")}
            disabled={!isLoadingServers && gpioServers.length === 0}
          >
            Add sensor
          </Button>
        )}
      </div>
      {!isLoadingServers && gpioServers.length === 0 && (
        <p className="text-yellow-500 mb-4">No GPIO servers configured. Please configure GPIO_MONITOR_URLS.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingSensors ? (
          <p className="text-zinc-300">Loading sensors...</p>
        ) : sensors.length === 0 ? (
          <p className="text-zinc-300">No sensors found.</p>
        ) : (
          sensors.map((sensor) => (
            <Card key={sensor.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50 flex justify-between items-center">
                  <span>{sensor.name}</span>
                  {streamErrors[sensor.id] > 3 && (
                    <span className="text-xs text-yellow-500" title="Connection issues detected">
                      ⚠️
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-zinc-300">GPIO Pin: {sensor.gpio_pin_number}</p>
                <p className="text-zinc-300 text-sm">Server: {sensor.gpio_server_url}</p>
                <p className={`mt-6 ${getStatusColor(sensor.id)}`}>
                  Current Status: {getStatusDisplay(sensor.id)}
                </p>
              </CardContent>
              {canModifyDevices && (
                <CardFooter className="flex flex-col mt-auto">
                  <div className="flex w-full">
                    <Button
                      variant="outline"
                      className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                      onClick={() => handleEditDevice(sensor, "sensor")}
                      disabled={sensor.listening}
                    >
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="flex-1 ml-1 bg-red-900 hover:bg-red-800"
                          disabled={sensor.listening}
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the sensor.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDevice(sensor.id, "sensor")}
                            className="bg-red-900 hover:bg-red-800 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              )}
            </Card>
          ))
        )}
      </div>

        {/* Live Streaming Dialog */}
        <Dialog open={!!selectedStreamCamera} onOpenChange={() => {
          setSelectedStreamCamera(null)
          setStreamLoading(false)
        }}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col bg-zinc-800 text-zinc-50">
            <DialogHeader>
              <DialogTitle>Live Stream: {selectedStreamCamera?.name}</DialogTitle>
              <DialogDescription>
                Camera IP: {selectedStreamCamera?.ip} | Port: {selectedStreamCamera?.port}
              </DialogDescription>
            </DialogHeader>

            {selectedStreamCamera && (
              <div className="flex-grow overflow-hidden relative">
                <video
                  autoPlay
                  muted
                  className="w-full h-full object-contain"
                  src={getCameraStreamUrl(selectedStreamCamera.ip)}
                  onLoadedData={() => setStreamLoading(false)}
                  onError={() => {
                    setStreamLoading(false)
                    setErrorMessage("Failed to connect to camera stream. Make sure the camera is online and accessible.")
                    setSelectedStreamCamera(null)
                  }}
                  controlsList="nodownload noplaybackrate"
                  onSeeking={(e) => {
                    e.preventDefault()
                    e.currentTarget.currentTime = 0
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </DialogContent>
        </Dialog>

      {/* Device Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Add" : "Edit"} {deviceType === "camera" ? "Camera" : "Sensor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Name"
              value={editingDevice?.name || ""}
              onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, name: e.target.value } : null))}
              className="bg-zinc-700 text-zinc-50 border-zinc-600"
              required
            />
            {deviceType === "camera" ? (
              <>
                <Input
                  placeholder="IP"
                  value={(editingDevice as CameraInputDto)?.ip || ""}
                  onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, ip: e.target.value } : null))}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  disabled={!isCreating}
                  required
                />
                <Input
                  type="number"
                  placeholder="Port"
                  value={(editingDevice as CameraInputDto)?.port || ""}
                  onChange={(e) =>
                    setEditingDevice((prev) => (prev ? { ...prev, port: Number.parseInt(e.target.value) } : null))
                  }
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  required
                />
                <Input
                  placeholder="Username"
                  value={(editingDevice as CameraInputDto)?.username || ""}
                  onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, username: e.target.value } : null))}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={(editingDevice as CameraInputDto)?.password || ""}
                  onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, password: e.target.value } : null))}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  required
                />
                <Input
                  placeholder="Path"
                  value={(editingDevice as CameraInputDto)?.path || ""}
                  onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, path: e.target.value } : null))}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  required
                />
                <div className="flex items-center justify-between">
                  <Label htmlFor="always-recording" className="text-zinc-50">
                    Always recording
                  </Label>
                  <Switch
                    id="always-recording"
                    checked={(editingDevice as CameraInputDto)?.always_recording || false}
                    onCheckedChange={(checked) =>
                      setEditingDevice((prev) => (prev ? { ...prev, always_recording: checked } : null))
                    }
                    className="data-[state=unchecked]:bg-zinc-700 data-[state=unchecked]:border-zinc-600"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="gpio-server" className="text-zinc-50 mb-2 block">
                    GPIO Server
                  </Label>
                  <Select
                    value={(editingDevice as SensorInputDto)?.gpio_server_url || ""}
                    onValueChange={(value) =>
                      setEditingDevice((prev) => (prev ? { ...prev, gpio_server_url: value } : null))
                    }
                    disabled={!isCreating}
                  >
                    <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                      <SelectValue placeholder="Select a GPIO server" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 text-zinc-50 border-zinc-700">
                      {gpioServers.map((server) => (
                        <SelectItem key={server} value={server}>
                          {server}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  placeholder="GPIO Pin Number"
                  value={(editingDevice as SensorInputDto)?.gpio_pin_number || ""}
                  onChange={(e) =>
                    setEditingDevice((prev) =>
                      prev ? { ...prev, gpio_pin_number: Number.parseInt(e.target.value) } : null,
                    )
                  }
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  disabled={!isCreating}
                  required
                />
              </>
            )}
            <Button
              onClick={handleSaveDevice}
              className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            >
              {isCreating ? "Create" : "Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
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