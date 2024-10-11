import { User, AlarmGroup, Device } from '@/types'

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
  throw new Error('Failed to activate alarm')
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