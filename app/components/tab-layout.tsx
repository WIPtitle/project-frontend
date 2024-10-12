'use client'

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { usePathname, useRouter } from "next/navigation"
import Login from "./login"
import Alarm from "./alarm"
import Devices from "./devices"
import Recordings from "./recordings"
import Configuration from "./configuration"
import UserManagement from "./user-management"
import { getUserMyself, logout } from "@/lib/api"
import { User } from "@/types"

export default function TabLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const tokenExpiry = localStorage.getItem('tokenExpiry')

    if (token) {
      setIsLoggedIn(true)
      getUserMyself().then(setCurrentUser).catch(console.error)

      if (tokenExpiry && tokenExpiry !== 'infinite') {
        const expiryTime = new Date(tokenExpiry).getTime()
        const timeUntilExpiry = expiryTime - Date.now()

        if (timeUntilExpiry > 0) {
          setTimeout(handleLogout, timeUntilExpiry)
        } else {
          handleLogout()
        }
      }
    }
  }, [])

  const handleLogin = (user: User) => {
    setIsLoggedIn(true)
    setCurrentUser(user)
  }

  const handleLogout = () => {
    logout()
    setIsLoggedIn(false)
    setCurrentUser(null)
    router.push('/')
  }

  const handleTabChange = (value: string) => {
    router.push(value === "alarm" ? "/" : `/${value}`)
  }

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser)
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
  }

  const currentTab = pathname === "/" ? "alarm" : pathname.slice(1)

  return (
    <div className="min-h-screen bg-zinc-800 rounded-md p-4 bg-zinc-900 text-zinc-50">
      <div className="container mx-auto p-4">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <div className="mb-4 border-b border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <TabsList className="bg-transparent">
                <TabsTrigger value="alarm" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50">Home alarm</TabsTrigger>
                <TabsTrigger value="devices" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50">Devices</TabsTrigger>
                <TabsTrigger value="recordings" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50">Recordings</TabsTrigger>
                <TabsTrigger value="users" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50">User management</TabsTrigger>
                <TabsTrigger value="configuration" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50">Configuration</TabsTrigger>
              </TabsList>
              <div className="flex items-center space-x-2 pr-4">
                <span className="text-zinc-400">{currentUser?.username}</span>
                <Avatar>
                  <AvatarImage src="/avatar.webp" alt={currentUser?.username} />
                </Avatar>
              </div>
            </div>
          </div>
          <div className="pt-4 px-4">
            <TabsContent value="alarm">
              <Alarm />
            </TabsContent>
            <TabsContent value="devices">
              <Devices />
            </TabsContent>
            <TabsContent value="recordings">
              <Recordings />
            </TabsContent>
            <TabsContent value="users">
              <UserManagement onUserUpdate={handleUserUpdate} currentUser={currentUser} />
            </TabsContent>
            <TabsContent value="configuration">
              <Configuration />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}