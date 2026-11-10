export type PolarConnectionState =
  "disconnected" | "scanning" | "connecting" | "connected" | "error";

export type PolarDevicePayload = {
  id: string;
  name: string;
  address?: string;
  rssi: number;
  connectable: boolean;
  hasSAGRFCFileSystem?: boolean;
};

export type PolarConnectionStatePayload = {
  connectionState: PolarConnectionState;
  isConnected: boolean;
  id?: string;
  name?: string;
  lastError?: string;
  discoveredDevices: PolarDevicePayload[];
  nativeAvailable: boolean;
  hrReady?: boolean;
  streamingReady?: boolean;
};

export type PolarHeartRateSamplePayload = {
  timestamp: string;
  bpm: number;
  deviceId: string;
  contactDetected: boolean;
  contactSupported: boolean;
  rrAvailable: boolean;
};

export type PolarRRSamplePayload = {
  timestamp: string;
  rrMs: number;
  rrOffsetMs?: number;
  deviceId: string;
};

export type PolarECGSamplePayload = {
  timestamp: string;
  microVolts: number;
  deviceId: string;
  sourceTimestamp: string;
};

export type PolarAccelerometerSamplePayload = {
  timestamp: string;
  x: number;
  y: number;
  z: number;
  deviceId: string;
  sourceTimestamp: string;
};

export type PolarNativeErrorPayload = {
  code: string;
  message: string;
};

export type ApexPolarModuleEvents = {
  phoneSampleReceived: (payload: {
    signal: string;
    value: number;
    timestamp: number;
    quality?: "measured" | "missing" | "suspect";
  }) => void;
  phoneSensorStatus: (payload: { message: string }) => void;
  deviceDiscovered: (payload: PolarDevicePayload) => void;
  connectionStateChanged: (payload: PolarConnectionStatePayload) => void;
  heartRateSampleReceived: (payload: PolarHeartRateSamplePayload) => void;
  rrSampleReceived: (payload: PolarRRSamplePayload) => void;
  ecgSampleReceived: (payload: PolarECGSamplePayload) => void;
  polarAccelerometerSampleReceived: (
    payload: PolarAccelerometerSamplePayload,
  ) => void;
  ecgBatchReceived: (payload: {
    receivedAt: number;
    samples: { microVolts: number; sourceTimestamp: string }[];
  }) => void;
  accelerometerBatchReceived: (payload: {
    receivedAt: number;
    samples: { x: number; y: number; z: number; sourceTimestamp: string }[];
  }) => void;
  nativeError: (payload: PolarNativeErrorPayload) => void;
};

export interface ApexPolarNativeModuleContract {
  startPhoneSensors(): Promise<void>;
  stopPhoneSensors(): Promise<void>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  connectToDevice(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  startHeartRateStream(): Promise<void>;
  stopHeartRateStream(): Promise<void>;
  startRRStream(): Promise<void>;
  stopRRStream(): Promise<void>;
  startECGStream(): Promise<void>;
  stopECGStream(): Promise<void>;
  startPolarAccelerometerStream(): Promise<void>;
  stopPolarAccelerometerStream(): Promise<void>;
  getConnectionState(): Promise<PolarConnectionStatePayload>;
}
