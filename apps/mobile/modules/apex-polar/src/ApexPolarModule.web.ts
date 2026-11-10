import { NativeModule, registerWebModule } from "expo";

import type {
  ApexPolarModuleEvents,
  PolarConnectionStatePayload,
} from "./ApexPolar.types";

const unsupportedState: PolarConnectionStatePayload = {
  connectionState: "error",
  isConnected: false,
  lastError: "Polar native integration is unavailable on web.",
  discoveredDevices: [],
  nativeAvailable: false,
};

class ApexPolarModule extends NativeModule<ApexPolarModuleEvents> {
  async startScan(): Promise<void> {
    throw new Error("Polar native integration is unavailable on web.");
  }

  async stopScan(): Promise<void> {}

  async connectToDevice(): Promise<void> {
    throw new Error("Polar native integration is unavailable on web.");
  }

  async disconnect(): Promise<void> {}

  async startHeartRateStream(): Promise<void> {
    throw new Error("Polar native integration is unavailable on web.");
  }

  async stopHeartRateStream(): Promise<void> {}

  async startRRStream(): Promise<void> {
    throw new Error("Polar native integration is unavailable on web.");
  }

  async stopRRStream(): Promise<void> {}

  async startECGStream(): Promise<void> {
    throw new Error("Polar native integration is unavailable on web.");
  }

  async stopECGStream(): Promise<void> {}

  async startPolarAccelerometerStream(): Promise<void> {
    throw new Error("Polar native integration is unavailable on web.");
  }

  async stopPolarAccelerometerStream(): Promise<void> {}

  async getConnectionState(): Promise<PolarConnectionStatePayload> {
    return unsupportedState;
  }
}

export default registerWebModule(ApexPolarModule, "ApexPolar");
