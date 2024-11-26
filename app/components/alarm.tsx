'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getDeviceGroups, createDeviceGroup, updateDeviceGroup, deleteDeviceGroup, getAllRtspCameras, getAllMagneticReeds, getDeviceGroupCameras, getDeviceGroupReeds, updateDeviceGroupCameras, updateDeviceGroupReeds } from "@/lib/api"
import { DeviceGroup, RTSPCamera, MagneticReed, Permission, DeviceGroupStatus } from "@/types"

type AlarmProps = {
  permissions: Permission[]
}

type DeviceGroupInputDto = DeviceGroup & {
  id?: number;
};

export default function Alarm({ permissions }: AlarmProps) {
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[] | null>(null)
  const [allCameras, setAllCameras] = useState<RTSPCamera[]>([])
  const [allReeds, setAllReeds] = useState<MagneticReed[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<DeviceGroupInputDto | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [groupCameras, setGroupCameras] = useState<{ [key: number]: RTSPCamera[] }>({})
  const [groupReeds, setGroupReeds] = useState<{ [key: number]: MagneticReed[] }>({})
  const [selectedCameras, setSelectedCameras] = useState<RTSPCamera[]>([])
  const [selectedReeds, setSelectedReeds] = useState<MagneticReed[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const groups = await getDeviceGroups()
        setDeviceGroups(groups)
        const cameras = await getAllRtspCameras()
        setAllCameras(cameras)
        const reeds = await getAllMagneticReeds()
        setAllReeds(reeds)

        // Fetch cameras and reeds for each group
        const camerasPromises = groups.map(group => getDeviceGroupCameras(group.id))
        const reedsPromises = groups.map(group => getDeviceGroupReeds(group.id))

        const groupCamerasData = await Promise.all(camerasPromises)
        const groupReedsData = await Promise.all(reedsPromises)

        const newGroupCameras: { [key: number]: RTSPCamera[] } = {}
        const newGroupReeds: { [key: number]: MagneticReed[] } = {}

        groups.forEach((group, index) => {
          newGroupCameras[group.id] = groupCamerasData[index]
          newGroupReeds[group.id] = groupReedsData[index]
        })

        setGroupCameras(newGroupCameras)
        setGroupReeds(newGroupReeds)
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setErrorMessage("Failed to fetch device groups, cameras, and reeds. Please try again later.");
        setDeviceGroups([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await deleteDeviceGroup(id)
      setDeviceGroups(prevGroups => prevGroups?.filter(group => group.id !== id) || [])
      setGroupCameras(prev => {
        const newGroupCameras = { ...prev }
        delete newGroupCameras[id]
        return newGroupCameras
      })
      setGroupReeds(prev => {
        const newGroupReeds = { ...prev }
        delete newGroupReeds[id]
        return newGroupReeds
      })
    } catch (error) {
      setErrorMessage("Failed to delete device group")
    }
  }

  const handleAddGroup = () => {
    setEditingGroup({ name: "", wait_to_start_alarm: 0, wait_to_fire_alarm: 0 })
    setSelectedCameras([])
    setSelectedReeds([])
    setIsDialogOpen(true)
  }

  const handleEditGroup = (group: DeviceGroup) => {
    setEditingGroup({
      ...group,
    })
    setSelectedCameras(groupCameras[group.id] || [])
    setSelectedReeds(groupReeds[group.id] || [])
    setIsDialogOpen(true)
  }

  const handleSaveGroup = async (updatedGroup: DeviceGroupInputDto) => {
    try {
      if (editingGroup) {
        const existingGroup = deviceGroups?.find(g => g.id === editingGroup.id)
        if (existingGroup) {
          const updatedGroupResponse = await updateDeviceGroup(existingGroup.id, {
            ...existingGroup,
            ...updatedGroup,
          })
          setDeviceGroups(prevGroups => prevGroups?.map(group => group.id === updatedGroupResponse.id ? updatedGroupResponse : group) || [])

          // Update cameras and reeds
          const updatedCameras = await updateDeviceGroupCameras(existingGroup.id, selectedCameras.map(c => c.ip))
          const updatedReeds = await updateDeviceGroupReeds(existingGroup.id, selectedReeds.map(r => r.gpio_pin_number))

          setGroupCameras(prev => ({ ...prev, [existingGroup.id]: updatedCameras }))
          setGroupReeds(prev => ({ ...prev, [existingGroup.id]: updatedReeds }))
        } else {
          const newGroup = await createDeviceGroup(updatedGroup)
          setDeviceGroups(prevGroups => [...(prevGroups || []), newGroup])

          // Add cameras and reeds to the new group
          const newCameras = await updateDeviceGroupCameras(newGroup.id, selectedCameras.map(c => c.ip))
          const newReeds = await updateDeviceGroupReeds(newGroup.id, selectedReeds.map(r => r.gpio_pin_number))

          setGroupCameras(prev => ({ ...prev, [newGroup.id]: newCameras }))
          setGroupReeds(prev => ({ ...prev, [newGroup.id]: newReeds }))
        }
      }
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage("Failed to save device group")
    }
  }

  const getStatusColor = (status: DeviceGroupStatus) => {
    switch (status) {
      case DeviceGroupStatus.LISTENING:
        return "text-green-500";
      case DeviceGroupStatus.IDLE:
        return "text-grey-500";
      case DeviceGroupStatus.ALARM:
        return "text-red-500";
      case DeviceGroupStatus.WAITING_TO_START_LISTENING:
        return "text-yellow-500";
      default:
        return "text-zinc-300";
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
        <h1 className="text-3xl font-bold text-zinc-50 mb-2 sm:mb-0">Alarm dashboard</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
                variant="outline"
                className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                onClick={() => handleAddGroup()}
              >
                Add group
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-800 text-zinc-50">
            <DialogHeader>
              <DialogTitle>{editingGroup?.name ? "Edit group" : "Add group"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault()
              if (editingGroup) {
                handleSaveGroup(editingGroup)
              }
            }}>
              <div className="space-y-4">
                <Input
                  placeholder="Group name"
                  value={editingGroup?.name || ""}
                  onChange={(e) => setEditingGroup(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                />
                <Input
                  type="number"
                  placeholder="Wait to start alarm (seconds)"
                  value={editingGroup?.wait_to_start_alarm || ""}
                  onChange={(e) => setEditingGroup(prev => prev ? {...prev, wait_to_start_alarm: parseInt(e.target.value)} : null)}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                />
                <Input
                  type="number"
                  placeholder="Wait to fire alarm (seconds)"
                  value={editingGroup?.wait_to_fire_alarm || ""}
                  onChange={(e) => setEditingGroup(prev => prev ? {...prev, wait_to_fire_alarm: parseInt(e.target.value)} : null)}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                />
                <div>
                  <h3 className="mb-2 font-semibold text-zinc-300">Cameras</h3>
                  {allCameras.map(camera => (
                    <div key={camera.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`camera-${camera.id}`}
                        checked={selectedCameras.some(c => c.id === camera.id)}
                        onCheckedChange={(checked) => {
                          setSelectedCameras(prev =>
                            checked
                              ? [...prev, camera]
                              : prev.filter(c => c.id !== camera.id)
                          )
                        }}
                        className="border-zinc-500"
                      />
                      <label htmlFor={`camera-${camera.id}`} className="text-zinc-300">{camera.name}</label>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="mb-2 font-semibold text-zinc-300">Reeds</h3>
                  {allReeds.map(reed => (
                    <div key={reed.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`reed-${reed.id}`}
                        checked={selectedReeds.some(r => r.id === reed.id)}
                        onCheckedChange={(checked) => {
                          setSelectedReeds(prev =>
                            checked
                              ? [...prev, reed]
                              : prev.filter(r => r.id !== reed.id)
                          )
                        }}
                        className="border-zinc-500"
                      />
                      <label htmlFor={`reed-${reed.id}`} className="text-zinc-300">{reed.name}</label>
                    </div>
                  ))}
                </div>
                <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                  {editingGroup?.name ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <p>Loading device groups...</p>
      ) : deviceGroups === null || deviceGroups.length === 0 ? (
        <p>No device groups found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deviceGroups.map((group) => (
            <Card key={group.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50">{group.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className={`${getStatusColor(group.status)} font-semibold`}>Status: {group.status}</p>
                <p className="text-zinc-300">Wait to start alarm: {group.wait_to_start_alarm}s</p>
                <p className="text-zinc-300">Wait to fire alarm: {group.wait_to_fire_alarm}s</p>
                <h3 className="mt-2 font-semibold text-zinc-300">Cameras:</h3>
                <ul className="list-disc pl-5 text-zinc-300">
                  {groupCameras[group.id]?.map((camera) => (
                    <li key={camera.id}>{camera.name}</li>
                  ))}
                </ul>
                <h3 className="mt-2 font-semibold text-zinc-300">Reeds:</h3>
                <ul className="list-disc pl-5 text-zinc-300">
                  {groupReeds[group.id]?.map((reed) => (
                    <li key={reed.id}>{reed.name}</li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col mt-auto">
                <div className="flex w-full mb-2">
                  <Button variant="outline" className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={() => handleEditGroup(group)}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1 ml-1 bg-red-900 hover:bg-red-800">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the device group.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(group.id)} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
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

