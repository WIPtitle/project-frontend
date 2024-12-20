'use client'

import { useState, useEffect, useRef } from 'react'
import { RTSPCamera } from '@/types'
import { getRTSPCameraStreamUrl } from '@/lib/api'

interface StreamingImageProps {
  camera: RTSPCamera
  onError?: (error: Error) => void
}

export function StreamingImage({ camera, onError }: StreamingImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    contextRef.current = canvas.getContext('2d', { alpha: false })

    // Create worker
    workerRef.current = new Worker(new URL('./stream-worker.ts', import.meta.url))

    // Handle messages from worker
    workerRef.current.onmessage = async (e) => {
      const { type, imageBitmap, error } = e.data

      if (type === 'error' && onError) {
        onError(new Error(error))
        return
      }

      if (type === 'frame' && contextRef.current) {
        // Adjust canvas size to match the image size
        canvas.width = imageBitmap.width
        canvas.height = imageBitmap.height

        // Clear previous frame
        contextRef.current.clearRect(0, 0, canvas.width, canvas.height)

        // Draw new frame
        contextRef.current.drawImage(imageBitmap, 0, 0)

        // Close the bitmap to free memory
        imageBitmap.close()
      }
    }

    // Start the stream
    const streamUrl = getRTSPCameraStreamUrl(camera.ip)
    workerRef.current.postMessage({ url: streamUrl })

    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'cleanup' })
        workerRef.current = null
      }
    }
  }, [camera.ip, onError])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="object-contain"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}