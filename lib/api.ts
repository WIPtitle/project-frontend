import { NtfyCredentials, User, DeviceGroup, Permission, MagneticReed, RTSPCamera, AlarmAudioConfig, Recording, StorageInfo } from '@/types'

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`
  }
  return '' // Fallback for server-side rendering
}

export const registerUser = async (email: string, password: string, pin: string): Promise<void> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/users/first`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',

      },
      body: JSON.stringify({
        email,
        password,
        pin,
        permissions: [],
      }),
    })

    if (!response.ok) {
      throw new Error('Registration failed')
    }

  } catch (error) {
    throw error
  }
}

export const loginAndSetToken = async (email: string, password: string, rememberMe: boolean): Promise<string> => {
  let token: string | null = null
  let tokenExpiry: Date | null = null
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/auth/token?rememberme=${rememberMe}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    })

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = await response.json()

    if (data.access_token) {
      token = data.access_token
      if (token !== null) {
        localStorage.setItem('token', token)
      } else {
        throw new Error('Login failed: No access token received')
      }
      if (rememberMe) {
        tokenExpiry = null
        localStorage.setItem('tokenExpiry', 'infinite')
      } else {
        tokenExpiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
        localStorage.setItem('tokenExpiry', tokenExpiry.toISOString())
      }

      return token
    } else {
      throw new Error('Login failed: No access token received')
    }
  } catch (error) {
    throw error
  }
}

export const getTokenOrThrow = (): string => {
  const token = localStorage.getItem('token');
  if (!token || token.trim() === "") {
    throw new Error("Token not found in storage");
  }
  return token;
};

export const getUserMyself = async (): Promise<User> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/auth/user`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,

      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user data')
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const getPermissions = async (): Promise<Permission[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/auth/permissions`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,

      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user permissions')
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('tokenExpiry')
}

export const isFirstUser = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/info/is-initialized`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',

      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch if first user');
    }

    const data = await response.json();
    return !data.is_initialized;
  } catch (error) {
    throw new Error('Failed to fetch if first user');
  }
};

export const getDeviceGroups = async (): Promise<DeviceGroup[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch device groups');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const createDeviceGroup = async (group: Omit<DeviceGroup, 'id' | 'status'>): Promise<DeviceGroup> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(group),
    });

    if (!response.ok) {
      throw new Error('Failed to create device group');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}


export const deleteDeviceGroup = async (id: number): Promise<boolean> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete device group');
    }

    return true;
  } catch (error) {
    throw error;
  }
}


export const getDeviceGroupCameras = async (groupId: number): Promise<RTSPCamera[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/cameras`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch device group cameras');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const updateDeviceGroupCameras = async (groupId: number, cameraIps: string[]): Promise<RTSPCamera[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/cameras`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cameraIps),
    });

    if (!response.ok) {
      throw new Error('Failed to update device group cameras');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const getDeviceGroupReeds = async (groupId: number): Promise<MagneticReed[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/reeds`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch device group reeds');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const updateDeviceGroupReeds = async (groupId: number, reedPins: number[]): Promise<MagneticReed[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/reeds`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reedPins),
    });

    if (!response.ok) {
      throw new Error('Failed to update device group reeds');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const updateDeviceGroup = async (id: number, group: DeviceGroup): Promise<DeviceGroup> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(group),
    });

    if (!response.ok) {
      throw new Error('Failed to update device group');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const getDeviceGroupStatusStream = (groupId: number) => {
  const token = getTokenOrThrow();
  const eventSource = new EventSource(
    `${getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/status/stream?auth_token=${encodeURIComponent(token)}`,
    {}
  );
  return eventSource;
}

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const createUser = async (user: Omit<User, 'id'>): Promise<User> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    });

    if (!response.ok) {
      throw new Error('Failed to create user');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const updateUser = async (id: number, updates: Partial<User>): Promise<User> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/users/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update user');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const deleteUser = async (id: number): Promise<boolean> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/auth-service/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete user');
    }

    return true;
  } catch (error) {
    throw error;
  }
};


// API functions
export const getAllMagneticReeds = async (): Promise<MagneticReed[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/reed/`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch magnetic reeds');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const createMagneticReed = async (reed: Omit<MagneticReed, 'id' | 'group_id' | 'listening'>): Promise<MagneticReed> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/reed/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reed),
    });

    if (!response.ok) {
      throw new Error('Failed to create magnetic reed');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const updateMagneticReed = async (gpioNumber: number, updates: Partial<MagneticReed>): Promise<MagneticReed> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/reed/${gpioNumber}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update magnetic reed');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const deleteMagneticReed = async (gpioNumber: number): Promise<boolean> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/reed/${gpioNumber}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete magnetic reed');
    }

    return true;
  } catch (error) {
    throw error;
  }
}

export const getReedCurrentStatus = async (gpioNumber: number): Promise<string> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/reed/${gpioNumber}/status`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get magnetic reed status');
    }

    const data = await response.json();
    return data.status;
  } catch (error) {
    throw error;
  }
}

export const getAllRtspCameras = async (): Promise<RTSPCamera[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/camera/`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch RTSP cameras');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const getRTSPCamera = async (ip: string): Promise<RTSPCamera> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/camera/${ip}`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch RTSP camera');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const createRTSPCamera = async (camera: Omit<RTSPCamera, 'id' | 'group_id' | 'listening'>): Promise<RTSPCamera> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/camera/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(camera),
    });

    if (!response.ok) {
      throw new Error('Failed to create RTSP camera');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const updateRTSPCamera = async (ip: string, updates: Partial<RTSPCamera>): Promise<RTSPCamera> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/camera/${ip}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update RTSP camera');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const deleteRTSPCamera = async (ip: string): Promise<boolean> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/camera/${ip}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete RTSP camera');
    }

    return true;
  } catch (error) {
    throw error;
  }
}

export const getRTSPCameraStatus = async (ip: string): Promise<string> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/camera/${ip}/status`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get RTSP camera status');
    }

    const data = await response.json();
    return data.status;
  } catch (error) {
    throw error;
  }
}

export const getRTSPCameraStreamUrl = (ip: string): string => {
  return `${getApiBaseUrl()}/devices-manager-service/camera/${ip}/stream?auth_token=${getTokenOrThrow()}`;
}

export const getNtfyCredentials = async (): Promise<NtfyCredentials> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/notifications-service/ntfy-config/credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Ntfy credentials');
    }

    const credentials: NtfyCredentials = await response.json();
    return credentials;
  } catch (error) {
    throw error;
  }
}

export const updateNtfyCredentials = async (): Promise<NtfyCredentials> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/notifications-service/ntfy-config/credentials`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to update Ntfy credentials');
    }

    const credentials: NtfyCredentials = await response.json();
    return credentials;
  } catch (error) {
    throw error;
  }
}

export const getAlarmAudioConfig = async (): Promise<AlarmAudioConfig | null> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/audio-service/audio/`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch alarm audio configuration');
    }

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'unknown';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    return { audio: new File([blob], filename, { type: 'audio/mpeg' })}
  } catch (error) {
    throw error;
  }
}

export const createAlarmAudioConfig = async (config: AlarmAudioConfig): Promise<AlarmAudioConfig> => {
  try {
    const formData = new FormData();
    if (config.audio !== null) {
      formData.append('audio', config.audio);
    }

    const response = await fetch(`${await getApiBaseUrl()}/audio-service/audio/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to create alarm audio configuration')
    }

    return config // Return the original config as the API doesn't return the file
  } catch (error) {
    throw error
  }
}

export const updateAlarmAudioConfig = async (config: AlarmAudioConfig): Promise<AlarmAudioConfig> => {
  return createAlarmAudioConfig(config)
}

export const deleteAlarmAudioConfig = async (): Promise<void> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/audio-service/audio/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete alarm audio configuration');
    }
  } catch (error) {
    throw error;
  }
}

export const startListening = async (groupId: number, pin: string): Promise<void> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/start-listening`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      throw new Error('Failed to start listening');
    }
  } catch (error) {
    throw error;
  }
}

export const stopListening = async (groupId: number, pin: string): Promise<void> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/device-group/${groupId}/stop-listening`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      throw new Error('Failed to stop listening');
    }
  } catch (error) {
    throw error;
  }
}

export const getAllRecordings = async (): Promise<Recording[]> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/recording`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recordings');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const deleteRecording = async (id: number): Promise<void> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/recording/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete recording');
    }
  } catch (error) {
    throw error;
  }
}

export const getStorageInfo = async (): Promise<StorageInfo> => {
  try {
    const response = await fetch(`${await getApiBaseUrl()}/devices-manager-service/disk-usage`, {
      headers: {
        'Authorization': `Bearer ${getTokenOrThrow()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch storage information');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export const getRecordingStreamUrl = (recordingId: number): string => {
  const token = getTokenOrThrow();
  return `${getApiBaseUrl()}/devices-manager-service/recording/${recordingId}/stream?auth_token=${encodeURIComponent(token)}`;
}

export const getRecordingDownloadUrl = (recordingId: number): string => {
  const token = getTokenOrThrow();
  return `${getApiBaseUrl()}/devices-manager-service/recording/${recordingId}/download?auth_token=${encodeURIComponent(token)}`;
}
