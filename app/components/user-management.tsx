'use client'

import { useState, useEffect } from "react"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { getAllUsers, createUser, updateUser, deleteUser, logout, getPermissions } from "@/lib/api"
import { User, Permission } from "@/types"
import { useRouter } from "next/navigation"

type UserManagementProps = {
  onUserUpdate: (user: User) => void
  currentUser: User | null
  permissions: Permission[]
}

const permissionDisplayMap: Record<Permission, string> = {
  [Permission.USER_MANAGER]: "User Manager",
  [Permission.START_ALARM]: "Start Alarm",
  [Permission.STOP_ALARM]: "Stop Alarm",
  [Permission.ACCESS_RECORDINGS]: "Access Recordings",
  [Permission.ACCESS_STREAM_CAMERAS]: "Access Stream Cameras",
  [Permission.CHANGE_ALARM_SOUND]: "Change Alarm Sound",
  [Permission.CHANGE_MAIL_CONFIG]: "Change Mail Configuration",
  [Permission.MODIFY_DEVICES]: "Modify Devices"
}

export default function UserManagement({ onUserUpdate, currentUser, permissions }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])

  const router = useRouter()

  const isUserManager = permissions.includes(Permission.USER_MANAGER)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fetchedUsers = await getAllUsers()
        setUsers(fetchedUsers)
        const fetchedPermissions = await getPermissions()
        setAvailablePermissions(fetchedPermissions)
      } catch (error) {
        setErrorMessage("Failed to fetch users or permissions")
      }
    }
    fetchUsers()
  }, [])

  const handleAddUser = () => {
    setEditingUser({ id: 0, username: "", email: "", permissions: [] })
    setIsDialogOpen(true)
  }

  const handleUpdateUser = (user: User) => {
    setEditingUser(user)
    setIsDialogOpen(true)
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const handleDeleteUser = async (userId: number) => {
    try {
      await deleteUser(userId)
      setUsers(users.filter(user => user.id !== userId))
      if (currentUser && userId === currentUser.id) {
        handleLogout()
      }
    } catch (error) {
      setErrorMessage("Failed to delete user")
    }
  }

  const handleSaveUser = async (updatedUser: User) => {
    try {
      if (updatedUser.id === 0) {
        const newUser = await createUser(updatedUser)
        setUsers([...users, newUser])
      } else {
        const updatedUserResponse = await updateUser(updatedUser.id, updatedUser)
        setUsers(users.map(user => user.id === updatedUserResponse.id ? updatedUserResponse : user))
        if (currentUser && updatedUser.id === currentUser.id) {
          onUserUpdate(updatedUserResponse)
        }
      }
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage("Failed to save user")
    }
  }

  return (
    <div className="text-zinc-50">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">User Management</h1>
        {isUserManager && (
          <Button onClick={handleAddUser} variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Add User</Button>
        )}
      </div>
      <ScrollArea className="h-[400px] w-full border border-zinc-700 rounded-md p-4 bg-zinc-800">
        {currentUser && (
          <div className="mb-4 pb-4 border-b-2 border-zinc-700">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-2">
                <Avatar>
                  <AvatarImage src="/avatar.webp" alt={currentUser.username} />
                </Avatar>
                <span className="text-zinc-300">{currentUser.username} (You)</span>
              </div>
              <div>
                <Button variant="outline" className="mr-2 bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={() => handleUpdateUser(currentUser)}>Edit</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="bg-red-900 hover:bg-red-800">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 text-zinc-50">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and log you out.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteUser(currentUser.id)} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        )}
        {users.filter(user => user.id !== currentUser?.id).map(user => (
          <div key={user.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-b-0">
            <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarImage src="/avatar.webp" alt={user.username} />
              </Avatar>
              <span className="text-zinc-300">{user.username}</span>
            </div>
            {isUserManager && (
              <div>
                <Button variant="outline" className="mr-2 bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={() => handleUpdateUser(user)}>Edit</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="bg-red-900 hover:bg-red-800">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 text-zinc-50">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the user.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-800 text-zinc-50 hover:bg-zinc-700">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ))}
      </ScrollArea>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{editingUser?.id ? "Update" : "Add"} User</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (editingUser) {
              handleSaveUser(editingUser)
            }
          }}>
            <div className="space-y-4">
              <Input
                placeholder="Username"
                value={editingUser?.username || ""}
                onChange={(e) => setEditingUser(prev => prev ? {...prev, username: e.target.value} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <Input
                type="email"
                placeholder="Email"
                value={editingUser?.email || ""}
                onChange={(e) => setEditingUser(prev => prev ? {...prev, email: e.target.value} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <div>
                <h3 className="mb-2 font-semibold text-zinc-300">Permissions</h3>
                {availablePermissions.map(permission => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission}
                      checked={editingUser?.permissions.includes(permission)}
                      onCheckedChange={(checked) => {
                        setEditingUser(prev => {
                          if (!prev) return null
                          const newPermissions = checked
                            ? [...prev.permissions, permission]
                            : prev.permissions.filter(p => p !== permission)
                          return {...prev, permissions: newPermissions}
                        })
                      }}
                      className="border-zinc-500"
                    />
                    <label htmlFor={permission} className="text-zinc-300">{permissionDisplayMap[permission]}</label>
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                {editingUser?.id ? "Update" : "Create"} User
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
            <AlertDialogAction onClick={() => setErrorMessage(null)} className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Ok</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}