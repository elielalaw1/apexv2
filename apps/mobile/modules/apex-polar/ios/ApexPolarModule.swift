import ExpoModulesCore

public final class ApexPolarModule: Module {
  private let manager = PolarBridgeManager()

  public func definition() -> ModuleDefinition {
    Name("ApexPolar")

    Events(
      "deviceDiscovered",
      "connectionStateChanged",
      "heartRateSampleReceived",
      "rrSampleReceived",
      "ecgSampleReceived",
      "ecgBatchReceived",
      "accelerometerBatchReceived",
      "polarAccelerometerSampleReceived",
      "nativeError"
    )

    OnCreate {
      self.manager.eventHandler = { [weak self] eventName, payload in
        self?.sendEvent(eventName, payload)
      }
    }

    OnDestroy {
      self.manager.cleanup()
    }

    OnAppContextDestroys {
      self.manager.cleanup()
    }

    AsyncFunction("startScan") {
      try self.manager.startScan()
    }
    .runOnQueue(.main)

    AsyncFunction("stopScan") {
      self.manager.stopScan()
    }
    .runOnQueue(.main)

    AsyncFunction("connectToDevice") { (deviceId: String) in
      try self.manager.connectToDevice(deviceId)
    }
    .runOnQueue(.main)

    AsyncFunction("disconnect") {
      try self.manager.disconnect()
    }
    .runOnQueue(.main)

    AsyncFunction("startHeartRateStream") {
      try self.manager.startHeartRateStream()
    }
    .runOnQueue(.main)

    AsyncFunction("stopHeartRateStream") {
      self.manager.stopHeartRateStream()
    }
    .runOnQueue(.main)

    AsyncFunction("startRRStream") {
      try self.manager.startRRStream()
    }
    .runOnQueue(.main)

    AsyncFunction("stopRRStream") {
      self.manager.stopRRStream()
    }
    .runOnQueue(.main)

    AsyncFunction("startECGStream") {
      try self.manager.startEcgStream()
    }
    .runOnQueue(.main)

    AsyncFunction("stopECGStream") {
      self.manager.stopEcgStream()
    }
    .runOnQueue(.main)

    AsyncFunction("startPolarAccelerometerStream") {
      try self.manager.startAccelerometerStream()
    }
    .runOnQueue(.main)

    AsyncFunction("stopPolarAccelerometerStream") {
      self.manager.stopAccelerometerStream()
    }
    .runOnQueue(.main)

    AsyncFunction("getConnectionState") {
      self.manager.connectionStatePayload()
    }
    .runOnQueue(.main)
  }
}
