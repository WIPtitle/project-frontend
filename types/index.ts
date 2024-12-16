export enum DeviceGroupStatus {
    LISTENING = "LISTENING",
    IDLE = "IDLE",
    ALARM = "ALARM",
    WAITING_TO_START_LISTENING = "WAITING_TO_START_LISTENING"
}

export type DeviceGroup = {
    id: number;
    name: string;
    wait_to_start_alarm: number;
    wait_to_fire_alarm: number;
    status: DeviceGroupStatus;
};

export enum Permission {
  USER_MANAGER = "USER_MANAGER",
  START_ALARM = "START_ALARM",
  STOP_ALARM = "STOP_ALARM",
  ACCESS_RECORDINGS = "ACCESS_RECORDINGS",
  ACCESS_STREAM_CAMERAS = "ACCESS_STREAM_CAMERAS",
  CHANGE_ALARM_SOUND = "CHANGE_ALARM_SOUND",
  UPDATE_NOTIFICATIONS_CONFIG = "UPDATE_NOTIFICATIONS_CONFIG",
  MODIFY_DEVICES = "MODIFY_DEVICES"
}

export interface User {
  id: number
  email: string
  password?: string
  pin?: string
  permissions: Permission[]
}

export interface MagneticReed {
    name: string;
    gpio_pin_number: number;
    default_value_when_closed: 'HIGH' | 'LOW';
    group_id: number;
}

export interface AlarmAudioConfig {
  audio: File | null
}

export interface Recording {
  id: number
  filename: string
  camera_ip: string
  is_completed: boolean
}

export interface Camera {
  id: number
  name: string
  ip: string
}

export interface StorageInfo {
  used_space: number
  free_space: number
  total_space: number
}

export interface NtfyCredentials {
  user: string;
  password: string;
  topic: string;
}

export interface RTSPCamera {
    name: string;
    ip: string;
    port: number;
    username: string;
    password: string;
    path: string;
    sensibility: number;
    group_id: number;
}

