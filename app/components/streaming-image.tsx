'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { RTSPCamera } from '@/types'
import { getRTSPCameraStreamUrl } from '@/lib/api'

interface StreamingImageProps {
  camera: RTSPCamera
  onError?: (error: Error) => void
}

export function StreamingImage({ camera, onError }: StreamingImageProps) {
  const [currentFrame, setCurrentFrame] = useState<string>('')
  const eventSourceRef = useRef<EventSource | null>(null)
  const lastObjectUrl = useRef<string>('')
  const nextObjectUrl = useRef<string>('')

  useEffect(() => {
    const streamUrl = getRTSPCameraStreamUrl(camera.ip)

    // Create EventSource for the stream
    eventSourceRef.current = new EventSource(streamUrl)

    // Handle incoming frames
    eventSourceRef.current.onmessage = async (event) => {
      try {
        // Convert base64 to blob
        const base64Data = event.data
        const response = await fetch(`data:image/webp;base64,${base64Data}`)
        const blob = await response.blob()

        // Revoke the previous object URL to prevent memory leaks
        if (lastObjectUrl.current) {
          URL.revokeObjectURL(lastObjectUrl.current)
        }

        // Create new object URL from blob
        const objectUrl = URL.createObjectURL(blob)
        lastObjectUrl.current = objectUrl
        setCurrentFrame(objectUrl)
      } catch (error) {
        if (onError) {
          onError(error instanceof Error ? error : new Error('Failed to process frame'))
        }
      }
    }

    // Handle errors
    eventSourceRef.current.onerror = () => {
      if (onError) {
        onError(new Error('Stream connection error'))
      }
      eventSourceRef.current?.close()
    }

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      // Revoke all object URLs
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current)
      }
      if (nextObjectUrl.current) {
        URL.revokeObjectURL(nextObjectUrl.current)
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full flex justify-center items-center p-2">
      {currentFrame && (
        <Image
          src={currentFrame}
          alt="Camera Stream"
          fill
          className="object-contain"
          sizes="(max-width: 640px) 100vw, 640px"
          priority
        />
      )}
    </div>
  )
}

