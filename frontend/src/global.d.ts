export {};

declare global {
  interface Window {
    go: {
      main: {
        App: {
          GetForwards: () => Promise<import('./types').ForwardConfig[]>;
          AddForward: (config: import('./types').ForwardConfig) => Promise<string>;
          StartForward: (id: string) => Promise<void>;
          StopForward: (id: string) => Promise<void>;
          DeleteForward: (id: string) => Promise<void>;
          GetJumpHosts: () => Promise<import('./types').JumpHostConfig[]>;
          AddJumpHost: (config: import('./types').JumpHostConfig) => Promise<string>;
          GetLogs: (id: string) => Promise<import('./types').LogEntry[]>;
        }
      }
    };
    runtime: {
      EventsOn: (eventName: string, callback: (data: any) => void) => void;
    };
  }
}
