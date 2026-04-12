"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Camera, Wifi, WifiOff, Loader2, RefreshCw, Download } from "lucide-react"

import {
  getAllRtspCameras,
  getAllSensors,
  createRTSPCamera,
  createSensor,
  updateSensor,
  updateRTSPCamera,
  deleteRTSPCamera,
  deleteSensor,
  getSensorStatusStream,
  getAvailableGpioServers,
  getCameraStreamUrl,
  getCameraSnapshot,
} from "@/lib/api"

import { type RTSPCamera, type Sensor, Permission, type SensorStatus } from "@/types"

type DeviceProps = {
  permissions: Permission[]
}

type CameraInputDto = {
  name: string
  ip: string
  port: number
  username: string
  password: string
  path: string
  always_recording: boolean
  detection_mode: string | null
  detection_roi: string | null
}

type SensorInputDto = {
  id?: string
  name: string
  gpio_pin_number: number
  gpio_server_url: string
}

export default function Component({ permissions }: DeviceProps) {
  const [rtspCameras, setRtspCameras] = useState<RTSPCamera[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [gpioServers, setGpioServers] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<CameraInputDto | SensorInputDto | null>(null)
  const [deviceType, setDeviceType] = useState<"camera" | "sensor">("camera")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sensorStatuses, setSensorStatuses] = useState<Record<string, SensorStatus>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingCameras, setIsLoadingCameras] = useState(true)
  const [isLoadingSensors, setIsLoadingSensors] = useState(true)
  const [isLoadingServers, setIsLoadingServers] = useState(true)
  const [streamErrors, setStreamErrors] = useState<{ [key: string]: number }>({})
  const [connectionStatus, setConnectionStatus] = useState<{
    [key: string]: "connected" | "connecting" | "error" | "unknown"
  }>({})

  const [selectedStreamCamera, setSelectedStreamCamera] = useState<RTSPCamera | null>(null)
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamError, setStreamError] = useState(false)

  // ROI drawing state
  const MAX_ROI_RECTS = 3
  const [isRoiDialogOpen, setIsRoiDialogOpen] = useState(false)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [roiStart, setRoiStart] = useState<{ x: number; y: number } | null>(null)
  const [roiEnd, setRoiEnd] = useState<{ x: number; y: number } | null>(null)
  const [roiRects, setRoiRects] = useState<{ x: number; y: number; w: number; h: number }[]>([])
  const [selectedRoiIndex, setSelectedRoiIndex] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const canModifyDevices = permissions.includes(Permission.MODIFY_DEVICES)
  const canAccessRecordings = permissions.includes(Permission.ACCESS_RECORDINGS)
  const eventSources = useRef<{ [key: string]: EventSource }>({})
  const reconnectTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})
  const streamErrorsRef = useRef<{ [key: string]: number }>({})

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setIsLoadingCameras(true)
        setIsLoadingSensors(true)
        setIsLoadingServers(true)
        const [cameras, sensorDevices, servers] = await Promise.all([
          getAllRtspCameras(),
          getAllSensors(),
          getAvailableGpioServers(),
        ])
        setRtspCameras(cameras)
        setSensors(sensorDevices)
        setGpioServers(servers)
      } catch (error) {
        setErrorMessage("Failed to fetch devices")
      } finally {
        setIsLoadingCameras(false)
        setIsLoadingSensors(false)
        setIsLoadingServers(false)
      }
    }
    fetchDevices()
  }, [])

  useEffect(() => { streamErrorsRef.current = streamErrors; })

  useEffect(() => {
    for (const sensorId in eventSources.current) {
      if (!sensors.some((sensor) => sensor.id === sensorId)) {
        eventSources.current[sensorId].close()
        delete eventSources.current[sensorId]

        if (reconnectTimeouts.current[sensorId]) {
          clearTimeout(reconnectTimeouts.current[sensorId])
          delete reconnectTimeouts.current[sensorId]
        }
      }
    }

    for (const sensor of sensors) {
      if (!eventSources.current[sensor.id]) {
        const createEventSource = () => {
          setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "connecting" }))

          const stream = getSensorStatusStream(sensor.id)
          eventSources.current[sensor.id] = stream

          stream.onmessage = (event) => {
            const status = event.data as SensorStatus
            setSensorStatuses((prevStatuses) => ({
              ...prevStatuses,
              [sensor.id]: status,
            }))
            setStreamErrors((prev) => ({ ...prev, [sensor.id]: 0 }))
            setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "connected" }))
          }

          stream.onerror = (error) => {
            console.error(`Error in sensor stream for sensor ${sensor.id}:`, error)
            setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "error" }))

            setStreamErrors((prev) => {
              const errorCount = (prev[sensor.id] || 0) + 1

              if (errorCount > 3) {
                console.warn(`Sensor ${sensor.id} stream has failed ${errorCount} times`)
              }

              setSensorStatuses((prevStatuses) => ({
                ...prevStatuses,
                [sensor.id]: "UNKNOWN" as SensorStatus,
              }))

              return { ...prev, [sensor.id]: errorCount }
            })

            const errorCount = streamErrorsRef.current[sensor.id] || 0
            if (errorCount > 10) {
              console.error(`Too many failures for sensor ${sensor.id}, implementing backoff`)
              stream.close()
              delete eventSources.current[sensor.id]

              const backoffTime = Math.min(30000 * Math.pow(2, Math.floor(errorCount / 10) - 1), 300000)

              reconnectTimeouts.current[sensor.id] = setTimeout(() => {
                console.log(
                  `Attempting to reconnect sensor ${sensor.id} stream after ${backoffTime}ms backoff`,
                )
                setStreamErrors((prev) => ({ ...prev, [sensor.id]: 0 }))
                createEventSource()
              }, backoffTime)
            }
          }

          stream.onopen = () => {
            console.log(`Connected to sensor stream for sensor ${sensor.id}`)
            setConnectionStatus((prev) => ({ ...prev, [sensor.id]: "connected" }))
            setStreamErrors((prev) => ({ ...prev, [sensor.id]: 0 }))
          }
        }

        createEventSource()
      }
    }

    return () => {
      for (const timeout of Object.values(reconnectTimeouts.current)) {
        clearTimeout(timeout)
      }
    }
  }, [sensors])

  useEffect(() => {
    return () => {
      for (const sensorId in eventSources.current) {
        eventSources.current[sensorId].close()
      }
      for (const timeout of Object.values(reconnectTimeouts.current)) {
        clearTimeout(timeout)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (!selectedStreamCamera) return

      const videoElement = document.querySelector('video') as HTMLVideoElement
      if (videoElement) {
        videoElement.pause()
        videoElement.removeAttribute('src')
        videoElement.load()
      }
    }
  }, [selectedStreamCamera])

  const handleAddDevice = (type: "camera" | "sensor") => {
    setDeviceType(type)
    setEditingDevice(
      type === "camera"
        ? { name: "", ip: "", port: 554, username: "", password: "", path: "", always_recording: false, detection_mode: null, detection_roi: null }
        : { name: "", gpio_pin_number: 0, gpio_server_url: gpioServers[0] || "" },
    )
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleEditDevice = (device: RTSPCamera | Sensor, type: "camera" | "sensor") => {
    if (type === "camera") {
      const camera = device as RTSPCamera
      setDeviceType(type)
      setEditingDevice({
        name: camera.name,
        ip: camera.ip,
        port: camera.port,
        username: camera.username,
        password: camera.password,
        path: camera.path,
        always_recording: camera.always_recording,
        detection_mode: camera.detection_mode,
        detection_roi: camera.detection_roi || null,
      })
      // Restore ROI rects from existing data (array of polygons)
      if (camera.detection_roi) {
        try {
          const polygons = JSON.parse(camera.detection_roi)
          if (Array.isArray(polygons)) {
            const rects = polygons
              .filter((poly: number[][]) => Array.isArray(poly) && poly.length === 4)
              .map((poly: number[][]) => ({
                x: poly[0][0],
                y: poly[0][1],
                w: poly[1][0] - poly[0][0],
                h: poly[2][1] - poly[0][1],
              }))
            setRoiRects(rects)
          }
        } catch {
          setRoiRects([])
        }
      } else {
        setRoiRects([])
      }
      setSelectedRoiIndex(null)
      setIsCreating(false)
      setIsDialogOpen(true)
    } else if (type === "sensor") {
      const sensor = device as Sensor
      setDeviceType(type)
      setEditingDevice({
        id: sensor.id,
        name: sensor.name,
        gpio_pin_number: sensor.gpio_pin_number,
        gpio_server_url: sensor.gpio_server_url,
      })
      setIsCreating(false)
      setIsDialogOpen(true)
    }
  }

  const handleDeleteDevice = async (id: string, type: "camera" | "sensor") => {
    try {
      if (type === "camera") {
        await deleteRTSPCamera(id)
        setRtspCameras(rtspCameras.filter((camera) => camera.ip !== id))
      } else if (type === "sensor") {
        if (eventSources.current[id]) {
          eventSources.current[id].close()
          delete eventSources.current[id]
        }
        if (reconnectTimeouts.current[id]) {
          clearTimeout(reconnectTimeouts.current[id])
          delete reconnectTimeouts.current[id]
        }
        await deleteSensor(id)
        setSensors(sensors.filter((sensor) => sensor.id !== id))
      }
    } catch (error) {
      setErrorMessage(`Failed to delete ${type}`)
    }
  }

  const handleSaveDevice = async () => {
    if (!editingDevice) return

    try {
      if (deviceType === "camera") {
        const camera = editingDevice as CameraInputDto
        if (isCreating) {
          const newCamera = await createRTSPCamera(camera)
          setRtspCameras([...rtspCameras, newCamera])
        } else {
          const updatedCamera = await updateRTSPCamera(camera.ip, camera)
          setRtspCameras(rtspCameras.map((c) => (c.ip === updatedCamera.ip ? updatedCamera : c)))
        }
      } else if (deviceType === "sensor") {
        const sensor = editingDevice as SensorInputDto
        if (isCreating) {
          const { id, ...sensorData } = sensor
          const newSensor = await createSensor(sensorData)
          setSensors([...sensors, newSensor])
        } else if (sensor.id) {
          const updatedSensor = await updateSensor(sensor.id, sensor)
          setSensors(sensors.map((s) => (s.id === updatedSensor.id ? updatedSensor : s)))
        }
      }
      setIsDialogOpen(false)
      setEditingDevice(null)
      setSnapshotUrl(null)
      setRoiRects([])
      setSelectedRoiIndex(null)
    } catch (error) {
      setErrorMessage(`Failed to ${isCreating ? "create" : "update"} ${deviceType}`)
    }
  }

  const getStatusDisplay = (sensorId: string): string => {
    const status = sensorStatuses[sensorId]
    const connection = connectionStatus[sensorId]

    if (connection === "connecting") return "Connecting..."
    if (connection === "error" && streamErrors[sensorId] > 3) return "Connection Error"
    if (!status || status === "UNKNOWN") return "Unknown"

    return status
  }

  const getStatusColor = (sensorId: string): string => {
    const connection = connectionStatus[sensorId]
    const status = sensorStatuses[sensorId]

    if (connection === "error" && streamErrors[sensorId] > 3) return "text-red-500"
    if (connection === "connecting") return "text-yellow-500"
    if (!status || status === "UNKNOWN") return "text-gray-500"
    if (status === "HIGH") return "text-red-500"

    return "text-zinc-300"
  }

  const fetchSnapshot = async () => {
    const cam = editingDevice as CameraInputDto
    if (!cam?.ip || !cam?.port || !cam?.path) return
    setSnapshotLoading(true)
    setSnapshotUrl(null)
    setRoiStart(null)
    setRoiEnd(null)
    try {
      const url = await getCameraSnapshot(cam)
      setSnapshotUrl(url)
    } catch {
      setSnapshotUrl(null)
    } finally {
      setSnapshotLoading(false)
    }
  }

  const ROI_CANVAS_W = 640
  const ROI_CANVAS_H = 360

  const rectsToRoiJson = (rects: { x: number; y: number; w: number; h: number }[]): string | null => {
    if (rects.length === 0) return null
    const polygons = rects.map(r => [
      [r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]
    ])
    return JSON.stringify(polygons)
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !snapshotUrl) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      canvas.width = ROI_CANVAS_W
      canvas.height = ROI_CANVAS_H
      ctx.drawImage(img, 0, 0, ROI_CANVAS_W, ROI_CANVAS_H)
      // Draw existing ROI rects
      roiRects.forEach((rect, i) => {
        const isSelected = i === selectedRoiIndex
        const px = rect.x * ROI_CANVAS_W
        const py = rect.y * ROI_CANVAS_H
        const pw = rect.w * ROI_CANVAS_W
        const ph = rect.h * ROI_CANVAS_H
        ctx.strokeStyle = isSelected ? "#ff6600" : "#00ff00"
        ctx.lineWidth = isSelected ? 3 : 2
        ctx.strokeRect(px, py, pw, ph)
        ctx.fillStyle = isSelected ? "rgba(255, 102, 0, 0.15)" : "rgba(0, 255, 0, 0.1)"
        ctx.fillRect(px, py, pw, ph)
        // Draw number label
        ctx.font = "bold 16px sans-serif"
        ctx.fillStyle = isSelected ? "#ff6600" : "#00ff00"
        ctx.fillText(`${i + 1}`, px + 4, py + 16)
      })
      // Draw in-progress drag
      if (roiStart && roiEnd) {
        const x = Math.min(roiStart.x, roiEnd.x)
        const y = Math.min(roiStart.y, roiEnd.y)
        const w = Math.abs(roiEnd.x - roiStart.x)
        const h = Math.abs(roiEnd.y - roiStart.y)
        ctx.strokeStyle = "#ffff00"
        ctx.lineWidth = 2
        ctx.setLineDash([6, 3])
        ctx.strokeRect(x * ROI_CANVAS_W, y * ROI_CANVAS_H, w * ROI_CANVAS_W, h * ROI_CANVAS_H)
        ctx.setLineDash([])
      }
    }
    img.src = snapshotUrl
  }

  // Redraw canvas when snapshot, roi, or drag changes
  useEffect(() => {
    drawCanvas()
  }, [snapshotUrl, roiRects, selectedRoiIndex, roiStart, roiEnd])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const x = (e.clientX - bounds.left) / bounds.width
    const y = (e.clientY - bounds.top) / bounds.height

    // Check if clicking on an existing rect (select it)
    for (let i = roiRects.length - 1; i >= 0; i--) {
      const r = roiRects[i]
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        setSelectedRoiIndex(i)
        return
      }
    }

    // Deselect
    setSelectedRoiIndex(null)

    // Start new rect if under limit
    if (roiRects.length >= MAX_ROI_RECTS) return
    setRoiStart({ x, y })
    setRoiEnd({ x, y })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!roiStart) return
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width))
    const y = Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height))
    setRoiEnd({ x, y })
  }

  const handleCanvasMouseUp = () => {
    if (!roiStart || !roiEnd) return
    const x = Math.min(roiStart.x, roiEnd.x)
    const y = Math.min(roiStart.y, roiEnd.y)
    const w = Math.abs(roiEnd.x - roiStart.x)
    const h = Math.abs(roiEnd.y - roiStart.y)
    if (w > 0.01 && h > 0.01) {
      const newRects = [...roiRects, { x, y, w, h }]
      setRoiRects(newRects)
      setSelectedRoiIndex(newRects.length - 1)
      setEditingDevice((prev) => prev ? { ...prev, detection_roi: rectsToRoiJson(newRects) } : null)
    }
    setRoiStart(null)
    setRoiEnd(null)
  }

  const handleDeleteSelectedRoi = () => {
    if (selectedRoiIndex === null) return
    const newRects = roiRects.filter((_, i) => i !== selectedRoiIndex)
    setRoiRects(newRects)
    setSelectedRoiIndex(null)
    setEditingDevice((prev) => prev ? { ...prev, detection_roi: rectsToRoiJson(newRects) } : null)
  }

  const handleOpenLiveStream = (camera: RTSPCamera) => {
    setSelectedStreamCamera(camera)
    setStreamLoading(true)
    setStreamError(false)
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-zinc-50 mb-6">Devices</h1>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">RTSP cameras</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice("camera")}
          >
            Add camera
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {isLoadingCameras ? (
          <p className="text-zinc-300">Loading RTSP cameras...</p>
        ) : rtspCameras.length === 0 ? (
          <p className="text-zinc-300">No RTSP cameras found.</p>
        ) : (
          rtspCameras.map((camera) => (
            <Card key={camera.ip} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50">{camera.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <div>
                  <p className="text-zinc-300">IP: {camera.ip}</p>
                  <p className="text-zinc-300">Path: {camera.path}</p>
                  <p className="text-zinc-300">Always recording: {camera.always_recording ? "Yes" : "No"}</p>
                  {camera.detection_mode && (
                    <p className="text-zinc-300">Detection: {camera.detection_mode === "motion" ? "Motion" : "Motion + Person"}{camera.detection_roi ? (() => { try { const p = JSON.parse(camera.detection_roi); return ` (${p.length} ROI)` } catch { return " (ROI)" } })() : ""}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col mt-auto space-y-2">
                {canAccessRecordings && (
                  <Button
                    variant="outline"
                    className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                    onClick={() => handleOpenLiveStream(camera)}
                  >
                    <Wifi className="mr-2 h-4 w-4" />
                    Live Stream
                  </Button>
                )}
                {canModifyDevices && (
                  <div className="flex w-full gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                      onClick={() => handleEditDevice(camera, "camera")}
                    >
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="flex-1 bg-red-900 hover:bg-red-800">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the camera.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDevice(camera.ip, "camera")}
                            className="bg-red-900 hover:bg-red-800 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-50 mb-2 sm:mb-0">Sensors</h2>
        {canModifyDevices && (
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            onClick={() => handleAddDevice("sensor")}
            disabled={!isLoadingServers && gpioServers.length === 0}
          >
            Add sensor
          </Button>
        )}
      </div>
      {!isLoadingServers && gpioServers.length === 0 && (
        <p className="text-yellow-500 mb-4">No GPIO servers configured. Add them in the Configuration page.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingSensors ? (
          <p className="text-zinc-300">Loading sensors...</p>
        ) : sensors.length === 0 ? (
          <p className="text-zinc-300">No sensors found.</p>
        ) : (
          sensors.map((sensor) => (
            <Card key={sensor.id} className="bg-zinc-800 border-zinc-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-zinc-50 flex justify-between items-center">
                  <span>{sensor.name}</span>
                  {streamErrors[sensor.id] > 3 && (
                    <span className="text-xs text-yellow-500" title="Connection issues detected">
                      ⚠️
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-zinc-300">GPIO Pin: {sensor.gpio_pin_number}</p>
                <p className="text-zinc-300 text-sm">Server: {sensor.gpio_server_url}</p>
                <p className={`mt-6 ${getStatusColor(sensor.id)}`}>
                  Current Status: {getStatusDisplay(sensor.id)}
                </p>
              </CardContent>
              {canModifyDevices && (
                <CardFooter className="flex flex-col mt-auto">
                  <div className="flex w-full">
                    <Button
                      variant="outline"
                      className="flex-1 mr-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                      onClick={() => handleEditDevice(sensor, "sensor")}
                      disabled={sensor.listening}
                    >
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="flex-1 ml-1 bg-red-900 hover:bg-red-800"
                          disabled={sensor.listening}
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the sensor.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDevice(sensor.id, "sensor")}
                            className="bg-red-900 hover:bg-red-800 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              )}
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={!!selectedStreamCamera}
        onOpenChange={(open) => {
          if (!open) {
            const videoElement = document.querySelector('video') as HTMLVideoElement
            if (videoElement) {
              videoElement.pause()
              videoElement.removeAttribute('src')
              const sources = videoElement.querySelectorAll('source')
              sources.forEach(source => source.remove())
              videoElement.load()
            }

            setSelectedStreamCamera(null)
            setStreamLoading(false)
            setStreamError(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Live Stream: {selectedStreamCamera?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Camera IP: {selectedStreamCamera?.ip} | Port: {selectedStreamCamera?.port}
            </DialogDescription>
          </DialogHeader>

          {selectedStreamCamera && (
            <div className="flex-grow overflow-hidden relative bg-black rounded-lg">
              {streamLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                </div>
              )}
              {streamError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
                  <WifiOff className="h-12 w-12 text-red-500 mb-4" />
                  <p className="text-zinc-300">Camera stream unavailable</p>
                  <Button
                    onClick={() => {
                      setStreamLoading(true)
                      setStreamError(false)
                      const videoElement = document.querySelector('video') as HTMLVideoElement
                      if (videoElement) {
                        videoElement.load()
                      }
                    }}
                    className="mt-4 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                  >
                    Retry Connection
                  </Button>
                </div>
              )}
              {selectedStreamCamera && (
                <video
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                  playsInline
                  onLoadStart={() => setStreamLoading(true)}
                  onLoadedData={() => {
                    setStreamLoading(false)
                    setStreamError(false)
                  }}
                  onError={() => {
                    setStreamLoading(false)
                    setStreamError(true)
                  }}
                  style={{
                    display: streamError ? 'none' : 'block',
                    pointerEvents: 'none',
                    userSelect: 'none'
                  }}
                >
                  <source
                    src={getCameraStreamUrl(selectedStreamCamera.ip)}
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setSnapshotUrl(null); setRoiRects([]); setSelectedRoiIndex(null) } }}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Add" : "Edit"} {deviceType === "camera" ? "Camera" : "Sensor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="device-name" className="text-zinc-50 mb-2 block">
                Name
              </Label>
              <Input
                id="device-name"
                placeholder="Name"
                value={editingDevice?.name || ""}
                onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
                required
              />
            </div>
            {deviceType === "camera" ? (
              <>
                <div>
                  <Label htmlFor="camera-ip" className="text-zinc-50 mb-2 block">
                    IP Address
                  </Label>
                  <Input
                    id="camera-ip"
                    placeholder="IP"
                    value={(editingDevice as CameraInputDto)?.ip || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, ip: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 disabled:opacity-50"
                    disabled={!isCreating}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="camera-port" className="text-zinc-50 mb-2 block">
                    Port
                  </Label>
                  <Input
                    id="camera-port"
                    type="number"
                    placeholder="Port"
                    value={(editingDevice as CameraInputDto)?.port || ""}
                    onChange={(e) =>
                      setEditingDevice((prev) => (prev ? { ...prev, port: Number.parseInt(e.target.value) } : null))
                    }
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 disabled:opacity-50"
                    disabled={!isCreating}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="camera-username" className="text-zinc-50 mb-2 block">
                    Username
                  </Label>
                  <Input
                    id="camera-username"
                    placeholder="Username"
                    value={(editingDevice as CameraInputDto)?.username || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, username: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 disabled:opacity-50"
                    disabled={!isCreating}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="camera-password" className="text-zinc-50 mb-2 block">
                    Password
                  </Label>
                  <Input
                    id="camera-password"
                    type={isCreating ? "password" : "text"}
                    placeholder="Password"
                    value={(editingDevice as CameraInputDto)?.password || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, password: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 disabled:opacity-50"
                    disabled={!isCreating}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="camera-path" className="text-zinc-50 mb-2 block">
                    Path
                  </Label>
                  <Input
                    id="camera-path"
                    placeholder="Path"
                    value={(editingDevice as CameraInputDto)?.path || ""}
                    onChange={(e) => setEditingDevice((prev) => (prev ? { ...prev, path: e.target.value } : null))}
                    className="bg-zinc-700 text-zinc-50 border-zinc-600 disabled:opacity-50"
                    disabled={!isCreating}
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="always-recording" className="text-zinc-50">
                    Always recording
                  </Label>
                  <Switch
                    id="always-recording"
                    checked={(editingDevice as CameraInputDto)?.always_recording || false}
                    onCheckedChange={(checked) => {
                      setEditingDevice((prev) => (prev ? { ...prev, always_recording: checked, detection_mode: checked ? (prev as CameraInputDto).detection_mode : null, detection_roi: checked ? (prev as CameraInputDto).detection_roi : null } : null))
                      if (!checked) { setRoiRects([]); setSelectedRoiIndex(null) }
                    }}
                    className="data-[state=unchecked]:bg-zinc-700 data-[state=unchecked]:border-zinc-600 disabled:opacity-50"
                    disabled={!isCreating}
                  />
                </div>
                {(editingDevice as CameraInputDto)?.always_recording && (
                  <div>
                    <Label htmlFor="detection-mode" className="text-zinc-50 mb-2 block">
                      Motion detection
                    </Label>
                    <Select
                      value={(editingDevice as CameraInputDto)?.detection_mode || "none"}
                      onValueChange={(value) => {
                        setEditingDevice((prev) => (prev ? { ...prev, detection_mode: value === "none" ? null : value, detection_roi: value === "none" ? null : (prev as CameraInputDto).detection_roi } : null))
                        if (value === "none") { setSnapshotUrl(null); setRoiRects([]); setSelectedRoiIndex(null) }
                      }
                      }
                    >
                      <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 text-zinc-50 border-zinc-700">
                        <SelectItem value="none">Disabled</SelectItem>
                        <SelectItem value="motion">Motion only</SelectItem>
                        <SelectItem value="motion+person">Motion + Person (YOLO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(editingDevice as CameraInputDto)?.detection_mode && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                      onClick={() => { setIsRoiDialogOpen(true); if (!snapshotUrl) fetchSnapshot() }}
                      disabled={!(editingDevice as CameraInputDto)?.ip || !(editingDevice as CameraInputDto)?.path}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {roiRects.length > 0 ? `Edit detection area (${roiRects.length})` : "Set detection area"}
                    </Button>
                    {roiRects.length > 0 && (
                      <span className="text-xs text-green-400 whitespace-nowrap">{roiRects.length} ROI</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="gpio-server" className="text-zinc-50 mb-2 block">
                    GPIO Server
                  </Label>
                  <Select
                    value={(editingDevice as SensorInputDto)?.gpio_server_url || ""}
                    onValueChange={(value) =>
                      setEditingDevice((prev) => (prev ? { ...prev, gpio_server_url: value } : null))
                    }
                    disabled={!isCreating}
                  >
                    <SelectTrigger className="bg-zinc-700 text-zinc-50 border-zinc-600">
                      <SelectValue placeholder="Select a GPIO server" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 text-zinc-50 border-zinc-700">
                      {gpioServers.map((server) => (
                        <SelectItem key={server} value={server}>
                          {server}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  placeholder="GPIO Pin Number"
                  value={(editingDevice as SensorInputDto)?.gpio_pin_number || ""}
                  onChange={(e) =>
                    setEditingDevice((prev) =>
                      prev ? { ...prev, gpio_pin_number: Number.parseInt(e.target.value) } : null,
                    )
                  }
                  className="bg-zinc-700 text-zinc-50 border-zinc-600"
                  disabled={!isCreating}
                  required
                />
              </>
            )}
            <Button
              onClick={handleSaveDevice}
              className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
            >
              {isCreating ? "Create" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoiDialogOpen} onOpenChange={setIsRoiDialogOpen}>
        <DialogContent className="w-auto max-w-[95vw] bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Detection area</DialogTitle>
            <DialogDescription>
              Draw up to {MAX_ROI_RECTS} rectangles to limit the detection area. Click a rectangle to select it. Leave empty for full frame.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {snapshotLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              </div>
            )}
            {!snapshotLoading && !snapshotUrl && (
              <p className="text-zinc-400 py-12">Could not load camera snapshot.</p>
            )}
            {snapshotUrl && (
              <canvas
                ref={canvasRef}
                className="cursor-crosshair rounded border border-zinc-600 w-full max-w-[640px] touch-none"
                style={{ aspectRatio: "16/9" }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; handleCanvasMouseDown({ clientX: t.clientX, clientY: t.clientY, currentTarget: e.currentTarget } as unknown as React.MouseEvent<HTMLCanvasElement>) }}
                onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; handleCanvasMouseMove({ clientX: t.clientX, clientY: t.clientY, currentTarget: e.currentTarget } as unknown as React.MouseEvent<HTMLCanvasElement>) }}
                onTouchEnd={(e) => { e.preventDefault(); handleCanvasMouseUp() }}
              />
            )}
            {snapshotUrl && (
              <p className="text-xs text-zinc-400">
                {roiRects.length}/{MAX_ROI_RECTS} areas{roiRects.length >= MAX_ROI_RECTS ? " (max reached)" : ""}
              </p>
            )}
            <div className="flex gap-2 w-full">
              {snapshotUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                  onClick={fetchSnapshot}
                  disabled={snapshotLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Reload
                </Button>
              )}
              {selectedRoiIndex !== null && (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-red-900 text-zinc-50 hover:bg-red-800"
                  onClick={handleDeleteSelectedRoi}
                >
                  Delete #{selectedRoiIndex + 1}
                </Button>
              )}
              {roiRects.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                  onClick={() => {
                    setRoiRects([])
                    setSelectedRoiIndex(null)
                    setEditingDevice((prev) => prev ? { ...prev, detection_roi: null } : null)
                  }}
                >
                  Clear all
                </Button>
              )}
              <div className="flex-1" />
              <Button
                className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600"
                onClick={() => setIsRoiDialogOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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