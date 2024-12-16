'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getDeviceGroups, createDeviceGroup, updateDeviceGroup, deleteDeviceGroup, getAllRtspCameras, getAllMagneticReeds, getDeviceGroupCameras, getDeviceGroupReeds, updateDeviceGroupCameras, updateDeviceGroupReeds, startListening, stopListening } from "@/lib/api"
import { DeviceGroup, RTSPCamera, MagneticReed, Permission, DeviceGroupStatus } from "@/types"

const statusMapping: Record<DeviceGroupStatus, string> = {
  [DeviceGroupStatus.LISTENING]: "Active",
  [DeviceGroupStatus.IDLE]: "Inactive",
  [DeviceGroupStatus.ALARM]: "Alarm Triggered",
  [DeviceGroupStatus.WAITING_TO_START_LISTENING]: "Activating",
};

type AlarmProps = {
  permissions: Permission[]
}

type DeviceGroupInputDto = DeviceGroup & {
  id?: number;
};

export const getAvailableCameras = (cameras: RTSPCamera[], groupId: number | null): RTSPCamera[] => {
  return cameras.filter(camera => camera.group_id === null || camera.group_id === groupId);
}

export const getAvailableReeds = (reeds: MagneticReed[], groupId: number | null): MagneticReed[] => {
  return reeds.filter(reed => reed.group_id === null || reed.group_id === groupId);
}

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
  const [isActivating, setIsActivating] = useState<{ [key: number]: boolean }>({})
  const [isDeactivating, setIsDeactivating] = useState<{ [key: number]: boolean }>({})
  const [pin, setPin] = useState<string>("")
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [isForceListening, setIsForceListening] = useState(false)
  const [groupError, setGroupError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const groups = await getDeviceGroups()
        setDeviceGroups(groups)

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

  const fetchAllDevices = async () => {
    try {
      const cameras = await getAllRtspCameras()
      const reeds = await getAllMagneticReeds()
      setAllCameras(cameras)
      setAllReeds(reeds)
    } catch (error) {
      console.error("Failed to fetch devices:", error)
      setErrorMessage("Failed to fetch devices. Please try again.")
    }
  }

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

  const handleAddGroup = async () => {
    await fetchAllDevices()
    setEditingGroup({ id: 0, name: "", wait_to_start_alarm: 0, wait_to_fire_alarm: 0, status: DeviceGroupStatus.IDLE })
    setSelectedCameras([])
    setSelectedReeds([])
    setIsDialogOpen(true)
  }

  const handleEditGroup = async (group: DeviceGroup) => {
    await fetchAllDevices()
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

          // Update cameras
          const updatedCameras = await updateDeviceGroupCameras(existingGroup.id, selectedCameras.map(c => c.ip))
          setGroupCameras(prev => ({ ...prev, [existingGroup.id]: updatedCameras }))

          // Update reeds
          const updatedReeds = await updateDeviceGroupReeds(existingGroup.id, selectedReeds.map(r => r.gpio_pin_number))
          setGroupReeds(prev => ({ ...prev, [existingGroup.id]: updatedReeds }))
        } else {
          const newGroup = await createDeviceGroup(updatedGroup)
          setDeviceGroups(prevGroups => [...(prevGroups || []), newGroup])

          // Add cameras to the new group
          const newCameras = await updateDeviceGroupCameras(newGroup.id, selectedCameras.map(c => c.ip))
          setGroupCameras(prev => ({ ...prev, [newGroup.id]: newCameras }))

          // Add reeds to the new group
          const newReeds = await updateDeviceGroupReeds(newGroup.id, selectedReeds.map(r => r.gpio_pin_number))
          setGroupReeds(prev => ({ ...prev, [newGroup.id]: newReeds }))
        }
      }
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage("Failed to save device group")
    }
  }

  const getAvailableCameras = (groupId: number | null) => {
    return allCameras.filter(camera => camera.group_id === null || camera.group_id === groupId);
  }

  const getAvailableReeds = (groupId: number | null) => {
    return allReeds.filter(reed => reed.group_id === null || reed.group_id === groupId);
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

  const handleActivateAlarm = useCallback(async (groupId: number) => {
    setIsActivating(prev => ({ ...prev, [groupId]: true }))
    try {
      const success = await startListening(groupId, pin, isForceListening)
      if (!success) {
        setSelectedGroupId(groupId)
        setIsForceListening(true)
        setIsPinDialogOpen(true)
      }
      // Reload groups after 1 second
      setTimeout(() => fetchGroups(), 1000)

      const group = deviceGroups?.find(g => g.id === groupId)
      if (group) {
        // Schedule another reload after wait_to_start_alarm + 1 seconds
        setTimeout(() => fetchGroups(), (group.wait_to_start_alarm + 1) * 1000)
      }
    } catch (error) {
        setErrorMessage("Failed to activate alarm")
    } finally {
      setIsActivating(prev => ({ ...prev, [groupId]: false }))
    }
  }, [deviceGroups, pin, isForceListening])

  const handleDeactivateAlarm = useCallback(async (groupId: number) => {
    setIsDeactivating(prev => ({ ...prev, [groupId]: true }))
    try {
      await stopListening(groupId, pin)
      // Reload groups after 1 second
      setTimeout(() => fetchGroups(), 1000)
    } catch (error) {
      setErrorMessage("Failed to deactivate alarm")
    } finally {
      setIsDeactivating(prev => ({ ...prev, [groupId]: false }))
    }
  }, [pin])

  const fetchGroups = useCallback(async () => {
    try {
      const groups = await getDeviceGroups()
      setDeviceGroups(groups)
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
      console.error("Failed to fetch groups:", error)
      setErrorMessage("Failed to fetch device groups. Please try again.")
    }
  }, [])

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
        <h1 className="text-3xl font-bold text-zinc-50 mb-2 sm:mb-0">Alarm dashboard</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setGroupError(null);
        }}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
              onClick={handleAddGroup}
            >
              Add group
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-800 text-zinc-50">
            <DialogHeader>
              <DialogTitle>{editingGroup?.id ? "Edit group" : "Add group"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault()
              if (editingGroup) {
                if (selectedCameras.length === 0 && selectedReeds.length === 0) {
                  setGroupError("No device set - please set at least one device");
                } else {
                  setGroupError(null);
                  handleSaveGroup(editingGroup);
                }
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
                {groupError && (
                  <p className="text-red-500 text-sm mt-2">{groupError}</p>
                )}
                <div>
                  <h3 className="mb-2 font-semibold text-zinc-300">Cameras</h3>
                  {allCameras.map(camera => (
                    <div key={camera.ip} className="flex items-center space-x-2">
                      <Checkbox
                        id={`camera-${camera.ip}`}
                        checked={selectedCameras.some(c => c.ip === camera.ip)}
                        onCheckedChange={(checked) => {
                          setSelectedCameras(prev =>
                            checked
                              ? [...prev, camera]
                              : prev.filter(c => c.ip !== camera.ip)
                          )
                        }}
                        className="border-zinc-500"
                      />
                      <label
                        htmlFor={`camera-${camera.ip}`}
                        className="text-zinc-300"
                      >
                        {camera.name}
                      </label>
                    </div>
                  ))}
                  {allCameras.length === 0 && <p className="text-zinc-400">No camera available</p>}
                </div>
                <div>
                  <h3 className="mb-2 font-semibold text-zinc-300">Reeds</h3>
                  {allReeds.map(reed => (
                    <div key={reed.gpio_pin_number} className="flex items-center space-x-2">
                      <Checkbox
                        id={`reed-${reed.gpio_pin_number}`}
                        checked={selectedReeds.some(r => r.gpio_pin_number === reed.gpio_pin_number)}
                        onCheckedChange={(checked) => {
                          setSelectedReeds(prev =>
                            checked
                              ? [...prev, reed]
                              : prev.filter(r => r.gpio_pin_number !== reed.gpio_pin_number)
                          )
                        }}
                        className="border-zinc-500"
                      />
                      <label
                        htmlFor={`reed-${reed.gpio_pin_number}`}
                        className="text-zinc-300"
                      >
                        {reed.name}
                      </label>
                    </div>
                  ))}
                  {allReeds.length === 0 && <p className="text-zinc-400">No reed available</p>}
                </div>
                <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                  {editingGroup?.id ? "Update" : "Create"}
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
                <p className={`${getStatusColor(group.status)} font-semibold`}>Status: {statusMapping[group.status]}</p>
                <p className="text-zinc-300">Wait to start alarm: {group.wait_to_start_alarm}s</p>
                <p className="text-zinc-300">Wait to fire alarm: {group.wait_to_fire_alarm}s</p>
                <h3 className="mt-2 font-semibold text-zinc-300">Cameras:</h3>
                <ul className="list-disc pl-5 text-zinc-300">
                  {groupCameras[group.id]?.map((camera) => (
                    <li key={camera.ip}>{camera.name}</li>
                  ))}
                </ul>
                {groupCameras[group.id]?.length === 0 && <p className="text-zinc-400">No cameras</p>}
                <h3 className="mt-2 font-semibold text-zinc-300">Reeds:</h3>
                <ul className="list-disc pl-5 text-zinc-300">
                  {groupReeds[group.id]?.map((reed) => (
                    <li key={reed.gpio_pin_number}>{reed.name}</li>
                  ))}
                </ul>
                {groupReeds[group.id]?.length === 0 && <p className="text-zinc-400">No reeds</p>}
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
                {permissions.includes(Permission.START_ALARM) && group.status === DeviceGroupStatus.IDLE && (
                  <Button
                    onClick={() => {
                      setSelectedGroupId(group.id)
                      setIsForceListening(false)
                      setIsPinDialogOpen(true)
                    }}
                    disabled={isActivating[group.id]}
                    className="w-full bg-white text-zinc-800 hover:bg-zinc-200"
                  >
                    Activate Alarm
                  </Button>
                )}
                {permissions.includes(Permission.STOP_ALARM) && group.status !== DeviceGroupStatus.IDLE && (
                  <Button
                    onClick={() => {
                      setSelectedGroupId(group.id)
                      setIsForceListening(false)
                      setIsPinDialogOpen(true)
                    }}
                    disabled={isDeactivating[group.id]}
                    className="w-full bg-white text-zinc-800 hover:bg-zinc-200"
                  >
                    Deactivate Alarm
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{isForceListening ? "Force Activate Alarm" : "Enter PIN"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            setIsPinDialogOpen(false)
            if (selectedGroupId) {
              if (deviceGroups?.find(g => g.id === selectedGroupId)?.status === DeviceGroupStatus.IDLE) {
                handleActivateAlarm(selectedGroupId)
              } else {
                handleDeactivateAlarm(selectedGroupId)
              }
            }
          }}>
            <Input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="bg-zinc-700 text-zinc-50 border-zinc-600 mb-4"
            />
            {isForceListening && (
              <p className="text-yellow-500 mb-4">Warning: A magnetic reed in the group is open. Do you want to force activate the alarm?</p>
            )}
            <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
              {isForceListening ? "Force Activate" : "Submit"}
            </Button>
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
            <AlertDialogAction onClick={() => setErrorMessage(null)} className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

