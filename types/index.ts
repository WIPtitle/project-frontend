export type Device = {
    id: number;
    name: string;
};

export type AlarmGroup = {
    id: number;
    name: string;
    devices: Device[];
    isActive: boolean;
};

export enum Permission {
  USER_MANAGER = "USER_MANAGER",
  START_ALARM = "START_ALARM",
  STOP_ALARM = "STOP_ALARM",
  ACCESS_RECORDINGS = "ACCESS_RECORDINGS",
  ACCESS_STREAM_CAMERAS = "ACCESS_STREAM_CAMERAS",
  CHANGE_ALARM_SOUND = "CHANGE_ALARM_SOUND",
  CHANGE_MAIL_CONFIG = "CHANGE_MAIL_CONFIG",
  MODIFY_DEVICES = "MODIFY_DEVICES"
}

export interface User {
  id: number
  username: string
  email: string
  permissions: Permission[]
}

export interface RTSPCamera {
    id: number;
    name: string;
    ip: string;
    port: number;
    username: string;
    password: string;
    path: string;
    sensibility: number;
}

export interface MagneticReed {
    id: number;
    name: string;
    gpio_pin_number: number;
    default_value_when_closed: 'HIGH' | 'LOW';
}

export interface EmailConfig {
  smtpServer: string
  port: number
  username: string
  password: string
  sender: string
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