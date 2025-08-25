import type {
  NtfyCredentials,
  User,
  DeviceGroup,
  Permission,
  Sensor,
  RTSPCamera,
  AlarmAudioConfig,
  Recording,
  StorageInfo,
  SensorStatus,
  RecordingType,
  AlarmNotification
} from "@/types"

const getApiBaseUrl = () => {
  return "/api"
}

export const registerUser = async (username: string, password: string, pin: string): Promise<void> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/users/first`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
        pin,
        permissions: [],
      }),
    })

    if (!response.ok) {
      throw new Error("Registration failed")
    }
  } catch (error) {
    throw error
  }
}

export const loginAndSetToken = async (username: string, password: string, rememberMe: boolean): Promise<string> => {
  let token: string | null = null
  let tokenExpiry: Date | null = null
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/auth/token?rememberme=${rememberMe}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    })

    if (!response.ok) {
      throw new Error("Login failed")
    }

    const data = await response.json()

    if (data.access_token) {
      token = data.access_token
      if (token !== null) {
        localStorage.setItem("token", token)
      } else {
        throw new Error("Login failed: No access token received")
      }
      if (rememberMe) {
        tokenExpiry = null
        localStorage.setItem("tokenExpiry", "infinite")
      } else {
        tokenExpiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
        localStorage.setItem("tokenExpiry", tokenExpiry.toISOString())
      }

      return token
    } else {
      throw new Error("Login failed: No access token received")
    }
  } catch (error) {
    throw error
  }
}

export const getTokenOrThrow = (): string => {
  const token = localStorage.getItem("token")
  if (!token || token.trim() === "") {
    throw new Error("Token not found in storage")
  }
  return token
}

export const getUserMyself = async (): Promise<User> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/auth/user`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch user data")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const getPermissions = async (): Promise<Permission[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/auth/permissions`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch user permissions")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const logout = () => {
  localStorage.removeItem("token")
  localStorage.removeItem("tokenExpiry")
}

export const isFirstUser = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/info/is-initialized`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch if first user")
    }

    const data = await response.json()
    return !data.is_initialized
  } catch (error) {
    throw new Error("Failed to fetch if first user")
  }
}

export const getDeviceGroups = async (): Promise<DeviceGroup[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch device groups")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const createDeviceGroup = async (group: Omit<DeviceGroup, "id" | "status">): Promise<DeviceGroup> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(group),
    })

    if (!response.ok) {
      throw new Error("Failed to create device group")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const deleteDeviceGroup = async (id: number): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete device group")
    }

    return true
  } catch (error) {
    throw error
  }
}

export const getDeviceGroupCameras = async (groupId: number): Promise<RTSPCamera[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/cameras`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch device group cameras")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const updateDeviceGroupCameras = async (groupId: number, cameraIps: string[]): Promise<RTSPCamera[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/cameras`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cameraIps),
    })

    if (!response.ok) {
      throw new Error("Failed to update device group cameras")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const updateDeviceGroup = async (id: number, group: DeviceGroup): Promise<DeviceGroup> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(group),
    })

    if (!response.ok) {
      throw new Error("Failed to update device group")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const getDeviceGroupStatusStream = (groupId: number) => {
  const token = getTokenOrThrow()
  const eventSource = new EventSource(
    `${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/status/stream?auth_token=${encodeURIComponent(token)}`,
    {},
  )
  return eventSource
}

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/users`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch users")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const createUser = async (user: Omit<User, "id">): Promise<User> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    })

    if (!response.ok) {
      throw new Error("Failed to create user")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const updateUser = async (id: number, updates: Partial<User>): Promise<User> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/users/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error("Failed to update user")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const deleteUser = async (id: number): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth-service/users/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete user")
    }

    return true
  } catch (error) {
    throw error
  }
}

// API functions
export const getAllSensors = async (): Promise<Sensor[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch sensors")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const createSensor = async (sensor: Omit<Sensor, "id" | "group_id" | "listening">): Promise<Sensor> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sensor),
    })

    if (!response.ok) {
      throw new Error("Failed to create sensor")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const updateSensor = async (gpioNumber: number, updates: Partial<Sensor>): Promise<Sensor> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/${gpioNumber}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error("Failed to update sensor")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const deleteSensor = async (gpioNumber: number): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/${gpioNumber}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete sensor")
    }

    return true
  } catch (error) {
    throw error
  }
}

export const getSensorCurrentStatus = async (gpioNumber: number): Promise<SensorStatus> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/${gpioNumber}/status`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to get sensor status")
    }

    const data = await response.json()
    return data.status
  } catch (error) {
    throw error
  }
}

export const getSensorStatusStream = (gpioNumber: number) => {
  const token = getTokenOrThrow()
  const eventSource = new EventSource(
    `${getApiBaseUrl()}/devices-manager-service/sensor/${gpioNumber}/status/stream?auth_token=${encodeURIComponent(token)}`,
    {},
  )
  return eventSource
}

export const getDeviceGroupSensors = async (groupId: number): Promise<Sensor[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/sensors`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch device group sensors")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const updateDeviceGroupSensors = async (groupId: number, sensorPins: number[]): Promise<Sensor[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/sensors`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sensorPins),
    })

    if (!response.ok) {
      throw new Error("Failed to update device group sensors")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const getAllRtspCameras = async (): Promise<RTSPCamera[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/camera/`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch RTSP cameras")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const getRTSPCamera = async (ip: string): Promise<RTSPCamera> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/camera/${ip}`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch RTSP camera")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const createRTSPCamera = async (
  camera: Omit<RTSPCamera, "id" | "group_id" | "listening">,
): Promise<RTSPCamera> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/camera/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(camera),
    })

    if (!response.ok) {
      throw new Error("Failed to create RTSP camera")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const updateRTSPCamera = async (ip: string, updates: Partial<RTSPCamera>): Promise<RTSPCamera> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/camera/${ip}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error("Failed to update RTSP camera")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const deleteRTSPCamera = async (ip: string): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/camera/${ip}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete RTSP camera")
    }

    return true
  } catch (error) {
    throw error
  }
}

export const getRTSPCameraStatus = async (ip: string): Promise<string> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/camera/${ip}/status`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to get RTSP camera status")
    }

    const data = await response.json()
    return data.status
  } catch (error) {
    throw error
  }
}

export const getRTSPCameraStreamUrl = (ip: string): string => {
  return `${getApiBaseUrl()}/devices-manager-service/static/${ip}.m3u8?auth_token=${getTokenOrThrow()}`
}

export const getNtfyCredentials = async (): Promise<NtfyCredentials> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/notifications-service/ntfy-config/credentials`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch Ntfy credentials")
    }

    const credentials: NtfyCredentials = await response.json()
    return credentials
  } catch (error) {
    throw error
  }
}

export const updateNtfyCredentials = async (): Promise<NtfyCredentials> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/notifications-service/ntfy-config/credentials`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to update Ntfy credentials")
    }

    const credentials: NtfyCredentials = await response.json()
    return credentials
  } catch (error) {
    throw error
  }
}

export const downloadAlarmAudio = async (onProgress?: (progress: number) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('GET', `${getApiBaseUrl()}/audio-service/audio/`)
    xhr.setRequestHeader('Authorization', `Bearer ${getTokenOrThrow()}`)
    xhr.responseType = 'blob'

    xhr.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const contentDisposition = xhr.getResponseHeader('Content-Disposition')
        let filename = 'alarm.mp3'

        if (contentDisposition) {
          const rfc5987Match = contentDisposition.match(/filename\*=utf-8''([^;\n]+)/)
          if (rfc5987Match && rfc5987Match[1]) {
            filename = decodeURIComponent(rfc5987Match[1])
          } else {
            const standardMatch = contentDisposition.match(/filename="?([^";\n]+)"?/)
            if (standardMatch && standardMatch[1]) {
              filename = standardMatch[1]
            }
          }
        }

        const blob = xhr.response
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        resolve()
      } else {
        reject(new Error('Failed to download alarm audio file'))
      }
    }

    xhr.onerror = () => reject(new Error('Failed to download alarm audio file'))
    xhr.send()
  })
}

export const createAlarmAudioConfig = async (
  config: AlarmAudioConfig,
  onProgress?: (progress: number) => void
): Promise<AlarmAudioConfig> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    if (config.audio !== null) {
      formData.append('audio', config.audio)
    }

    xhr.open('POST', `${getApiBaseUrl()}/audio-service/audio/`)
    xhr.setRequestHeader('Authorization', `Bearer ${getTokenOrThrow()}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(config)
      } else {
        reject(new Error('Failed to create alarm audio configuration'))
      }
    }

    xhr.onerror = () => reject(new Error('Failed to create alarm audio configuration'))
    xhr.send(formData)
  })
}

export const getAlarmAudioConfig = async (): Promise<AlarmAudioConfig | null> => {
  try {
    // Use HEAD request to get file info without downloading the content
    const response = await fetch(`${getApiBaseUrl()}/audio-service/audio/`, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error("Failed to fetch alarm audio configuration")
    }

    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = "alarm.mp3" // default fallback

    if (contentDisposition) {
      // First try RFC 5987 format: filename*=utf-8''encoded-filename
      const rfc5987Match = contentDisposition.match(/filename\*=utf-8''([^;\n]+)/)
      if (rfc5987Match && rfc5987Match[1]) {
        // Decode URL-encoded filename
        filename = decodeURIComponent(rfc5987Match[1])
      } else {
        // Fallback to standard format: filename="filename" or filename=filename
        const standardMatch = contentDisposition.match(/filename="?([^";\n]+)"?/)
        if (standardMatch && standardMatch[1]) {
          filename = standardMatch[1]
        }
      }
    }

    // Create a placeholder File object with just the name (size 0)
    // This is sufficient for displaying the filename in the UI
    // The actual content is never used - only the name is shown
    return { audio: new File([], filename, { type: "audio/mpeg" }) }
  } catch (error) {
    throw error
  }
}

export const updateAlarmAudioConfig = async (
  config: AlarmAudioConfig,
  onProgress?: (progress: number) => void
): Promise<AlarmAudioConfig> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    if (config.audio !== null) {
      formData.append('audio', config.audio)
    }

    xhr.open('POST', `${getApiBaseUrl()}/audio-service/audio/`)
    xhr.setRequestHeader('Authorization', `Bearer ${getTokenOrThrow()}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(config)
      } else {
        reject(new Error('Failed to create alarm audio configuration'))
      }
    }

    xhr.onerror = () => reject(new Error('Failed to create alarm audio configuration'))
    xhr.send(formData)
  })
}

export const deleteAlarmAudioConfig = async (): Promise<void> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/audio-service/audio/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete alarm audio configuration")
    }
  } catch (error) {
    throw error
  }
}

export const startListening = async (groupId: number, pin: string): Promise<void> => {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/start-listening`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getTokenOrThrow()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      },
    )

    if (!response.ok) {
      throw new Error("Failed to start listening")
    }
  } catch (error) {
    throw error
  }
}

export const stopListening = async (groupId: number, pin: string): Promise<void> => {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/stop-listening`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getTokenOrThrow()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      },
    )

    if (!response.ok) {
      throw new Error("Failed to stop listening")
    }
  } catch (error) {
    throw error
  }
}

export const getAllRecordings = async (params?: {
  offset?: number
  type?: RecordingType
}): Promise<Recording[]> => {
  try {
    let url = `${getApiBaseUrl()}/devices-manager-service/recording`
    const queryParams: string[] = []

    if (params?.offset !== undefined) {
      queryParams.push(`offset=${params.offset}`)
    }

    if (params?.type) {
      queryParams.push(`type=${params.type}`)
    }

    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch recordings")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const deleteRecording = async (id: number): Promise<void> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/recording/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete recording")
    }
  } catch (error) {
    throw error
  }
}

export const deleteAllRecordings = async (): Promise<void> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/recording/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete all recordings")
    }
  } catch (error) {
    throw error
  }
}

export const getStorageInfo = async (): Promise<StorageInfo> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/disk-usage`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch storage information")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const getRecordingStreamUrl = (recordingId: number): string => {
  const token = getTokenOrThrow()
  return `${getApiBaseUrl()}/devices-manager-service/recording/${recordingId}/stream?auth_token=${encodeURIComponent(token)}`
}

export const getRecordingDownloadUrl = (recordingId: number): string => {
  const token = getTokenOrThrow()
  return `${getApiBaseUrl()}/devices-manager-service/recording/${recordingId}/download?auth_token=${encodeURIComponent(token)}`
}

export const getAllNotifications = async (params?: {
  offset?: number
}): Promise<AlarmNotification[]> => {
  try {
    let url = `${getApiBaseUrl()}/notifications-service/notification`
    const queryParams: string[] = []

    if (params?.offset !== undefined) {
      queryParams.push(`offset=${params.offset}`)
    }

    if (queryParams.length > 0) {
      url += `?${queryParams.join("&")}`
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch notifications")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}