import type {
  NtfyCredentials,
  FirebaseStatus,
  User,
  DeviceGroup,
  Permission,
  Sensor,
  RTSPCamera,
  AlarmAudioConfig,
  WarningAudioConfig,
  Recording,
  StorageInfo,
  SensorStatus,
  RecordingType,
  AlarmNotification,
  SystemConfig,
  GpioServerConfig,
  Mp3ServerConfig,
  ValveServerConfig,
  IrrigationZone,
  IrrigationSetup,
  SetupZoneSchedule,
  SetupDateRange,
  ValveStatus,
  ZoneMismatch
} from "@/types"

const getApiBaseUrl = () => {
  return "/api"
}

export async function getHealthStatus(): Promise<Record<string, string>> {
  const response = await fetch('/health')
  if (!response.ok) {
    throw new Error('Failed to fetch health status')
  }
  return response.json()
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
  const response = await fetch(`${getApiBaseUrl()}/auth-service/auth/user`, {
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
    },
  })

  if (!response.ok) {
    const error = new Error("Failed to fetch user data") as Error & { status: number }
    error.status = response.status
    throw error
  }

  return await response.json()
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

export const getAvailableGpioServers = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/servers`, {
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch GPIO servers")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

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

export const createSensor = async (sensor: Omit<Sensor, "id" | "listening">): Promise<Sensor> => {
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

export const updateSensor = async (sensorId: string, updates: Partial<Sensor>): Promise<Sensor> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/${sensorId}`, {
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

export const deleteSensor = async (sensorId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/${sensorId}`, {
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

export const getSensorCurrentStatus = async (sensorId: string): Promise<SensorStatus> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/sensor/${sensorId}/status`, {
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

export const getSensorStatusStream = (sensorId: string) => {
  const token = getTokenOrThrow()
  const eventSource = new EventSource(
    `${getApiBaseUrl()}/devices-manager-service/sensor/${sensorId}/status/stream?auth_token=${encodeURIComponent(token)}`,
    {},
  )
  return eventSource
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

export const updateDeviceGroupSensors = async (groupId: number, sensorIds: string[]): Promise<Sensor[]> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/sensors`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sensorIds),
    })

    if (!response.ok) {
      throw new Error("Failed to update device group sensors")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
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

export const getFirebaseStatus = async (): Promise<FirebaseStatus> => {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/notifications-service/firebase-config/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getTokenOrThrow()}`,
        },
      }
    )
    if (!response.ok) {
      throw new Error("Failed to fetch Firebase status")
    }
    return await response.json()
  } catch (error) {
    throw error
  }
}

export const setFirebaseCredentials = async (credentialsJson: string): Promise<void> => {
  const parsed = JSON.parse(credentialsJson)
  const response = await fetch(
    `${getApiBaseUrl()}/notifications-service/firebase-config/credentials`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed),
    }
  )
  if (!response.ok) {
    throw new Error("Failed to set Firebase credentials")
  }
}

export const deleteFirebaseCredentials = async (): Promise<void> => {
  const response = await fetch(
    `${getApiBaseUrl()}/notifications-service/firebase-config/credentials`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    }
  )
  if (!response.ok) {
    throw new Error("Failed to delete Firebase credentials")
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

// --- Warning audio ---

export const getWarningAudioConfig = async (): Promise<WarningAudioConfig | null> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/audio-service/audio/warning`, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error("Failed to fetch warning audio configuration")
    }

    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = "warning.mp3"

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

    return { audio: new File([], filename, { type: "audio/mpeg" }) }
  } catch (error) {
    throw error
  }
}

export const createWarningAudioConfig = async (
  config: WarningAudioConfig,
  onProgress?: (progress: number) => void
): Promise<WarningAudioConfig> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    if (config.audio !== null) {
      formData.append('audio', config.audio)
    }

    xhr.open('POST', `${getApiBaseUrl()}/audio-service/audio/warning`)
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
        reject(new Error('Failed to save warning audio configuration'))
      }
    }

    xhr.onerror = () => reject(new Error('Failed to save warning audio configuration'))
    xhr.send(formData)
  })
}

export const updateWarningAudioConfig = async (
  config: WarningAudioConfig,
  onProgress?: (progress: number) => void
): Promise<WarningAudioConfig> => {
  return createWarningAudioConfig(config, onProgress)
}

export const deleteWarningAudioConfig = async (): Promise<void> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/audio-service/audio/warning`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getTokenOrThrow()}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete warning audio configuration")
    }
  } catch (error) {
    throw error
  }
}

export const downloadWarningAudio = async (onProgress?: (progress: number) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('GET', `${getApiBaseUrl()}/audio-service/audio/warning`)
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
        const blob = xhr.response
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'warning.mp3'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        resolve()
      } else {
        reject(new Error('Failed to download warning audio file'))
      }
    }

    xhr.onerror = () => reject(new Error('Failed to download warning audio file'))
    xhr.send()
  })
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

export const getSnapshotUrl = (filename: string): string => {
  return `${getApiBaseUrl()}/notifications-service/notification/snapshot/${encodeURIComponent(filename)}`
}

export const getCameraStreamUrl = (cameraIp: string): string => {
  const token = getTokenOrThrow()
  return `${getApiBaseUrl()}/devices-manager-service/camera/${cameraIp}/stream?auth_token=${encodeURIComponent(token)}`
}

export const getCameraSnapshot = async (camera: { ip: string; port: number; username: string; password: string; path: string; name: string; always_recording: boolean; detection_mode: string | null }): Promise<string> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/camera/snapshot`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(camera),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || "Failed to get camera snapshot")
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

// --- System Config ---

export const getSystemConfig = async (): Promise<SystemConfig> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/`, {
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
    },
  })
  if (!response.ok) throw new Error("Failed to fetch system config")
  return response.json()
}

export const updateSystemConfig = async (key: string, value: string): Promise<void> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/${key}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to update config")
  }
}

// --- GPIO Servers ---

export const getGpioServers = async (): Promise<GpioServerConfig[]> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/gpio-servers`, {
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
    },
  })
  if (!response.ok) throw new Error("Failed to fetch GPIO servers")
  return response.json()
}

export const createGpioServer = async (url: string): Promise<GpioServerConfig> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/gpio-servers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to create GPIO server")
  }
  return response.json()
}

export const deleteGpioServer = async (id: number): Promise<void> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/gpio-servers/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
    },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to delete GPIO server")
  }
}

// --- MP3 Servers ---

export const getMp3Servers = async (): Promise<Mp3ServerConfig[]> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/mp3-servers`, {
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
    },
  })
  if (!response.ok) throw new Error("Failed to fetch MP3 servers")
  return response.json()
}

export const createMp3Server = async (server: Omit<Mp3ServerConfig, "id">): Promise<Mp3ServerConfig> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/mp3-servers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(server),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to create MP3 server")
  }
  return response.json()
}

export const updateMp3Server = async (id: number, server: Mp3ServerConfig): Promise<Mp3ServerConfig> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/mp3-servers/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(server),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to update MP3 server")
  }
  return response.json()
}

export const deleteMp3Server = async (id: number): Promise<void> => {
  const response = await fetch(`${getApiBaseUrl()}/devices-manager-service/config/mp3-servers/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getTokenOrThrow()}`,
    },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to delete MP3 server")
  }
}

// --- Irrigation ---

const IRRIGATION_BASE = "/api/irrigation-service"

export const getValveServer = async (): Promise<ValveServerConfig> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/config/valve-server`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const setValveServer = async (url: string, timezone: string): Promise<ValveServerConfig> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/config/valve-server`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, timezone }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const deleteValveServer = async (): Promise<void> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/config/valve-server`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
}

export const getIrrigationZones = async (): Promise<IrrigationZone[]> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/zones/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const syncIrrigationZones = async (): Promise<IrrigationZone[]> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/zones/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const updateZoneName = async (zoneId: number, name: string): Promise<IrrigationZone> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/zones/${zoneId}/name`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const getZoneStatus = async (): Promise<ValveStatus> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/zones/status`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const getZoneStatusStream = (): EventSource => {
  const token = getTokenOrThrow()
  return new EventSource(`${IRRIGATION_BASE}/zones/status/stream?auth_token=${encodeURIComponent(token)}`)
}

export const getSetups = async (): Promise<IrrigationSetup[]> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const createSetup = async (name: string, color: string = "#22c55e"): Promise<IrrigationSetup> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const updateSetup = async (setupId: number, name: string, color: string): Promise<IrrigationSetup> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed to update setup")
  }
  return r.json()
}

export const deleteSetup = async (setupId: number): Promise<void> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
}

export const getSchedules = async (setupId: number): Promise<SetupZoneSchedule[]> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}/schedules/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const addSchedule = async (
  setupId: number,
  zoneId: number,
  daysOfWeek: number[],
  startTime: string,
  endTime: string
): Promise<SetupZoneSchedule[]> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}/schedules/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ zone_id: zoneId, days_of_week: daysOfWeek, start_time: startTime, end_time: endTime }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const deleteSchedule = async (setupId: number, scheduleId: number): Promise<void> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}/schedules/${scheduleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
}

export const getDateRanges = async (setupId: number): Promise<SetupDateRange[]> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}/date-ranges/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const addDateRange = async (setupId: number, startDate: string, endDate: string): Promise<SetupDateRange> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}/date-ranges/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ start_date: startDate, end_date: endDate }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
  return r.json()
}

export const deleteDateRange = async (setupId: number, rangeId: number): Promise<void> => {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/setups/${setupId}/date-ranges/${rangeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed")
  }
}

export async function openValveManual(zoneNumber: string): Promise<void> {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/zones/${zoneNumber}/open`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed to open valve")
  }
}

export async function closeValveManual(): Promise<void> {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/zones/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(err.detail || "Failed to close valve")
  }
}

export async function getZonesMismatch(): Promise<ZoneMismatch> {
  const token = getTokenOrThrow()
  const r = await fetch(`${IRRIGATION_BASE}/zones/mismatch`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error("Failed to check zone mismatch")
  return r.json()
}
