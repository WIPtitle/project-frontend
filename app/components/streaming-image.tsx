'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { RTSPCamera } from '@/types'
import { getRTSPCameraStreamUrl } from '@/lib/api'

interface StreamingImageProps {
  camera: RTSPCamera
  onError?: (error: Error) => void
}

export function StreamingImage({ camera, onError }: StreamingImageProps) {
  const [imageData, setImageData] = useState<string>('')
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const streamUrl = getRTSPCameraStreamUrl(camera.ip)

    // Create new EventSource
    const eventSource = new EventSource(streamUrl)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        // Use the base64 data directly in a data URL
        setImageData(`data:image/webp;base64,${event.data}`)
      } catch (error) {
        console.error('Error processing stream data:', error)
        if (onError) {
          onError(new Error('Failed to process camera stream data'))
        }
      }
    }

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error)
      if (onError) {
        onError(new Error('Camera stream connection error'))
      }
      eventSource.close()
    }

    return () => {
      // Cleanup: close EventSource
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [camera.ip, onError])

  return (
    <div className="relative w-full h-[600px]">
      {imageData && (
        <Image
          src={imageData}
          alt={`Live stream from ${camera.name}`}
          fill
          className="object-contain p-4"
          unoptimized
          sizes="(max-width: 768px) 100vw, 90vw"
          priority
          onError={(e) => {
            if (onError) {
              onError(new Error('Failed to load camera stream frame'))
            }
          }}
        />
      )}
    </div>
  )
}

