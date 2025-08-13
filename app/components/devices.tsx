"use client"

import { useState, useEffect } from "react"
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
  getSensorCurrentStatus,
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

  const canModifyDevices = permissions.includes(Permission.MODIFY_DEVICES)

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
    const fetchSensorStatuses = async () => {
      for (const sensor of sensors) {
        try {
          const status = await getSensorCurrentStatus(sensor.gpio_pin_number)
          setSensorStatuses((prev) => ({
            ...prev,
            [sensor.gpio_pin_number]: status,
          }))
        } catch (error) {
          console.error(`Failed to fetch status for sensor ${sensor.gpio_pin_number}:`, error)
          setSensorStatuses((prev) => ({
            ...prev,
            [sensor.gpio_pin_number]: "LOW" as SensorStatus,
          }))
        }
      }
    }

    fetchSensorStatuses()

    return () => {}
  }, [sensors])

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
                <CardTitle className="text-zinc-50">{sensor.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-zinc-300">GPIO: {sensor.gpio_pin_number}</p>
                <p className="text-zinc-300 mt-6">
                  Current Status: {sensorStatuses[sensor.gpio_pin_number] || "Loading..."}
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
