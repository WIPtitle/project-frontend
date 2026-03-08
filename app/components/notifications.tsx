"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getAllNotifications, getSnapshotUrl } from "@/lib/api"
import type { AlarmNotification, Permission } from "@/types"
import { Bell, Loader2 } from "lucide-react"

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

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreCallbackRef = useRef<() => void>(() => {})
  const loadingNodeRef = useRef<HTMLDivElement | null>(null)

  const setLoadingRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingNodeRef.current && observerRef.current) {
      observerRef.current.unobserve(loadingNodeRef.current)
    }
    loadingNodeRef.current = node
    if (node && observerRef.current) {
      observerRef.current.observe(node)
    }
  }, [])

  const loadInitialData = useCallback(async () => {
    setInitialLoading(true)
    try {
      const fetched = await getAllNotifications({ offset: 0 })
      setNotifications(fetched)
      setCurrentOffset(PAGE_SIZE)
      setHasMore(fetched.length === PAGE_SIZE)
    } catch (error) {
      console.error("Failed to load notifications:", error)
      setErrorMessage("Failed to fetch notifications")
    } finally {
      setInitialLoading(false)
    }
  }, [])

  const loadMoreNotifications = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const fetched = await getAllNotifications({ offset: currentOffset })
      if (fetched.length === 0) {
        setHasMore(false)
      } else {
        setNotifications((prev) => [...prev, ...fetched])
        setCurrentOffset((prev) => prev + PAGE_SIZE)
        setHasMore(fetched.length === PAGE_SIZE)
      }
    } catch (error) {
      console.error("Failed to load more notifications:", error)
      setErrorMessage("Failed to fetch more notifications")
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, currentOffset])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    loadMoreCallbackRef.current = () => {
      if (!loading && !initialLoading && hasMore) {
        loadMoreNotifications()
      }
    }
  }, [loadMoreNotifications, loading, initialLoading, hasMore])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreCallbackRef.current()
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    )
    observerRef.current = observer

    if (loadingNodeRef.current) {
      observer.observe(loadingNodeRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  const formatDateTime = (dateString: string) => {
    try {
      // Backend stores UTC timestamps — append Z if missing so the browser converts to local time
      const isoString = dateString.endsWith("Z") ? dateString : dateString + "Z"
      const date = new Date(isoString)
      return date.toLocaleString(undefined, {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    } catch {
      return dateString
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-50">Notifications</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start mb-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 col-span-full">
            <Bell className="h-12 w-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-lg">No notifications found.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className="bg-zinc-800 border-zinc-700">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-zinc-50 text-lg">{notification.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {notification.message && <p className="text-zinc-300 mb-3">{notification.message}</p>}
                {notification.snapshot_filename && (
                  <div className="mb-3">
                    <img
                      src={getSnapshotUrl(notification.snapshot_filename)}
                      alt="Motion snapshot"
                      className="rounded-md w-full border border-zinc-600"
                      loading="lazy"
                    />
                  </div>
                )}
                <p className="text-zinc-500 text-sm">{formatDateTime(notification.created_at)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {hasMore && notifications.length > 0 && (
        <div ref={setLoadingRef} className="flex items-center justify-center py-8">
          {loading && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              <span className="ml-2 text-zinc-400">Loading more notifications...</span>
            </>
          )}
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
