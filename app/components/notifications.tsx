"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getAllNotifications } from "@/lib/api"
import type { AlarmNotification, Permission } from "@/types"
import { Bell, Loader2, ChevronLeft, ChevronRight } from "lucide-react"

type NotificationsProps = {
  permissions: Permission[]
}

const PAGE_SIZE = 20

export default function Notifications({ permissions }: NotificationsProps) {
  const [notifications, setNotifications] = useState<AlarmNotification[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [hasPrevious, setHasPrevious] = useState(false)

  const fetchNotifications = useCallback(async (offset: number): Promise<AlarmNotification[]> => {
    const notifications = await getAllNotifications({ offset })
    return notifications
  }, [])

  const loadNotifications = useCallback(
    async (offset: number) => {
      setLoading(true)
      try {
        const fetchedNotifications = await fetchNotifications(offset)
        setNotifications(fetchedNotifications)

        setHasMore(fetchedNotifications.length === PAGE_SIZE)
        setHasPrevious(offset > 0)
        setCurrentOffset(offset)
      } catch (error) {
        console.error("Failed to load notifications:", error)
        setErrorMessage("Failed to fetch notifications")
      } finally {
        setLoading(false)
        setInitialLoading(false)
      }
    },
    [fetchNotifications],
  )

  useEffect(() => {
    loadNotifications(0)
  }, [loadNotifications])

  const handleNextPage = () => {
    if (hasMore && !loading) {
      const nextOffset = currentOffset + PAGE_SIZE
      loadNotifications(nextOffset)
    }
  }

  const handlePreviousPage = () => {
    if (hasPrevious && !loading) {
      const prevOffset = Math.max(0, currentOffset - PAGE_SIZE)
      loadNotifications(prevOffset)
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch (error) {
      return dateString
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "text-red-400"
      case "medium":
        return "text-yellow-400"
      case "low":
        return "text-green-400"
      default:
        return "text-zinc-400"
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <span className="ml-2 text-zinc-400">Loading notifications...</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-3xl font-bold text-zinc-50 mb-2 sm:mb-0">Notifications</h1>
        <p className="text-zinc-300">Page {Math.floor(currentOffset / PAGE_SIZE) + 1}</p>
      </div>

      <div className="space-y-4 mb-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-lg">No notifications found.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className="bg-zinc-800 border-zinc-700">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-zinc-50 text-lg">{notification.title}</CardTitle>
                  <span className={`text-sm font-medium ${getPriorityColor(notification.priority)}`}>
                    {notification.priority.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {notification.message && <p className="text-zinc-300 mb-3">{notification.message}</p>}
                <p className="text-zinc-500 text-sm">{formatDateTime(notification.created_at)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {(hasPrevious || hasMore) && (
        <div className="flex justify-center items-center gap-4">
          <Button
            variant="outline"
            onClick={handlePreviousPage}
            disabled={!hasPrevious || loading}
            className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <span className="text-zinc-400 text-sm">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Showing ${currentOffset + 1}-${Math.min(currentOffset + notifications.length, currentOffset + PAGE_SIZE)}`
            )}
          </span>

          <Button
            variant="outline"
            onClick={handleNextPage}
            disabled={!hasMore || loading}
            className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600 disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent className="bg-zinc-800 text-zinc-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setErrorMessage(null)}
              className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
