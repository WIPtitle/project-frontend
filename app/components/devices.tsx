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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  getAllRtspCameras,
  getAllMagneticReeds,
  createRTSPCamera,
  createMagneticReed,
  updateMagneticReed,
  deleteRTSPCamera,
  deleteMagneticReed,
  getReedCurrentStatus,
  getAllPirs,
  createPir,
  updatePir,
  deletePir,
  getPirCurrentStatus,
} from "@/lib/api"
import { type RTSPCamera, type MagneticReed, Permission, type Pir } from "@/types"

// Define PirStatus enum here since we need it as a value
enum PirStatus {
  MOVEMENT = "MOVEMENT",
  IDLE = "IDLE",
}

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

type ReedInputDto = {
  name: string
  gpio_pin_number: number
  vcc: boolean
  normally_closed: boolean
}

type PirInputDto = {
  name: string
  gpio_pin_number: number
}

export default function Component({ permissions }: DeviceProps) {
  const [rtspCameras, setRtspCameras] = useState<RTSPCamera[]>([])
  const [magneticReeds, setMagneticReeds] = useState<MagneticReed[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<CameraInputDto | ReedInputDto | PirInputDto | null>(null)
  const [deviceType, setDeviceType] = useState<"camera" | "reed" | "pir">("camera")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reedStatuses, setReedStatuses] = useState<Record<number, string>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingCameras, setIsLoadingCameras] = useState(true)
  const [isLoadingReeds, setIsLoadingReeds] = useState(true)
  const [pirs, setPirs] = useState<Pir[]>([])
  const [pirStatuses, setPirStatuses] = useState<Record<number, PirStatus>>({})
  const [isLoadingPirs, setIsLoadingPirs] = useState(true)

  const canModifyDevices = permissions.includes(Permission.MODIFY_DEVICES)

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setIsLoadingCameras(true)
        setIsLoadingReeds(true)
        setIsLoadingPirs(true)
        const cameras = await getAllRtspCameras()
        const reeds = await getAllMagneticReeds()
        const pirSensors = await getAllPirs()
        setRtspCameras(cameras)
        setMagneticReeds(reeds)
        setPirs(pirSensors)
      } catch (error) {
        setErrorMessage("Failed to fetch devices")
      } finally {
        setIsLoadingCameras(false)
        setIsLoadingReeds(false)
        setIsLoadingPirs(false)
      }
    }
    fetchDevices()
  }, [])

  useEffect(() => {
    const fetchReedStatuses = async () => {
      const newStatuses: Record<number, string> = {}
      for (const reed of magneticReeds) {
        try {
          // Explicitly await the Promise<string> returned by getReedCurrentStatus
          const status = await getReedCurrentStatus(reed.gpio_pin_number)
          // Immediately update the status for this reed
          setReedStatuses((prev) => ({
            ...prev,
            [reed.gpio_pin_number]: status,
          }))
        } catch (error) {
          console.error(`Failed to fetch status for reed ${reed.gpio_pin_number}:`, error)
          setReedStatuses((prev) => ({
            ...prev,
            [reed.gpio_pin_number]: "Error",
          }))
        }
      }
    }

    fetchReedStatuses()

    return () => {}
  }, [magneticReeds])

  useEffect(() => {
    const fetchPirStatuses = async () => {
      const newStatuses: Record<number, PirStatus> = {}
      for (const pir of pirs) {
        try {
          const status = await getPirCurrentStatus(pir.gpio_pin_number)
          setPirStatuses((prev) => ({
            ...prev,
            [pir.gpio_pin_number]: status,
          }))
        } catch (error) {
          console.error(`Failed to fetch status for PIR ${pir.gpio_pin_number}:`, error)
          setPirStatuses((prev) => ({
            ...prev,
            [pir.gpio_pin_number]: PirStatus.IDLE,
          }))
        }
      }
    }

    fetchPirStatuses()

    return () => {}
  }, [pirs])

  const handleAddDevice = (type: "camera" | "reed" | "pir") => {
    setDeviceType(type)
    setEditingDevice(
      type === "camera"
        ? { name: "", ip: "", port: 0, username: "", password: "", path: "", always_recording: false }
        : type === "reed"
          ? { name: "", gpio_pin_number: 0, vcc: true, normally_closed: false }
          : { name: "", gpio_pin_number: 0 },
    )
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleEditDevice = (device: RTSPCamera | MagneticReed | Pir, type: "camera" | "reed" | "pir") => {
    if (type === "reed" || type === "pir") {
      setDeviceType(type)
      setEditingDevice(device)
      setIsCreating(false)
      setIsDialogOpen(true)
    }
  }

  const handleDeleteDevice = async (id: string | number, type: "camera" | "reed" | "pir") => {
    try {
      if (type === "camera") {
        await deleteRTSPCamera(id as string)
        setRtspCameras(rtspCameras.filter((camera) => camera.ip !== id))
      } else if (type === "reed") {
        await deleteMagneticReed(id as number)
        setMagneticReeds(magneticReeds.filter((reed) => reed.gpio_pin_number !== id))
      } else if (type === "pir") {
        await deletePir(id as number)
        setPirs(pirs.filter((pir) => pir.gpio_pin_number !== id))
      }
    } catch (error) {
      setErrorMessage(`Failed to delete ${type}`)
    }
  }

  const handleSaveDevice = async (device: CameraInputDto | ReedInputDto | PirInputDto) => {
    try {
      if (deviceType === "camera") {
        const camera = device as CameraInputDto
        if (isCreating) {
          const newCamera = await createRTSPCamera(camera)
          setRtspCameras([...rtspCameras, newCamera])
        }
      } else if (deviceType === "reed") {
        const reed = device as ReedInputDto
        if (isCreating) {
          const newReed = await createMagneticReed(reed)
          setMagneticReeds([...magneticReeds, newReed])
        } else {
          const updatedReed = await updateMagneticReed(reed.gpio_pin_number, reed)
          setMagneticReeds(
            magneticReeds.map((r) => (r.gpio_pin_number === updatedReed.gpio_pin_number ? updatedReed : r)),
          )
        }
      } else if (deviceType === "pir") {
        const pir = device as PirInputDto
        if (isCreating) {
          const newPir = await createPir(pir)
          setPirs([...pirs, newPir])
        } else {
          const updatedPir = await updatePir(pir.gpio_pin_number, pir)
          setPirs(pirs.map((p) => (p.gpio_pin_number === updatedPir.gpio_pin_number ? updatedPir : p)))
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
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">Magnetic reeds</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice("reed")}
          >
            Add reed
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingReeds ? (
          <p className="text-zinc-300">Loading magnetic reeds...</p>
        ) : magneticReeds.length === 0 ? (
          <p className="text-zinc-300">No magnetic reeds found.</p>
        ) : (
          magneticReeds.map((reed) => (
            <Card key={reed.gpio_pin_number} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50">{reed.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-zinc-300">GPIO: {reed.gpio_pin_number}</p>
                <p className="text-zinc-300">Normally: {reed.normally_closed ? "Closed" : "Open"}</p>
                <p className="text-zinc-300">Connected to: {reed.vcc ? "VCC" : "GND"}</p>
                <p className="text-zinc-300 mt-6">
                  Current Status: {reedStatuses[reed.gpio_pin_number] || "Loading..."}
                </p>
              </CardContent>
              {canModifyDevices && (
                <CardFooter className="flex flex-col mt-auto">
                  <div className="flex w-full">
                    <Button
                      variant="outline"
                      className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                      onClick={() => handleEditDevice(reed, "reed")}
                      disabled={reed.listening}
                    >
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="flex-1 ml-1 bg-red-900 hover:bg-red-800"
                          disabled={reed.listening}
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the magnetic reed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDevice(reed.gpio_pin_number, "reed")}
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

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 mt-8">
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">PIR Sensors</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice("pir")}
          >
            Add PIR sensor
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingPirs ? (
          <p className="text-zinc-300">Loading PIR sensors...</p>
        ) : pirs.length === 0 ? (
          <p className="text-zinc-300">No PIR sensors found.</p>
        ) : (
          pirs.map((pir) => (
            <Card key={pir.gpio_pin_number} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50">{pir.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-zinc-300">GPIO: {pir.gpio_pin_number}</p>
                <p className="text-zinc-300 mt-6">Current Status: {pirStatuses[pir.gpio_pin_number] || "Loading..."}</p>
              </CardContent>
              {canModifyDevices && (
                <CardFooter className="flex flex-col mt-auto">
                  <div className="flex w-full">
                    <Button
                      variant="outline"
                      className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                      onClick={() => handleEditDevice(pir, "pir")}
                      disabled={pir.listening}
                    >
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="flex-1 ml-1 bg-red-900 hover:bg-red-800"
                          disabled={pir.listening}
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the PIR sensor.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDevice(pir.gpio_pin_number, "pir")}
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
              {isCreating ? "Add" : "Edit"}{" "}
              {deviceType === "camera" ? "Camera" : deviceType === "reed" ? "Magnetic Reed" : "PIR Sensor"}
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
              ) : deviceType === "reed" ? (
                <>
                  <Input
                    type="number"
                    placeholder="GPIO Pin Number"
                    value={(editingDevice as ReedInputDto)?.gpio_pin_number || ""}
                    onChange={(e) =>
                      setEditingDevice((prev) =>
                        prev ? { ...prev, gpio_pin_number: Number.parseInt(e.target.value) } : null,
                      )
                    }
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                    disabled={!isCreating}
                  />
                  <Select
                    value={String((editingDevice as ReedInputDto)?.normally_closed)}
                    onValueChange={(value) =>
                      setEditingDevice((prev) => (prev ? { ...prev, normally_closed: value === "true" } : null))
                    }
                  >
                    <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 text-zinc-50">
                      <SelectItem value="true">Normally closed</SelectItem>
                      <SelectItem value="false">Normally open</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String((editingDevice as ReedInputDto)?.vcc)}
                    onValueChange={(value) =>
                      setEditingDevice((prev) => (prev ? { ...prev, vcc: value === "true" } : null))
                    }
                  >
                    <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 text-zinc-50">
                      <SelectItem value="true">Connected to VCC</SelectItem>
                      <SelectItem value="false">Connected to GND</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    placeholder="GPIO Pin Number"
                    value={(editingDevice as PirInputDto)?.gpio_pin_number || ""}
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

