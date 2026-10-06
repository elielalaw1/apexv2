import ExpoModulesCore
import Foundation
import PolarBleSdk
import RxSwift

final class PolarBridgeManager: NSObject, PolarBleApiObserver, PolarBleApiPowerStateObserver, PolarBleApiDeviceFeaturesObserver, PolarBleApiLogger {
  enum ConnectionState: String {
    case disconnected
    case scanning
    case connecting
    case connected
    case error
  }

  typealias EventHandler = (_ eventName: String, _ payload: [String: Any]) -> Void

  private var api = PolarBleApiDefaultImpl.polarImplementation(
    DispatchQueue.main,
    features: [
      .feature_hr,
      .feature_polar_online_streaming,
      .feature_battery_info,
      .feature_device_info,
    ]
  )

  private static let iso8601Formatter = ISO8601DateFormatter()

  var eventHandler: EventHandler?

  private var state: ConnectionState = .disconnected
  private var currentDevice: PolarDeviceInfo?
  private var lastError: String?
  private var discoveredDevices: [String: PolarDeviceInfo] = [:]
  private var scanDisposable: Disposable?
  private var hrStreamDisposable: Disposable?
  private var ecgStreamDisposable: Disposable?
  private var accelerometerStreamDisposable: Disposable?
  private var hrStreamEnabled = false
  private var rrStreamEnabled = false
  private var ecgStreamEnabled = false
  private var accelerometerStreamEnabled = false
  private var bluetoothReady = false

  override init() {
    super.init()
    api.observer = self
    api.powerStateObserver = self
    api.deviceFeaturesObserver = self
    api.logger = self
    api.automaticReconnection = false
  }

  func cleanup() {
    stopScan()
    stopAllStreams()
    if let deviceId = currentDevice?.deviceId {
      try? api.disconnectFromDevice(deviceId)
    }
    api.cleanup()
  }

  func startScan() throws {
    guard bluetoothReady || api.isBlePowered else {
      state = .error
      lastError = "Bluetooth is not ready yet. Confirm Bluetooth permission for APEX and try again in a moment."
      emitConnectionState()
      throw Exception(
        name: "ApexPolar",
        description: lastError ?? "Bluetooth is not ready yet.",
        code: "ERR_POLAR_BLUETOOTH_UNAVAILABLE"
      )
    }

    stopScan()
    clearError()
    discoveredDevices.removeAll()
    state = .scanning
    emitConnectionState()

    scanDisposable = api.searchForDevice(withRequiredDeviceNamePrefix: "Polar")
      .observe(on: MainScheduler.instance)
      .subscribe(
        onNext: { [weak self] device in
          self?.handleDiscoveredDevice(device)
        },
        onError: { [weak self] error in
          self?.emitNativeError(code: "ERR_POLAR_SCAN_FAILED", message: error.localizedDescription)
          self?.state = self?.currentDevice == nil ? .error : .connected
          self?.emitConnectionState()
        }
      )
  }

  func stopScan() {
    scanDisposable?.dispose()
    scanDisposable = nil

    if state == .scanning {
      state = currentDevice == nil ? .disconnected : .connected
      emitConnectionState()
    }
  }

  func connectToDevice(_ deviceId: String) throws {
    stopScan()
    clearError()
    state = .connecting
    emitConnectionState()
    try api.connectToDevice(deviceId)
  }

  func disconnect() throws {
    stopAllStreams()

    if let deviceId = currentDevice?.deviceId {
      try api.disconnectFromDevice(deviceId)
    }

    currentDevice = nil
    state = .disconnected
    emitConnectionState()
  }

  func startHeartRateStream() throws {
    hrStreamEnabled = true
    try ensureHrStreamRunning()
  }

  func stopHeartRateStream() {
    hrStreamEnabled = false
    stopHrStreamIfIdle()
  }

  func startRRStream() throws {
    rrStreamEnabled = true
    try ensureHrStreamRunning()
  }

  func stopRRStream() {
    rrStreamEnabled = false
    stopHrStreamIfIdle()
  }

  func startEcgStream() throws {
    guard let currentDevice else {
      throw Exception(
        name: "ApexPolar",
        description: "No Polar device connected.",
        code: "ERR_POLAR_NOT_CONNECTED"
      )
    }

    ecgStreamEnabled = true
    clearError()

    if ecgStreamDisposable != nil {
      return
    }

    ecgStreamDisposable = api.requestStreamSettings(currentDevice.deviceId, feature: .ecg)
      .asObservable()
      .flatMap { [weak self] settings -> Observable<PolarEcgData> in
        guard let self else {
          return .empty()
        }

        return self.api.startEcgStreaming(currentDevice.deviceId, settings: settings.maxSettings())
      }
      .observe(on: MainScheduler.instance)
      .subscribe(
        onNext: { [weak self] data in
          self?.handleEcgData(data, deviceId: currentDevice.deviceId)
        },
        onError: { [weak self] error in
          self?.ecgStreamDisposable?.dispose()
          self?.ecgStreamDisposable = nil
          self?.ecgStreamEnabled = false
          self?.state = .error
          self?.emitNativeError(code: "ERR_POLAR_ECG_STREAM", message: error.localizedDescription)
        },
        onCompleted: { [weak self] in
          self?.ecgStreamDisposable = nil
        }
      )
  }

  func stopEcgStream() {
    ecgStreamEnabled = false
    ecgStreamDisposable?.dispose()
    ecgStreamDisposable = nil
  }

  func startAccelerometerStream() throws {
    guard let currentDevice else {
      throw Exception(
        name: "ApexPolar",
        description: "No Polar device connected.",
        code: "ERR_POLAR_NOT_CONNECTED"
      )
    }

    accelerometerStreamEnabled = true
    clearError()

    if accelerometerStreamDisposable != nil {
      return
    }

    accelerometerStreamDisposable = api.requestStreamSettings(currentDevice.deviceId, feature: .acc)
      .asObservable()
      .flatMap { [weak self] settings -> Observable<PolarAccData> in
        guard let self else {
          return .empty()
        }

        return self.api.startAccStreaming(currentDevice.deviceId, settings: settings.maxSettings())
      }
      .observe(on: MainScheduler.instance)
      .subscribe(
        onNext: { [weak self] data in
          self?.handleAccelerometerData(data, deviceId: currentDevice.deviceId)
        },
        onError: { [weak self] error in
          self?.accelerometerStreamDisposable?.dispose()
          self?.accelerometerStreamDisposable = nil
          self?.accelerometerStreamEnabled = false
          self?.state = .error
          self?.emitNativeError(code: "ERR_POLAR_ACCEL_STREAM", message: error.localizedDescription)
        },
        onCompleted: { [weak self] in
          self?.accelerometerStreamDisposable = nil
        }
      )
  }

  func stopAccelerometerStream() {
    accelerometerStreamEnabled = false
    accelerometerStreamDisposable?.dispose()
    accelerometerStreamDisposable = nil
  }

  func connectionStatePayload() -> [String: Any] {
    var payload: [String: Any] = [
      "connectionState": state.rawValue,
      "isConnected": state == .connected,
      "discoveredDevices": discoveredDevices.values
        .sorted(by: { $0.name < $1.name })
        .map(devicePayload(from:)),
      "nativeAvailable": true,
    ]

    if let currentDevice {
      payload["id"] = currentDevice.deviceId
      payload["name"] = currentDevice.name
    }

    if let lastError {
      payload["lastError"] = lastError
    }

    return payload
  }

  func deviceConnecting(_ identifier: PolarDeviceInfo) {
    currentDevice = identifier
    discoveredDevices[identifier.deviceId] = identifier
    state = .connecting
    clearError()
    emitConnectionState()
  }

  func deviceConnected(_ identifier: PolarDeviceInfo) {
    currentDevice = identifier
    discoveredDevices[identifier.deviceId] = identifier
    state = .connected
    clearError()
    emitConnectionState()
  }

  func deviceDisconnected(_ identifier: PolarDeviceInfo, pairingError: Bool) {
    stopAllStreams()
    if currentDevice?.deviceId == identifier.deviceId {
      currentDevice = nil
    }

    if pairingError {
      state = .error
      lastError = "Polar pairing error. Remove the device from iOS Bluetooth settings and pair again."
      emitNativeError(code: "ERR_POLAR_PAIRING", message: lastError ?? "Polar pairing error.")
    } else {
      state = .disconnected
      emitConnectionState()
    }
  }

  func blePowerOn() {
    bluetoothReady = true
    clearError()
    if currentDevice != nil {
      state = .connected
    } else if scanDisposable != nil {
      state = .scanning
    } else {
      state = .disconnected
    }
    emitConnectionState()
  }

  func blePowerOff() {
    bluetoothReady = false
    stopAllStreams()
    state = .error
    lastError = "Bluetooth is unavailable. Check that Bluetooth is enabled and that APEX has Bluetooth permission."
    emitNativeError(code: "ERR_POLAR_BLUETOOTH_OFF", message: lastError ?? "Bluetooth is powered off.")
  }

  func bleSdkFeatureReady(_ identifier: String, feature: PolarBleSdkFeature) {
    if currentDevice?.deviceId == identifier, state != .connected {
      state = .connected
      emitConnectionState()
    }
  }

  func message(_ str: String) {
    NSLog("[ApexPolar] %@", str)
  }

  private func handleDiscoveredDevice(_ device: PolarDeviceInfo) {
    discoveredDevices[device.deviceId] = device
    eventHandler?("deviceDiscovered", devicePayload(from: device))
    emitConnectionState()
  }

  private func ensureHrStreamRunning() throws {
    guard let currentDevice else {
      throw Exception(
        name: "ApexPolar",
        description: "No Polar device connected.",
        code: "ERR_POLAR_NOT_CONNECTED"
      )
    }

    if hrStreamDisposable != nil {
      return
    }

    clearError()

    hrStreamDisposable = api.startHrStreaming(currentDevice.deviceId)
      .observe(on: MainScheduler.instance)
      .subscribe(
        onNext: { [weak self] data in
          self?.handleHrData(data, deviceId: currentDevice.deviceId)
        },
        onError: { [weak self] error in
          self?.stopAllStreams()
          self?.state = .error
          self?.emitNativeError(code: "ERR_POLAR_HR_STREAM", message: error.localizedDescription)
        },
        onCompleted: { [weak self] in
          self?.hrStreamDisposable = nil
        }
      )
  }

  private func stopHrStreamIfIdle() {
    guard !hrStreamEnabled && !rrStreamEnabled else {
      return
    }
    hrStreamDisposable?.dispose()
    hrStreamDisposable = nil
  }

  private func stopAllStreams() {
    hrStreamEnabled = false
    rrStreamEnabled = false
    ecgStreamEnabled = false
    accelerometerStreamEnabled = false
    hrStreamDisposable?.dispose()
    hrStreamDisposable = nil
    ecgStreamDisposable?.dispose()
    ecgStreamDisposable = nil
    accelerometerStreamDisposable?.dispose()
    accelerometerStreamDisposable = nil
  }

  private func handleHrData(_ data: PolarHrData, deviceId: String) {
    for sample in data {
      let timestamp = Self.iso8601Formatter.string(from: Date())

      if hrStreamEnabled {
        eventHandler?(
          "heartRateSampleReceived",
          [
            "timestamp": timestamp,
            "bpm": Int(sample.hr),
            "deviceId": deviceId,
            "contactDetected": sample.contactStatus,
            "contactSupported": sample.contactStatusSupported,
            "rrAvailable": sample.rrAvailable,
          ]
        )
      }

      if rrStreamEnabled && sample.rrAvailable {
        var remainingMs = sample.rrsMs.reduce(0) { $0 + Int($1) }
        for rrMs in sample.rrsMs {
          remainingMs -= Int(rrMs)
          eventHandler?(
            "rrSampleReceived",
            [
              "timestamp": timestamp,
              "rrMs": rrMs,
              "rrOffsetMs": -remainingMs,
              "deviceId": deviceId,
            ]
          )
        }
      }
    }
  }

  private func handleEcgData(_ data: PolarEcgData, deviceId: String) {
    guard ecgStreamEnabled else {
      return
    }

    for sample in data {
      eventHandler?(
        "ecgSampleReceived",
        [
          "timestamp": Self.iso8601Formatter.string(from: Date()),
          "microVolts": Int(sample.voltage),
          "deviceId": deviceId,
          "sourceTimestamp": String(sample.timeStamp),
        ]
      )
    }
  }

  private func handleAccelerometerData(_ data: PolarAccData, deviceId: String) {
    guard accelerometerStreamEnabled else {
      return
    }

    for sample in data {
      eventHandler?(
        "polarAccelerometerSampleReceived",
        [
          "timestamp": Self.iso8601Formatter.string(from: Date()),
          "x": Int(sample.x),
          "y": Int(sample.y),
          "z": Int(sample.z),
          "deviceId": deviceId,
          "sourceTimestamp": String(sample.timeStamp),
        ]
      )
    }
  }

  private func devicePayload(from device: PolarDeviceInfo) -> [String: Any] {
    var payload: [String: Any] = [
      "id": device.deviceId,
      "name": device.name,
      "rssi": device.rssi,
      "connectable": device.connectable,
    ]
    payload["address"] = device.address.uuidString
    payload["hasSAGRFCFileSystem"] = device.hasSAGRFCFileSystem
    return payload
  }

  private func clearError() {
    lastError = nil
  }

  private func emitConnectionState() {
    eventHandler?("connectionStateChanged", connectionStatePayload())
  }

  private func emitNativeError(code: String, message: String) {
    lastError = message
    eventHandler?(
      "nativeError",
      [
        "code": code,
        "message": message,
      ]
    )
    emitConnectionState()
  }
}
