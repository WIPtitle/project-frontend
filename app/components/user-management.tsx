'use client'

import { useState } from "react"
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

type User = {
  id: number
  username: string
  email: string
  password: string
  permissions: string[]
}

const initialUsers: User[] = [
  { id: 1, username: "admin", email: "admin@example.com", password: "admin123", permissions: ["read", "write", "delete"] },
  { id: 2, username: "user1", email: "user1@example.com", password: "user123", permissions: ["read"] },
  { id: 3, username: "user2", email: "user2@example.com", password: "user234", permissions: ["read", "write"] },
]

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleAddUser = () => {
    setEditingUser({ id: Date.now(), username: "", email: "", password: "", permissions: [] })
    setIsDialogOpen(true)
  }

  const handleUpdateUser = (user: User) => {
    setEditingUser(user)
    setIsDialogOpen(true)
  }

  const handleDeleteUser = (userId: number) => {
    setUsers(users.filter(user => user.id !== userId))
  }

  const handleSaveUser = (updatedUser: User) => {
    if (updatedUser.id === editingUser?.id) {
      setUsers(users.map(user => user.id === updatedUser.id ? updatedUser : user))
    } else {
      setUsers([...users, updatedUser])
    }
    setIsDialogOpen(false)
  }

  return (
    <div className="text-zinc-50">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={handleAddUser} variant="outline" className="bg-zinc-800 text-zinc-50 hover:bg-zinc-700">Add User</Button>
      </div>
      <ScrollArea className="h-[400px] w-full border border-zinc-800 rounded-md p-4 bg-zinc-900">
        {users.map(user => (
          <div key={user.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-b-0">
            <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarImage src="/avatar.webp" alt={user.username} />
              </Avatar>
              <span className="text-zinc-300">{user.username}</span>
            </div>
            <div>
              <Button variant="outline" className="mr-2 bg-zinc-800 text-zinc-50 hover:bg-zinc-700" onClick={() => handleUpdateUser(user)}>Update</Button>
              <Button variant="destructive" className="bg-red-900 hover:bg-red-800" onClick={() => handleDeleteUser(user.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </ScrollArea>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-900 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{editingUser?.id ? "Update User" : "Add User"}</DialogTitle>
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
                className="bg-zinc-800 text-zinc-50 border-zinc-700"
              />
              <Input
                type="email"
                placeholder="Email"
                value={editingUser?.email || ""}
                onChange={(e) => setEditingUser(prev => prev ? {...prev, email: e.target.value} : null)}
                className="bg-zinc-800 text-zinc-50 border-zinc-700"
              />
              <Input
                type="password"
                placeholder="Password"
                value={editingUser?.password || ""}
                onChange={(e) => setEditingUser(prev => prev ? {...prev, password: e.target.value} : null)}
                className="bg-zinc-800 text-zinc-50 border-zinc-700"
              />
              <div>
                <h3 className="mb-2 font-semibold text-zinc-300">Permissions</h3>
                {["read", "write", "delete"].map(permission => (
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
                    <label htmlFor={permission} className="text-zinc-300">{permission}</label>
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full bg-zinc-800 text-zinc-50 hover:bg-zinc-700">
                {editingUser?.id ? "Update User" : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}