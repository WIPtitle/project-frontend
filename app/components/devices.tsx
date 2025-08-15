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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  getAllRtspCameras,
  getAllSensors,
  createRTSPCamera,
  createSensor,
  updateSensor,
  deleteRTSPCamera,
  deleteSensor,
  getSensorStatusStream,
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
  name: string
  gpio_pin_number: number
}

export default function Component({ permissions }: DeviceProps) {
  const [rtspCameras, setRtspCameras] = useState<RTSPCamera[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<CameraInputDto | SensorInputDto | null>(null)
  const [deviceType, setDeviceType] = useState<"camera" | "sensor">("camera")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sensorStatuses, setSensorStatuses] = useState<Record<number, SensorStatus>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingCameras, setIsLoadingCameras] = useState(true)
  const [isLoadingSensors, setIsLoadingSensors] = useState(true)
  const [streamErrors, setStreamErrors] = useState<{ [key: number]: number }>({})
  const [connectionStatus, setConnectionStatus] = useState<{ [key: number]: 'connected' | 'connecting' | 'error' | 'unknown' }>({})

  const canModifyDevices = permissions.includes(Permission.MODIFY_DEVICES)
  const eventSources = useRef<{ [key: number]: EventSource }>({})
  const reconnectTimeouts = useRef<{ [key: number]: NodeJS.Timeout }>({})

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setIsLoadingCameras(true)
        setIsLoadingSensors(true)
        const cameras = await getAllRtspCameras()
        const sensorDevices = await getAllSensors()
        setRtspCameras(cameras)
        setSensors(sensorDevices)
      } catch (error) {
        setErrorMessage("Failed to fetch devices")
      } finally {
        setIsLoadingCameras(false)
        setIsLoadingSensors(false)
      }
    }
    fetchDevices()
  }, [])

  useEffect(() => {
    // Close event sources for removed sensors
    for (const gpio in eventSources.current) {
      if (!sensors.some((sensor) => sensor.gpio_pin_number === Number.parseInt(gpio))) {
        eventSources.current[gpio].close()
        delete eventSources.current[gpio]

        // Clear any pending reconnect timeouts
        if (reconnectTimeouts.current[gpio]) {
          clearTimeout(reconnectTimeouts.current[gpio])
          delete reconnectTimeouts.current[gpio]
        }
      }
    }

    // Start event sources for new sensors
    for (const sensor of sensors) {
      if (!eventSources.current[sensor.gpio_pin_number]) {
        const createEventSource = () => {
          setConnectionStatus((prev) => ({ ...prev, [sensor.gpio_pin_number]: 'connecting' }))

          const stream = getSensorStatusStream(sensor.gpio_pin_number)
          eventSources.current[sensor.gpio_pin_number] = stream

          stream.onmessage = (event) => {
            const status = event.data as SensorStatus
            setSensorStatuses((prevStatuses) => ({
              ...prevStatuses,
              [sensor.gpio_pin_number]: status,
            }))
            // Reset error count on successful message
            setStreamErrors((prev) => ({ ...prev, [sensor.gpio_pin_number]: 0 }))
            setConnectionStatus((prev) => ({ ...prev, [sensor.gpio_pin_number]: 'connected' }))
          }

          stream.onerror = (error) => {
            console.error(`Error in sensor stream for GPIO ${sensor.gpio_pin_number}:`, error)
            setConnectionStatus((prev) => ({ ...prev, [sensor.gpio_pin_number]: 'error' }))

            // Increment error count
            setStreamErrors((prev) => {
              const errorCount = (prev[sensor.gpio_pin_number] || 0) + 1

              // If too many errors, show a warning
              if (errorCount > 3) {
                console.warn(`Sensor ${sensor.gpio_pin_number} stream has failed ${errorCount} times`)
              }

              // Set status to UNKNOWN after errors
              setSensorStatuses((prevStatuses) => ({
                ...prevStatuses,
                [sensor.gpio_pin_number]: "UNKNOWN" as SensorStatus,
              }))

              return { ...prev, [sensor.gpio_pin_number]: errorCount }
            })

            // If too many failures, implement exponential backoff
            const errorCount = streamErrors[sensor.gpio_pin_number] || 0
            if (errorCount > 10) {
              console.error(`Too many failures for sensor ${sensor.gpio_pin_number}, implementing backoff`)
              stream.close()
              delete eventSources.current[sensor.gpio_pin_number]

              // Exponential backoff: 30s, 60s, 120s, etc.
              const backoffTime = Math.min(30000 * Math.pow(2, Math.floor(errorCount / 10) - 1), 300000) // Max 5 minutes

              reconnectTimeouts.current[sensor.gpio_pin_number] = setTimeout(() => {
                console.log(`Attempting to reconnect sensor ${sensor.gpio_pin_number} stream after ${backoffTime}ms backoff`)
                setStreamErrors((prev) => ({ ...prev, [sensor.gpio_pin_number]: 0 }))
                createEventSource()
              }, backoffTime)
            }
          }

          stream.onopen = () => {
            console.log(`Connected to sensor stream for GPIO ${sensor.gpio_pin_number}`)
            setConnectionStatus((prev) => ({ ...prev, [sensor.gpio_pin_number]: 'connected' }))
            // Reset error count on successful connection
            setStreamErrors((prev) => ({ ...prev, [sensor.gpio_pin_number]: 0 }))
          }
        }

        createEventSource()
      }
    }

    // Cleanup function
    return () => {
      // Clear all reconnect timeouts
      for (const timeout of Object.values(reconnectTimeouts.current)) {
        clearTimeout(timeout)
      }
    }
  }, [sensors, streamErrors])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Close all event sources when component unmounts
      for (const gpio in eventSources.current) {
        eventSources.current[gpio].close()
      }
      // Clear all timeouts
      for (const timeout of Object.values(reconnectTimeouts.current)) {
        clearTimeout(timeout)
      }
    }
  }, [])

  const handleAddDevice = (type: "camera" | "sensor") => {
    setDeviceType(type)
    setEditingDevice(
      type === "camera"
        ? { name: "", ip: "", port: 0, username: "", password: "", path: "", always_recording: false }
        : { name: "", gpio_pin_number: 0 },
    )
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleEditDevice = (device: RTSPCamera | Sensor, type: "camera" | "sensor") => {
    if (type === "sensor") {
      setDeviceType(type)
      setEditingDevice(device)
      setIsCreating(false)
      setIsDialogOpen(true)
    }
  }

  const handleDeleteDevice = async (id: string | number, type: "camera" | "sensor") => {
    try {
      if (type === "camera") {
        await deleteRTSPCamera(id as string)
        setRtspCameras(rtspCameras.filter((camera) => camera.ip !== id))
      } else if (type === "sensor") {
        if (eventSources.current[id as number]) {
          eventSources.current[id as number].close()
          delete eventSources.current[id as number]
        }
        if (reconnectTimeouts.current[id as number]) {
          clearTimeout(reconnectTimeouts.current[id as number])
          delete reconnectTimeouts.current[id as number]
        }
        await deleteSensor(id as number)
        setSensors(sensors.filter((sensor) => sensor.gpio_pin_number !== id))
      }
    } catch (error) {
      setErrorMessage(`Failed to delete ${type}`)
    }
  }

  const handleSaveDevice = async (device: CameraInputDto | SensorInputDto) => {
    try {
      if (deviceType === "camera") {
        const camera = device as CameraInputDto
        if (isCreating) {
          const newCamera = await createRTSPCamera(camera)
          setRtspCameras([...rtspCameras, newCamera])
        }
      } else if (deviceType === "sensor") {
        const sensor = device as SensorInputDto
        if (isCreating) {
          const newSensor = await createSensor(sensor)
          setSensors([...sensors, newSensor])
        } else {
          const updatedSensor = await updateSensor(sensor.gpio_pin_number, sensor)
          setSensors(sensors.map((s) => (s.gpio_pin_number === updatedSensor.gpio_pin_number ? updatedSensor : s)))
        }
      }
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage(`Failed to ${isCreating ? "create" : "update"} ${deviceType}`)
    }
  }

  const getStatusDisplay = (gpioPin: number): string => {
    const status = sensorStatuses[gpioPin]
    const connection = connectionStatus[gpioPin]

    if (connection === 'connecting') return "Connecting..."
    if (connection === 'error' && streamErrors[gpioPin] > 3) return "Connection Error"
    if (!status || status === "UNKNOWN") return "Unknown"

    return status
  }

  const getStatusColor = (gpioPin: number): string => {
    const connection = connectionStatus[gpioPin]
    const status = sensorStatuses[gpioPin]

    if (connection === 'error' && streamErrors[gpioPin] > 3) return "text-red-500"
    if (connection === 'connecting') return "text-yellow-500"
    if (!status || status === "UNKNOWN") return "text-gray-500"
    if (status === "HIGH") return "text-red-500"

    return "text-zinc-300"
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-zinc-50 mb-4">Devices</h1>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
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
              {canModifyDevices && (
                <CardFooter className="flex flex-col mt-auto">
                  <div className="flex w-full">
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
                  </div>
                </CardFooter>
              )}
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">Sensors</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice("sensor")}
          >
            Add sensor
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingSensors ? (
          <p className="text-zinc-300">Loading sensors...</p>
        ) : sensors.length === 0 ? (
          <p className="text-zinc-300">No sensors found.</p>
        ) : (
          sensors.map((sensor) => (
            <Card key={sensor.gpio_pin_number} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50 flex justify-between items-center">
                  <span>{sensor.name}</span>
                  {streamErrors[sensor.gpio_pin_number] > 3 && (
                    <span className="text-xs text-yellow-500" title="Connection issues detected">⚠️</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-zinc-300">GPIO: {sensor.gpio_pin_number}</p>
                <p className={`mt-6 ${getStatusColor(sensor.gpio_pin_number)}`}>
                  Current Status: {getStatusDisplay(sensor.gpio_pin_number)}
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
                            onClick={() => handleDeleteDevice(sensor.gpio_pin_number, "sensor")}
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Add" : "Edit"} {deviceType === "camera" ? "Camera" : "Sensor"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (editingDevice) {
                handleSaveDevice(editingDevice)
              }
            }}
          >
            <div className="space-y-4">
              <Input
                placeholder="Name"
                value={editingDevice?.name || ""}
                onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              {deviceType === "camera" ? (
                <>
                  <Input
                    placeholder="IP"
                    value={(editingDevice as CameraInputDto)?.ip || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, ip: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                    disabled={!isCreating}
                  />
                  <Input
                    type="number"
                    placeholder="Port"
                    value={(editingDevice as CameraInputDto)?.port || ""}
                    onChange={(e) =>
                      setEditingDevice((prev) => (prev ? { ...prev, port: Number.parseInt(e.target.value) } : null))
                    }
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    placeholder="Username"
                    value={(editingDevice as CameraInputDto)?.username || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, username: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={(editingDevice as CameraInputDto)?.password || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, password: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    placeholder="Path"
                    value={(editingDevice as CameraInputDto)?.path || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, path: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
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
                  />
                </>
              )}
              <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                {isCreating ? "Create" : "Update"}
              </Button>
            </div>
          </form>
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