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
  
  export type User = {
    id: number;
    username: string;
    email: string;
    permissions: string[];
  };