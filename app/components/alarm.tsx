'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getAlarmGroups, createAlarmGroup, updateAlarmGroup, deleteAlarmGroup, getAllDevices, activateAlarm, deactivateAlarm } from "@/lib/api"
import { AlarmGroup, Device, Permission } from "@/types"

type AlarmProps = {
  permissions: Permission[]
}

export default function Alarm({ permissions }: AlarmProps) {
  const [alarmGroups, setAlarmGroups] = useState<AlarmGroup[]>([])
  const [allDevices, setAllDevices] = useState<Device[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<AlarmGroup | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canActivateAlarm = permissions.includes(Permission.START_ALARM)
  const canDeactivateAlarm = permissions.includes(Permission.STOP_ALARM)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groups = await getAlarmGroups()
        setAlarmGroups(groups)
        const devices = await getAllDevices()
        setAllDevices(devices)
      } catch (error) {
        setErrorMessage("Failed to fetch alarm groups and devices")
      }
    }
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await deleteAlarmGroup(id)
      setAlarmGroups(alarmGroups.filter(group => group.id !== id))
    } catch (error) {
      setErrorMessage("Failed to delete alarm group")
    }
  }

  const handleActivate = async (id: number) => {
    try {
      const group = alarmGroups.find(g => g.id === id)
      if (!group) return

      if (group.isActive && !canDeactivateAlarm) {
         setErrorMessage("You do not have the required permission to deactivate an alarm")
         return;
      }

      if (!group.isActive && !canActivateAlarm) {
         setErrorMessage("You do not have the required permission to activate an alarm")
         return;
      }

      const updatedGroup = group.isActive
        ? await deactivateAlarm(id)
        : await activateAlarm(id)

      setAlarmGroups(alarmGroups.map(g =>
        g.id === id ? updatedGroup : g
      ))
    } catch (error) {
      setErrorMessage("Failed to activate/deactivate alarm")
    }
  }

  const handleAddGroup = () => {
    setEditingGroup({ id: 0, name: "", devices: [], isActive: false })
    setIsDialogOpen(true)
  }

  const handleEditGroup = (group: AlarmGroup) => {
    setEditingGroup(group)
    setIsDialogOpen(true)
  }

  const handleSaveGroup = async (updatedGroup: AlarmGroup) => {
    try {
      if (updatedGroup.id === 0) {
        const newGroup = await createAlarmGroup(updatedGroup)
        setAlarmGroups([...alarmGroups, newGroup])
      } else {
        const updatedGroupResponse = await updateAlarmGroup(updatedGroup.id, updatedGroup)
        setAlarmGroups(alarmGroups.map(group => group.id === updatedGroupResponse.id ? updatedGroupResponse : group))
      }
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage("Failed to save alarm group")
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-zinc-50">Alarm Dashboard</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleAddGroup}>Add Group</Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-800 text-zinc-50">
            <DialogHeader>
              <DialogTitle>{editingGroup?.id ? "Edit Group" : "Add Group"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault()
              if (editingGroup) {
                handleSaveGroup(editingGroup)
              }
            }}>
              <div className="space-y-4">
                <Input
                  placeholder="Group Name"
                  value={editingGroup?.name || ""}
                  onChange={(e) => setEditingGroup(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                />
                <div>
                  <h3 className="mb-2 font-semibold text-zinc-300">Devices</h3>
                  {allDevices.map(device => (
                    <div key={device.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`device-${device.id}`}
                        checked={editingGroup?.devices.some(d => d.id === device.id)}
                        onCheckedChange={(checked) => {
                          setEditingGroup(prev => {
                            if (!prev) return null
                            const newDevices = checked
                              ? [...prev.devices, device]
                              : prev.devices.filter(d => d.id !== device.id)
                            return {...prev, devices: newDevices}
                          })
                        }}
                        className="border-zinc-500"
                      />
                      <label htmlFor={`device-${device.id}`} className="text-zinc-300">{device.name}</label>
                    </div>
                  ))}
                </div>
                <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                  {editingGroup?.id ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {alarmGroups.map((group) => (
          <Card key={group.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
            <CardHeader>
              <CardTitle className="text-zinc-50">{group.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="list-disc pl-5 text-zinc-300">
                {group.devices && group.devices.map((device) => (
                  <li key={device.id}>{device.name}</li>
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
                        This action cannot be undone. This will permanently delete the alarm group.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(group.id)} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="w-full pt-4 mt-2 border-t-2 border-zinc-700">
                <Button
                  onClick={() => handleActivate(group.id)}
                  variant={group.isActive ? "default" : "outline"}
                  className={`w-full ${group.isActive ? 'bg-yellow-700 hover:bg-yellow-600 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                >
                  {group.isActive ? "Deactivate Alarm" : "Activate Alarm"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
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