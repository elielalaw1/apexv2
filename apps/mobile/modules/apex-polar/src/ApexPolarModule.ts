import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  ApexPolarModuleEvents,
  ApexPolarNativeModuleContract,
} from "./ApexPolar.types";

declare class ApexPolarModule
  extends NativeModule<ApexPolarModuleEvents>
  implements ApexPolarNativeModuleContract
{
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
  getConnectionState(): Promise<
    import("./ApexPolar.types").PolarConnectionStatePayload
  >;
}

export default requireOptionalNativeModule<ApexPolarModule>("ApexPolar");
