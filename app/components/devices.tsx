'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAllRtspCameras, getAllMagneticReeds, createRTSPCamera, createMagneticReed, updateRTSPCamera, updateMagneticReed, deleteRTSPCamera, deleteMagneticReed, getReedCurrentStatus } from "@/lib/api"
import { RTSPCamera, MagneticReed, Permission } from "@/types"

type DeviceProps = {
  permissions: Permission[]
}

export default function Devices({ permissions }: DeviceProps) {
  const [rtspCameras, setRtspCameras] = useState<RTSPCamera[]>([])
  const [magneticReeds, setMagneticReeds] = useState<MagneticReed[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<RTSPCamera | MagneticReed | null>(null)
  const [deviceType, setDeviceType] = useState<'camera' | 'reed'>('camera')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  const handleAddDevice = (type: 'camera' | 'reed') => {
    setDeviceType(type)
    setEditingDevice(type === 'camera' ? { id: 0, name: "", ip: "", port: 0, username: "", password: "" } : { id: 0, name: "", gpio: 0, normally_open: true })
    setIsDialogOpen(true)
  }

  const handleEditDevice = (device: RTSPCamera | MagneticReed, type: 'camera' | 'reed') => {
    setDeviceType(type)
    setEditingDevice(device)
    setIsDialogOpen(true)
  }

  const handleDeleteDevice = async (id: number, type: 'camera' | 'reed') => {
    try {
      if (type === 'camera') {
        await deleteRTSPCamera(id)
        setRtspCameras(rtspCameras.filter(camera => camera.id !== id))
      } else {
        await deleteMagneticReed(id)
        setMagneticReeds(magneticReeds.filter(reed => reed.id !== id))
      }
    } catch (error) {
      setErrorMessage(`Failed to delete ${type}`)
    }
  }

  const handleSaveDevice = async (device: RTSPCamera | MagneticReed) => {
    try {
      if (deviceType === 'camera') {
        const camera = device as RTSPCamera
        if (camera.id === 0) {
          const newCamera = await createRTSPCamera(camera)
          setRtspCameras([...rtspCameras, newCamera])
        } else {
          const updatedCamera = await updateRTSPCamera(camera.id, camera)
          setRtspCameras(rtspCameras.map(c => c.id === updatedCamera.id ? updatedCamera : c))
        }
      } else {
        const reed = device as MagneticReed
        if (reed.id === 0) {
          const newReed = await createMagneticReed(reed)
          setMagneticReeds([...magneticReeds, newReed])
        } else {
          const updatedReed = await updateMagneticReed(reed.id, reed)
          setMagneticReeds(magneticReeds.map(r => r.id === updatedReed.id ? updatedReed : r))
        }
      }
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage(`Failed to save ${deviceType}`)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-zinc-50 mb-4">Devices</h1>

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50">RTSP cameras</h2>
        </div>
        {canModifyDevices && (
          <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={() => handleAddDevice('camera')}>Add Camera</Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {rtspCameras.map((camera) => (
          <Card key={camera.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
            <CardHeader>
              <CardTitle className="text-zinc-50">{camera.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              {canAccessStreamCameras ? (
                <div className="aspect-video bg-zinc-700 flex items-center justify-center text-zinc-400">
                  Connection failed
                </div>
              ) : (
                <p className="text-zinc-400">No access to camera stream</p>
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
                        <AlertDialogAction onClick={() => handleDeleteDevice(camera.id, 'camera')} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50">Magnetic reeds</h2>
        </div>
        {canModifyDevices && (
          <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={() => handleAddDevice('reed')}>Add Reed</Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {magneticReeds.map((reed) => (
          <Card key={reed.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
            <CardHeader>
              <CardTitle className="text-zinc-50">{reed.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-zinc-300">GPIO: {reed.gpio_pin_number}</p>
              <p className="text-zinc-300">Type: {reed.normally_open ? "Normally Open" : "Normally Closed"}</p>
              <p className="text-zinc-300 mt-8">Current Status: {getReedCurrentStatus(reed.id) == "OPEN" ? "OPEN" : "CLOSED"}</p>
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
                        <AlertDialogAction onClick={() => handleDeleteDevice(reed.id, 'reed')} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
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
            <DialogTitle>{editingDevice?.id ? "Edit" : "Add"} {deviceType === 'camera' ? "Camera" : "Magnetic Reed"}</DialogTitle>
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
                    value={(editingDevice as RTSPCamera)?.ip || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, ip: e.target.value} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    type="number"
                    placeholder="Port"
                    value={(editingDevice as RTSPCamera)?.port || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, port: parseInt(e.target.value)} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    placeholder="Username"
                    value={(editingDevice as RTSPCamera)?.username || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, username: e.target.value} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={(editingDevice as RTSPCamera)?.password || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, password: e.target.value} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    placeholder="GPIO"
                    value={(editingDevice as MagneticReed)?.gpio || ""}
                    onChange={(e) => setEditingDevice(prev => prev ? {...prev, gpio: parseInt(e.target.value)} : null)}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  />
                  <Select
                    value={(editingDevice as MagneticReed)?.normally_open ? "open" : "closed"}
                    onValueChange={(value) => setEditingDevice(prev => prev ? {...prev, normally_open: value === "open"} : null)}
                  >
                    <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 text-zinc-50">
                      <SelectItem value="open">Normally Open</SelectItem>
                      <SelectItem value="closed">Normally Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                {editingDevice?.id ? "Update" : "Create"}
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