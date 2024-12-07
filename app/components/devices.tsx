'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAllRtspCameras, getAllMagneticReeds, createRTSPCamera, createMagneticReed, updateRTSPCamera, updateMagneticReed, deleteRTSPCamera, deleteMagneticReed, getReedCurrentStatus, getRTSPCameraStreamUrl } from "@/lib/api"
import { RTSPCamera, MagneticReed, Permission } from "@/types"

type DeviceProps = {
  permissions: Permission[]
}

type CameraInputDto = {
  name: string;
  ip: string;
  port: number;
  username: string;
  password: string;
  path: string;
  sensibility: number;
}

type ReedInputDto = {
  name: string;
  gpio_pin_number: number;
  default_value_when_closed: "HIGH" | "LOW";
}


export default function Component({ permissions }: DeviceProps) {
  const [rtspCameras, setRtspCameras] = useState<RTSPCamera[]>([])
  const [magneticReeds, setMagneticReeds] = useState<MagneticReed[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<CameraInputDto | ReedInputDto | null>(null)
  const [deviceType, setDeviceType] = useState<'camera' | 'reed'>('camera')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reedStatuses, setReedStatuses] = useState<Record<number, string>>({})
  const [isCreating, setIsCreating] = useState(false);

  const canModifyDevices = permissions.includes(Permission.MODIFY_DEVICES)
  const canAccessStreamCameras = permissions.includes(Permission.ACCESS_STREAM_CAMERAS)

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const cameras = await getAllRtspCameras()
        const reeds = await getAllMagneticReeds()
        setRtspCameras(cameras)
        setMagneticReeds(reeds)
      } catch (error) {
        setErrorMessage("Failed to fetch devices")
      }
    }
    fetchDevices()
  }, [])

  useEffect(() => {
    const fetchReedStatuses = async () => {
      const statusPromises = magneticReeds.map(async (reed) => {
        const status = await getReedCurrentStatus(reed.gpio_pin_number)
        return [reed.gpio_pin_number, status]
      })
      const statuses = await Promise.all(statusPromises)
      setReedStatuses(Object.fromEntries(statuses))
    }

    fetchReedStatuses()
  }, [magneticReeds])


  const handleAddDevice = (type: 'camera' | 'reed') => {
    setDeviceType(type);
    setEditingDevice(type === 'camera'
      ? { name: "", ip: "", port: 0, username: "", password: "", path: "", sensibility: 0 }
      : { name: "", gpio_pin_number: 0, default_value_when_closed: "HIGH" });
    setIsCreating(true);
    setIsDialogOpen(true);
  }

  const handleEditDevice = (device: RTSPCamera | MagneticReed, type: 'camera' | 'reed') => {
    setDeviceType(type);
    setEditingDevice(device);
    setIsCreating(false);
    setIsDialogOpen(true);
  }

  const handleDeleteDevice = async (id: string | number, type: 'camera' | 'reed') => {
    try {
      if (type === 'camera') {
        await deleteRTSPCamera(id as string)
        setRtspCameras(rtspCameras.filter(camera => camera.ip !== id))
      } else {
        await deleteMagneticReed(id as number)
        setMagneticReeds(magneticReeds.filter(reed => reed.gpio_pin_number !== id))
      }
    } catch (error) {
      setErrorMessage(`Failed to delete ${type}`)
    }
  }

  const handleSaveDevice = async (device: CameraInputDto | ReedInputDto) => {
    try {
      if (deviceType === 'camera') {
        const camera = device as CameraInputDto;
        if (isCreating) {
          const newCamera = await createRTSPCamera(camera);
          setRtspCameras([...rtspCameras, newCamera]);
        } else {
          const updatedCamera = await updateRTSPCamera(camera.ip, camera);
          setRtspCameras(rtspCameras.map(c => c.ip === updatedCamera.ip ? updatedCamera : c));
        }
      } else {
        const reed = device as ReedInputDto;
        if (isCreating) {
          const newReed = await createMagneticReed(reed);
          setMagneticReeds([...magneticReeds, newReed]);
        } else {
          const updatedReed = await updateMagneticReed(reed.gpio_pin_number, reed);
          setMagneticReeds(magneticReeds.map(r => r.gpio_pin_number === updatedReed.gpio_pin_number ? updatedReed : r));
        }
      }
      setIsDialogOpen(false);
    } catch (error) {
      setErrorMessage(`Failed to ${isCreating ? 'create' : 'update'} ${deviceType}`);
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
            onClick={() => handleAddDevice('camera')}
          >
            Add camera
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {rtspCameras.map((camera) => (
          <Card key={camera.ip} className="bg-zinc-800 border-zinc-700 flex flex-col">
            <CardHeader>
              <CardTitle className="text-zinc-50">{camera.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              {canAccessStreamCameras ? (
                <img
                    src={getRTSPCameraStreamUrl(camera.ip)}
                    className="w-full h-full object-cover"
                    alt="Camera Stream"
                />
              ) : (
                <div className="aspect-video bg-zinc-700 flex items-center justify-center text-zinc-400">
                  No access to camera stream
                </div>
              )}
              <p className="text-zinc-300 mt-2">IP: {camera.ip}</p>
            </CardContent>
            {canModifyDevices && (
              <CardFooter className="flex flex-col mt-auto">
                <div className="flex w-full">
                  <Button variant="outline" className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={() => handleEditDevice(camera, 'camera')}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1 ml-1 bg-red-900 hover:bg-red-800">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the camera.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteDevice(camera.ip, 'camera')} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">Magnetic reeds</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice('reed')}
          >
            Add reed
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {magneticReeds.map((reed) => (
          <Card key={reed.gpio_pin_number} className="bg-zinc-800 border-zinc-700 flex flex-col">
            <CardHeader>
              <CardTitle className="text-zinc-50">{reed.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-zinc-300">GPIO: {reed.gpio_pin_number}</p>
              <p className="text-zinc-300">Type: {reed.default_value_when_closed === "HIGH" ? "Normally Open" : "Normally Closed"}</p>
              <p className="text-zinc-300 mt-8">Current Status: {reedStatuses[reed.gpio_pin_number] || 'Loading...'}</p>
            </CardContent>
            {canModifyDevices && (
              <CardFooter className="flex flex-col mt-auto">
                <div className="flex w-full">
                  <Button variant="outline" className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={() => handleEditDevice(reed, 'reed')}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1 ml-1 bg-red-900 hover:bg-red-800">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the magnetic reed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteDevice(reed.gpio_pin_number, 'reed')} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Add" : "Edit"} {deviceType === 'camera' ? "Camera" : "Magnetic Reed"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (editingDevice) {
              handleSaveDevice(editingDevice)
            }
          }}>
            <div className="space-y-4">
              <Input
                placeholder="Name"
                value={editingDevice?.name || ""}
                onChange={(e) => setEditingDevice(prev => prev ? {...prev, name: e.target.value} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              {deviceType === 'camera' ? (
                <>
                  <Input
                    placeholder="IP"
                    value={(editingDevice as CameraInputDto)?.ip || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, ip: e.target.value} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    type="number"
                    placeholder="Port"
                    value={(editingDevice as CameraInputDto)?.port || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, port: parseInt(e.target.value)} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    placeholder="Username"
                    value={(editingDevice as CameraInputDto)?.username || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, username: e.target.value} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={(editingDevice as CameraInputDto)?.password || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, password: e.target.value} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    placeholder="Path"
                    value={(editingDevice as CameraInputDto)?.path || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, path: e.target.value} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    type="number"
                    placeholder="Sensibility"
                    value={(editingDevice as CameraInputDto)?.sensibility || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, sensibility: parseInt(e.target.value)} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    placeholder="GPIO Pin Number"
                    value={(editingDevice as ReedInputDto)?.gpio_pin_number || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, gpio_pin_number: parseInt(e.target.value)} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Select
                    value={(editingDevice as ReedInputDto)?.default_value_when_closed}
                    onValueChange={(value: 'HIGH' | 'LOW') => setEditingDevice(prev => prev ? {...prev, default_value_when_closed: value} : null)}
                  >
                    <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 text-zinc-50">
                      <SelectItem value="HIGH">Normally Open</SelectItem>
                      <SelectItem value="LOW">Normally Closed</SelectItem>
                    </SelectContent>
                  </Select>
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
        <AlertDialogContent  className="bg-zinc-800 text-zinc-50">
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

