'use client'

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { usePathname, useRouter } from "next/navigation"
import Login from "./login"
import Alarm from "./alarm"
import UserManagement from "./user-management"

export default function TabLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState("")
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn")
    setIsLoggedIn(loggedIn === "true")
    setUsername(localStorage.getItem("username") || "User")
  }, [])

  const handleLogin = (loggedInUsername: string) => {
    setIsLoggedIn(true)
    setUsername(loggedInUsername)
  }

  const handleTabChange = (value: string) => {
    router.push(value === "alarm" ? "/" : `/${value}`)
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
  }

  const currentTab = pathname === "/" ? "alarm" : pathname.slice(1)

  return (
    <div className="border border-zinc-800 rounded-md p-4 bg-zinc-950 text-zinc-50">
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <div className="mb-4 border-b border-zinc-800">
          <div className="flex justify-between items-center mb-2">
            <TabsList className="bg-transparent">
              <TabsTrigger value="alarm" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50">Home alarm</TabsTrigger>
              <TabsTrigger value="users" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50">User management</TabsTrigger>
            </TabsList>
            <div className="flex items-center space-x-2">
              <span className="text-zinc-400">{username}</span>
              <Avatar>
                <AvatarImage src="/avatar.webp" alt={username} />
              </Avatar>
            </div>
          </div>
        </div>
        <div className="pt-4">
          <TabsContent value="alarm">
            <h1 className="text-3xl font-bold mb-6 text-zinc-50">Alarm Dashboard</h1>
            <Alarm />
          </TabsContent>
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
