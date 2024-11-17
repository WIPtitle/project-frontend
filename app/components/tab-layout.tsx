'use client'

import { useState, useEffect, useRef } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { usePathname, useRouter } from "next/navigation"
import { Menu } from 'lucide-react'
import Login from "./login"
import Alarm from "./alarm"
import Devices from "./devices"
import Recordings from "./recordings"
import Configuration from "./configuration"
import UserManagement from "./user-management"
import { getUserMyself, logout, getNtfyCredentials } from "@/lib/api"
import { User, Permission, NtfyCredentials } from "@/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function TabLayout() {
  const [token, setToken] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const tabsRef = useRef<HTMLDivElement>(null)
  const userInfoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const tokenExpiry = localStorage.getItem('tokenExpiry')

    if (storedToken) {
      setToken(storedToken)
      getUserMyself()
        .then((user) => {
          setCurrentUser(user)
          setIsLoading(false)
        })
        .catch((error) => {
          console.error(error)
          setIsLoading(false)
        })

      if (tokenExpiry && tokenExpiry !== 'infinite') {
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
    if (token) {
      const sendNtfyCredentials = async () => {
        try {
          const ntfyCredentials = await getNtfyCredentials();
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SET_NTFY_CREDENTIALS',
              credentials: ntfyCredentials,
              hostname: window.location.hostname,
            });
          }
        } catch (error) {
          console.error('Failed to send Ntfy credentials', error);
        }
      };
      sendNtfyCredentials();
    }
  }, [token]);

  useEffect(() => {
    const handleResize = () => {
      if (tabsRef.current && userInfoRef.current) {
        const tabsRect = tabsRef.current.getBoundingClientRect();
        const userInfoRect = userInfoRef.current.getBoundingClientRect();
        const lastTabElement = tabsRef.current.lastElementChild as HTMLElement;
        if (lastTabElement) {
          const lastTabRect = lastTabElement.getBoundingClientRect();
          const shouldCollapse = lastTabRect.right + 20 > userInfoRect.left;
          setIsMenuCollapsed(shouldCollapse);
        }
      }
    };

    // Check on initial load
    handleResize();

    // Check on window resize
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Recheck menu collapse when currentUser changes (which may affect tab items)
    if (tabsRef.current && userInfoRef.current) {
      const tabsRect = tabsRef.current.getBoundingClientRect();
      const userInfoRect = userInfoRef.current.getBoundingClientRect();
      const lastTabElement = tabsRef.current.lastElementChild as HTMLElement;
      if (lastTabElement) {
        const lastTabRect = lastTabElement.getBoundingClientRect();
        const shouldCollapse = lastTabRect.right + 20 > userInfoRect.left;
        setIsMenuCollapsed(shouldCollapse);
      }
    }
  }, [currentUser]);

  const handleLogin = async (newToken: string) => {
    setToken(newToken)
    try {
      const user = await getUserMyself()
      setCurrentUser(user)
    } catch (error) {
      console.error(error)
    }
  }

  const handleLogout = () => {
    logout()
    setToken(null)
    setCurrentUser(null)
    router.push('/')
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

  if (!token) {
    return <Login onLogin={handleLogin} />
  }

  const currentTab = pathname === "/" ? "alarm" : pathname.slice(1)

  const tabItems = [
    { value: "alarm", label: "Home alarm" },
    { value: "devices", label: "Devices" },
    ...(currentUser?.permissions.includes(Permission.ACCESS_RECORDINGS) ? [{ value: "recordings", label: "Recordings" }] : []),
    { value: "users", label: "User management" },
    ...(currentUser?.permissions.includes(Permission.CHANGE_ALARM_SOUND) || currentUser?.permissions.includes(Permission.UPDATE_NOTIFICATIONS_CONFIG) ? [{ value: "configuration", label: "Configuration" }] : []),
  ]

  return (
    <div className="min-h-screen bg-zinc-800 rounded-md p-4 bg-zinc-900 text-zinc-50">
      <div className="container mx-auto p-4">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <div className="mb-4 border-b border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              {isMenuCollapsed ? (
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
              ) : (
                <TabsList ref={tabsRef} className="bg-transparent">
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
              <div ref={userInfoRef} className="flex items-center space-x-2 pr-4">
                <span className="text-zinc-400">{currentUser?.email}</span>
                <Avatar>
                  <AvatarImage src="/avatar.webp" alt={currentUser?.email} />
                </Avatar>
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
              <UserManagement onUserUpdate={handleUserUpdate} currentUser={currentUser} permissions={currentUser?.permissions || []} />
            </TabsContent>
            {(currentUser?.permissions.includes(Permission.CHANGE_ALARM_SOUND) || currentUser?.permissions.includes(Permission.UPDATE_NOTIFICATIONS_CONFIG)) && (
              <TabsContent value="configuration">
                <Configuration permissions={currentUser?.permissions || []} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  )
}