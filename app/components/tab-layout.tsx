"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { usePathname, useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import Login from "./login"
import Alarm from "./alarm"
import Devices from "./devices"
import Recordings from "./recordings"
import Configuration from "./configuration"
import UserManagement from "./user-management"
import Notifications from "./notifications"
import { getUserMyself, logout } from "@/lib/api"
import { type User, Permission } from "@/types"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

function formatEmail(email: string): string {
  if (email.length <= 25) return email

  const [localPart, domain] = email.split("@")
  const [domainName, ...tld] = domain.split(".")
  return `${localPart}@***${tld.length ? "." + tld.join(".") : ""}`
}

export default function TabLayout() {
  const [token, setToken] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    const tokenExpiry = localStorage.getItem("tokenExpiry")

    if (storedToken) {
      setToken(storedToken)
      getUserMyself()
        .then((user) => {
          setCurrentUser(user)
          setIsLoading(false)
        })
        .catch((error) => {
          // Token is invalid or expired
          handleLogout()
          setIsLoading(false)
        })

      if (tokenExpiry && tokenExpiry !== "infinite") {
        const expiryTime = new Date(tokenExpiry).getTime()
        const timeUntilExpiry = expiryTime - Date.now()

        if (timeUntilExpiry > 0) {
          setTimeout(handleLogout, timeUntilExpiry)
        } else {
          handleLogout()
        }
      }
    } else {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setIsMenuCollapsed(window.innerWidth < 1060) // Use 1060px as breakpoint for md
    }

    // Check on initial load
    handleResize()

    // Add event listener for window resize
    window.addEventListener("resize", handleResize)

    // Cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, []) // Only run on mount

  const handleLogin = async (newToken: string) => {
    setToken(newToken)
    try {
      const user = await getUserMyself()
      setCurrentUser(user)
    } catch (error) {
      throw error
    }
  }

  const handleLogout = () => {
    logout()
    setToken(null)
    setCurrentUser(null)
    localStorage.removeItem("token")
    localStorage.removeItem("tokenExpiry")
    router.push("/")
  }

  const handleTabChange = (value: string) => {
    router.push(value === "alarm" ? "/" : `/${value}`)
  }

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-800">
        <div className="text-2xl font-bold text-zinc-50">Loading...</div>
      </div>
    )
  }

  if (!token || !currentUser) {
    return <Login onLogin={handleLogin} />
  }

  const currentTab = pathname === "/" ? "alarm" : pathname?.slice(1) || "alarm"

  const tabItems = [
    { value: "alarm", label: "Alarm dashboard" },
    { value: "devices", label: "Devices" },
    ...(currentUser?.permissions.includes(Permission.ACCESS_RECORDINGS)
      ? [{ value: "recordings", label: "Recordings" }]
      : []),
    { value: "users", label: "User management" },
    { value: "configuration", label: "Configuration" }, // Configuration tab is always visible
    { value: "notifications", label: "Notifications" }
  ]

  return (
    <div className="min-h-screen bg-zinc-800 rounded-md p-4 bg-zinc-900 text-zinc-50">
      <div className="container mx-auto py-4 px-0 sm:px-4">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <div className="mb-4 border-b border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              {isMenuCollapsed ? (
                <div className="pl-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Menu className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {tabItems.map((item) => (
                        <DropdownMenuItem key={item.value} onSelect={() => handleTabChange(item.value)}>
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <TabsList className="bg-transparent hidden md:flex">
                  {tabItems.map((item) => (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-zinc-50 text-zinc-400 hover:text-zinc-50"
                    >
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}

              <div className="flex items-center space-x-2 pr-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80">
                      <span className="text-zinc-400">{formatEmail(currentUser?.email || "")}</span>
                      <Avatar>
                        <AvatarImage src="/ui/avatar.webp" alt={currentUser?.email} />
                      </Avatar>
                    </div>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will log you out of your account. You will need to log in again to access the application.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          handleLogout()
                          window.location.reload()
                        }}
                        className="bg-red-900 hover:bg-red-800 text-white"
                      >
                        Logout
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
          <div className="pt-4 px-4">
            <TabsContent value="alarm">
              <Alarm permissions={currentUser?.permissions || []} />
            </TabsContent>
            <TabsContent value="devices">
              <Devices permissions={currentUser?.permissions || []} />
            </TabsContent>
            {currentUser?.permissions.includes(Permission.ACCESS_RECORDINGS) && (
              <TabsContent value="recordings">
                <Recordings permissions={currentUser?.permissions || []} />
              </TabsContent>
            )}
            <TabsContent value="users">
              <UserManagement
                onUserUpdate={handleUserUpdate}
                currentUser={currentUser}
                permissions={currentUser?.permissions || []}
              />
            </TabsContent>
            <TabsContent value="configuration">
              <Configuration permissions={currentUser?.permissions || []} />
            </TabsContent>
            <TabsContent value="notifications">
              <Notifications permissions={currentUser?.permissions || []} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

