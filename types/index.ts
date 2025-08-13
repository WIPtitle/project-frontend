export enum DeviceGroupStatus {
  LISTENING = "LISTENING",
  IDLE = "IDLE",
  ALARM = "ALARM",
  WAITING_TO_START_LISTENING = "WAITING_TO_START_LISTENING",
}

export type DeviceGroup = {
  id: number
  name: string
  wait_to_start_alarm: number
  wait_to_fire_alarm: number
  status: DeviceGroupStatus
}

export enum Permission {
  USER_MANAGER = "USER_MANAGER",
  START_ALARM = "START_ALARM",
  STOP_ALARM = "STOP_ALARM",
  ACCESS_RECORDINGS = "ACCESS_RECORDINGS",
  CHANGE_ALARM_SOUND = "CHANGE_ALARM_SOUND",
  UPDATE_NOTIFICATIONS_CONFIG = "UPDATE_NOTIFICATIONS_CONFIG",
  MODIFY_DEVICES = "MODIFY_DEVICES",
}

export interface User {
  id: number
  email: string
  password?: string
  pin?: string
  permissions: Permission[]
}

export enum SensorStatus {
  HIGH = "HIGH",
  LOW = "LOW",
}

export interface Sensor {
  name: string
  gpio_pin_number: number
  listening: boolean
  group_id: number
}

export interface AlarmAudioConfig {
  audio: File | null
}

export enum RecordingType {
  ALARM = "ALARM",
  NORMAL = "NORMAL",
}

export interface Recording {
  id: number
  name: string
  path: string
  type: RecordingType
  camera_ip: string
  is_completed: boolean
}

export interface StorageInfo {
  used: number
  free: number
  total: number
}

export interface NtfyCredentials {
  user: string
  password: string
  topic: string
}

export interface RTSPCamera {
  name: string
  ip: string
  port: number
  username: string
  password: string
  path: string
  always_recording: boolean
}
