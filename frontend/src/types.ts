export interface ForwardConfig {
  id: string;
  name: string;
  groupId: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  jumpHostId: string;
  status: string;
  connections?: ConnectionInfo[];
}

export interface Group {
  id: string;
  name: string;
}

export interface ConnectionInfo {
  id: string;
  srcAddr: string;
  startTime: number;
}

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  releaseNotes: string;
}

export interface JumpHostConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  authType: string;
  password?: string;
  keyPath?: string;
  timeout?: number;
}

export interface LogEntry {
  timestamp: number;
  message: string;
  level: "info" | "error";
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "error" | "success" | "warning";
  timestamp: number;
  read: boolean;
}
