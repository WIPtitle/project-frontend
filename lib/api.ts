import { User, AlarmGroup, Device, Permission } from '@/types'

let token: string | null = null
let tokenExpiry: Date | null = null

export const isFirstUser = async (): Promise<boolean> => {
  // Always return true as requested
  return true
}

export const registerUser = async (username: string, password: string): Promise<void> => {
  // This is a mock implementation. In a real application, this would send the data to the backend.
  console.log(`Registering user: ${username}`)
  // No need to implement actual user saving as per the request
}

export const login = (username: string, password: string, rememberMe: boolean): User => {
  const fakeToken = 'fake_token_' + Math.random().toString(36).substr(2, 9)
  token = fakeToken
  if (rememberMe) {
    tokenExpiry = null
  } else {
    tokenExpiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
  }
  localStorage.setItem('token', fakeToken)
  localStorage.setItem('tokenExpiry', tokenExpiry ? tokenExpiry.toISOString() : 'infinite')
  
  // Return a mock user object (always admin as requested)
  return { id: 1, username: "admin", email: "admin@example.com", permissions: ["read", "write", "delete"] }
}

export const logout = () => {
  token = null
  tokenExpiry = null
  localStorage.removeItem('token')
  localStorage.removeItem('tokenExpiry')
}

export const getAllDevices = async (): Promise<Device[]> => {
  return [
    { id: 1, name: "Front Door Sensor" },
    { id: 2, name: "Living Room Motion Detector" },
    { id: 3, name: "Main Entrance Sensor" },
    { id: 4, name: "Server Room Sensor" },
    { id: 5, name: "Window Sensor" },
    { id: 6, name: "Garage Door Sensor" },
  ]
}

export const getAlarmGroups = async (): Promise<AlarmGroup[]> => {
  const devices = await getAllDevices()
  return [
    { 
      id: 1, 
      name: "Home Alarm", 
      devices: [devices[0], devices[1], devices[4]], 
      isActive: false 
    },
    { 
      id: 2, 
      name: "Office Alarm", 
      devices: [devices[2], devices[3]], 
      isActive: false 
    },
  ]
}

export const createAlarmGroup = async (group: Omit<AlarmGroup, 'id'>): Promise<AlarmGroup> => {
  return { ...group, id: Date.now() }
}

export const updateAlarmGroup = async (id: number, updates: Partial<AlarmGroup>): Promise<AlarmGroup> => {
  const groups = await getAlarmGroups()
  const updatedGroup = groups.find(g => g.id === id)
  if (!updatedGroup) throw new Error('Group not found')
  return { ...updatedGroup, ...updates }
}

export const deleteAlarmGroup = async (id: number): Promise<boolean> => {
  return true
}

export const activateAlarm = async (id: number): Promise<AlarmGroup> => {
  const groups = await getAlarmGroups()
  const updatedGroup = groups.find(g => g.id === id)
  if (!updatedGroup) throw new Error('Group not found')
  return { ...updatedGroup, isActive: true }
}

export const deactivateAlarm = async (id: number): Promise<AlarmGroup> => {
  const groups = await getAlarmGroups()
  const updatedGroup = groups.find(g => g.id === id)
  if (!updatedGroup) throw new Error('Group not found')
  return { ...updatedGroup, isActive: false }
}

export const getAllUsers = async (): Promise<User[]> => {
  return [
    { id: 1, username: "admin", email: "admin@example.com", permissions: ["read", "write", "delete"] },
    { id: 2, username: "user1", email: "user1@example.com", permissions: ["read"] },
    { id: 3, username: "user2", email: "user2@example.com", permissions: ["read", "write"] },
  ]
}

export const getUserMyself = async (): Promise<User> => {
  return { id: 1, username: "admin", email: "admin@example.com", permissions: ["read", "write", "delete"] }
}

export const createUser = async (user: Omit<User, 'id'>): Promise<User> => {
  return { ...user, id: Date.now() }
}

export const updateUser = async (id: number, updates: Partial<User>): Promise<User> => {
  const users = await getAllUsers()
  const updatedUser = users.find(u => u.id === id)
  if (!updatedUser) throw new Error('User not found')
  return { ...updatedUser, ...updates }
}

export const deleteUser = async (id: number): Promise<boolean> => {
  return true
}

const fakeMagneticReeds: MagneticReed[] = [
  { id: 1, name: "Reed 1", gpio_pin_number: 17, default_value_when_closed: "HIGH" },
  { id: 2, name: "Reed 2", gpio_pin_number: 27, default_value_when_closed: "LOW" },
];

const fakeRtspCameras: RTSPCamera[] = [
  { id: 1, name: "Camera 1", ip: "192.168.1.1", port: "8080", username: "user1", password: "pass1", path: "/stream1", sensibility: 5 },
  { id: 2, name: "Camera 2", ip: "192.168.1.2", port: "8081", username: "user2", password: "pass2", path: "/stream2", sensibility: 7 },
];

// API functions
export const getAllMagneticReeds = async (): Promise<MagneticReed[]> => {
  return fakeMagneticReeds;
}

export const getAllRtspCameras = async (): Promise<RTSPCamera[]> => {
  return fakeRtspCameras;
}

export const createMagneticReed = async (reed: Omit<MagneticReed, 'id'>): Promise<MagneticReed> => {
  const newReed: MagneticReed = { ...reed, id: Date.now() };
  fakeMagneticReeds.push(newReed);
  return newReed;
}

export const updateMagneticReed = async (id: number, updates: Partial<MagneticReed>): Promise<MagneticReed> => {
  const index = fakeMagneticReeds.findIndex(reed => reed.id === id);
  if (index === -1) throw new Error('Reed not found');
  const updatedReed = { ...fakeMagneticReeds[index], ...updates };
  fakeMagneticReeds[index] = updatedReed;
  return updatedReed;
}

export const deleteMagneticReed = async (id: number): Promise<boolean> => {
  const index = fakeMagneticReeds.findIndex(reed => reed.id === id);
  if (index === -1) throw new Error('Reed not found');
  fakeMagneticReeds.splice(index, 1);
  return true;
}

export const getReedCurrentStatus = async (id: number): Promise<string> => {
  // This is a mock implementation. In a real application, this would fetch the actual status from the device.
  const statuses = ["OPEN", "CLOSED"];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

export const createRTSPCamera = async (camera: Omit<RTSPCamera, 'id'>): Promise<RTSPCamera> => {
  // Simulate an error when creating a camera
  if (Math.random() < 0.5) {
    throw new Error("Failed to create camera. Please try again.");
  }
  const newCamera: RTSPCamera = { ...camera, id: Date.now() };
  fakeRtspCameras.push(newCamera);
  return newCamera;
}

export const updateRTSPCamera = async (id: number, updates: Partial<RTSPCamera>): Promise<RTSPCamera> => {
  const index = fakeRtspCameras.findIndex(camera => camera.id === id);
  if (index === -1) throw new Error('Camera not found');
  const updatedCamera = { ...fakeRtspCameras[index], ...updates };
  fakeRtspCameras[index] = updatedCamera;
  return updatedCamera;
}

export const deleteRTSPCamera = async (id: number): Promise<boolean> => {
  const index = fakeRtspCameras.findIndex(camera => camera.id === id);
  if (index === -1) throw new Error('Camera not found');
  fakeRtspCameras.splice(index, 1);
  return true;
}

let emailConfig: EmailConfig | null = null
let alarmAudioConfig: AlarmAudioConfig | null = null

export const getEmailConfig = async (): Promise<EmailConfig | null> => {
  return emailConfig
}

export const getAlarmAudioConfig = async (): Promise<AlarmAudioConfig | null> => {
  return alarmAudioConfig
}

export const createEmailConfig = async (config: EmailConfig): Promise<EmailConfig> => {
  emailConfig = { ...config }
  return emailConfig
}

export const createAlarmAudioConfig = async (config: AlarmAudioConfig): Promise<AlarmAudioConfig> => {
  alarmAudioConfig = { ...config }
  return  alarmAudioConfig
}

export const updateEmailConfig = async (config: EmailConfig): Promise<EmailConfig> => {
  if (!emailConfig) throw new Error("Email configuration doesn't exist")
  emailConfig = { ...config }
  return emailConfig
}

export const updateAlarmAudioConfig = async (config: AlarmAudioConfig): Promise<AlarmAudioConfig> => {
  if (!alarmAudioConfig) throw new Error("Alarm audio configuration doesn't exist")
  alarmAudioConfig = { ...config }
  return alarmAudioConfig
}

export const deleteEmailConfig = async (): Promise<void> => {
  emailConfig = null
}

export const deleteAlarmAudioConfig = async (): Promise<void> => {
  alarmAudioConfig = null
}

const mockRecordings: Recording[] = [
  { id: 1, filename: "recording1.mp4", camera_ip: "192.168.1.100", is_completed: true },
  { id: 2, filename: "recording2.mp4", camera_ip: "192.168.1.101", is_completed: true },
  { id: 3, filename: "recording3.mp4", camera_ip: "192.168.1.100", is_completed: false },
  { id: 4, filename: "recording4.mp4", camera_ip: "192.168.1.102", is_completed: true },
]

const mockCameras: Camera[] = [
  { id: 1, name: "Front Door", ip: "192.168.1.100" },
  { id: 2, name: "Back Yard", ip: "192.168.1.101" },
  { id: 3, name: "Garage", ip: "192.168.1.102" },
]

export const getAllRecordings = async (): Promise<Recording[]> => {
  return mockRecordings
}

export const getCamera = async (ip: string): Promise<Camera> => {
  const camera = mockCameras.find(cam => cam.ip === ip)
  if (!camera) throw new Error("Camera not found")
  return camera
}

export const deleteRecording = async (id: number): Promise<void> => {
  const index = mockRecordings.findIndex(rec => rec.id === id)
  if (index === -1) throw new Error("Recording not found")
  mockRecordings.splice(index, 1)
}

export const getStorageInfo = async (): Promise<StorageInfo> => {
  return {
    used_space: 500 * 1024 * 1024 * 1024, // 500 GB in bytes
    free_space: 1.5 * 1024 * 1024 * 1024 * 1024, // 1.5 TB in bytes
    total_space: 2 * 1024 * 1024 * 1024 * 1024, // 2 TB in bytes
  }
}

export const getUserPermissions = async (): Promise<Permission[]> => {
  // This is a mock implementation. In a real application, this would fetch the actual permissions from the server.
  return [
    Permission.START_ALARM,
    Permission.STOP_ALARM,
    Permission.ACCESS_RECORDINGS,
    Permission.ACCESS_STREAM_CAMERAS,
    Permission.CHANGE_ALARM_SOUND,
    Permission.CHANGE_MAIL_CONFIG,
    Permission.MODIFY_DEVICES,
    Permission.USER_MANAGER,
  ]
}
