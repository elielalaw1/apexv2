package expo.modules.apexpolar

import com.polar.androidcommunications.api.ble.model.DisInfo
import com.polar.androidcommunications.api.ble.model.gatt.client.ChargeState
import com.polar.androidcommunications.api.ble.model.gatt.client.PowerSourcesState
import com.polar.androidcommunications.api.ble.model.gatt.client.pmd.PmdMeasurementType
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.PolarBleApiCallbackProvider
import com.polar.sdk.api.PolarBleApiDefaultImpl
import com.polar.sdk.api.model.EcgSample
import com.polar.sdk.api.model.FecgSample
import com.polar.sdk.api.model.PolarAccelerometerData
import com.polar.sdk.api.model.PolarDeviceInfo
import com.polar.sdk.api.model.PolarEcgData
import com.polar.sdk.api.model.PolarHealthThermometerData
import com.polar.sdk.api.model.PolarHrData
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.disposables.Disposable
import java.util.UUID

class ApexPolarModule : Module(), PolarBleApiCallbackProvider {
  private var api: PolarBleApi? = null
  private var bluetoothPowered = false
  private var connectionState = "disconnected"
  private var connectedDeviceId: String? = null
  private var connectedDeviceName: String? = null
  private var lastError: String? = null
  private val discoveredDevices = linkedMapOf<String, PolarDeviceInfo>()
  private var scanDisposable: Disposable? = null
  private var hrStreamDisposable: Disposable? = null
  private var ecgStreamDisposable: Disposable? = null
  private var accStreamDisposable: Disposable? = null
  private var hrStreamEnabled = false
  private var rrStreamEnabled = false

  override fun definition() = ModuleDefinition {
    Name("ApexPolar")

    Events(
      "deviceDiscovered",
      "connectionStateChanged",
      "heartRateSampleReceived",
      "rrSampleReceived",
      "ecgSampleReceived",
      "polarAccelerometerSampleReceived",
      "nativeError"
    )

    OnDestroy {
      cleanupApi()
    }

    AsyncFunction("startScan") {
      val polarApi = requireApi()

      if (!bluetoothPowered) {
        connectionState = "error"
        lastError = "Bluetooth is unavailable. Ensure Bluetooth is enabled and app permissions are granted."
        sendEvent(
          "nativeError",
          mapOf(
            "code" to "ERR_POLAR_BLUETOOTH_UNAVAILABLE",
            "message" to lastError
          )
        )
        sendEvent("connectionStateChanged", connectionStatePayload())
        throw IllegalStateException(lastError)
      }

      scanDisposable?.dispose()
      discoveredDevices.clear()
      connectionState = "scanning"
      lastError = null
      sendEvent("connectionStateChanged", connectionStatePayload())

      scanDisposable = polarApi.searchForDevice("Polar")
        .observeOn(AndroidSchedulers.mainThread())
        .subscribe({ device ->
          discoveredDevices[device.deviceId] = device
          sendEvent("deviceDiscovered", devicePayload(device))
          sendEvent("connectionStateChanged", connectionStatePayload())
        }, { error ->
          emitError("ERR_POLAR_SCAN_FAILED", error.message ?: "Scan failed.")
        })
    }

    AsyncFunction("stopScan") {
      scanDisposable?.dispose()
      scanDisposable = null
      if (connectionState == "scanning") {
        connectionState = if (connectedDeviceId != null) "connected" else "disconnected"
      }
      sendEvent("connectionStateChanged", connectionStatePayload())
    }

    AsyncFunction("connectToDevice") { deviceId: String ->
      val polarApi = requireApi()
      scanDisposable?.dispose()
      scanDisposable = null
      connectionState = "connecting"
      lastError = null
      sendEvent("connectionStateChanged", connectionStatePayload())
      polarApi.connectToDevice(deviceId)
    }

    AsyncFunction("disconnect") {
      stopAllStreams()
      connectedDeviceId?.let { requireApi().disconnectFromDevice(it) }
      connectedDeviceId = null
      connectedDeviceName = null
      connectionState = "disconnected"
      lastError = null
      sendEvent("connectionStateChanged", connectionStatePayload())
    }

    AsyncFunction("startHeartRateStream") {
      hrStreamEnabled = true
      ensureHrStreamRunning()
    }

    AsyncFunction("stopHeartRateStream") {
      hrStreamEnabled = false
      if (!rrStreamEnabled) {
        connectedDeviceId?.let { requireApi().stopHrStreaming(it).subscribe({}, {}) }
        hrStreamDisposable?.dispose()
        hrStreamDisposable = null
      }
    }

    AsyncFunction("startRRStream") {
      rrStreamEnabled = true
      ensureHrStreamRunning()
    }

    AsyncFunction("stopRRStream") {
      rrStreamEnabled = false
      if (!hrStreamEnabled) {
        connectedDeviceId?.let { requireApi().stopHrStreaming(it).subscribe({}, {}) }
        hrStreamDisposable?.dispose()
        hrStreamDisposable = null
      }
    }

    AsyncFunction("startECGStream") {
      startEcgStream()
    }

    AsyncFunction("stopECGStream") {
      connectedDeviceId?.let { requireApi().stopStreaming(it, PmdMeasurementType.ECG) }
      ecgStreamDisposable?.dispose()
      ecgStreamDisposable = null
    }

    AsyncFunction("startPolarAccelerometerStream") {
      startAccelerometerStream()
    }

    AsyncFunction("stopPolarAccelerometerStream") {
      connectedDeviceId?.let { requireApi().stopStreaming(it, PmdMeasurementType.ACC) }
      accStreamDisposable?.dispose()
      accStreamDisposable = null
    }

    AsyncFunction("getConnectionState") {
      connectionStatePayload()
    }
  }

  override fun blePowerStateChanged(powered: Boolean) {
    bluetoothPowered = powered
    if (!powered) {
      stopAllStreams()
      connectionState = "error"
      lastError = "Bluetooth is unavailable. Ensure Bluetooth is enabled and app permissions are granted."
      sendEvent(
        "nativeError",
        mapOf(
          "code" to "ERR_POLAR_BLUETOOTH_UNAVAILABLE",
          "message" to lastError
        )
      )
    } else if (connectedDeviceId != null) {
      connectionState = "connected"
      lastError = null
    } else if (scanDisposable != null) {
      connectionState = "scanning"
      lastError = null
    } else {
      connectionState = "disconnected"
      lastError = null
    }

    sendEvent("connectionStateChanged", connectionStatePayload())
  }

  override fun deviceConnected(polarDeviceInfo: PolarDeviceInfo) {
    connectedDeviceId = polarDeviceInfo.deviceId
    connectedDeviceName = polarDeviceInfo.name
    discoveredDevices[polarDeviceInfo.deviceId] = polarDeviceInfo
    connectionState = "connected"
    lastError = null
    sendEvent("connectionStateChanged", connectionStatePayload())
  }

  override fun deviceConnecting(polarDeviceInfo: PolarDeviceInfo) {
    discoveredDevices[polarDeviceInfo.deviceId] = polarDeviceInfo
    connectionState = "connecting"
    connectedDeviceId = polarDeviceInfo.deviceId
    connectedDeviceName = polarDeviceInfo.name
    sendEvent("connectionStateChanged", connectionStatePayload())
  }

  override fun deviceDisconnected(polarDeviceInfo: PolarDeviceInfo) {
    stopAllStreams()
    if (connectedDeviceId == polarDeviceInfo.deviceId) {
      connectedDeviceId = null
      connectedDeviceName = null
    }
    connectionState = "disconnected"
    sendEvent("connectionStateChanged", connectionStatePayload())
  }

  override fun bleSdkFeatureReady(identifier: String, feature: PolarBleApi.PolarBleSdkFeature) {
    if (identifier == connectedDeviceId && connectionState != "connected") {
      connectionState = "connected"
      sendEvent("connectionStateChanged", connectionStatePayload())
    }
  }

  override fun bleSdkFeaturesReadiness(
    identifier: String,
    ready: List<PolarBleApi.PolarBleSdkFeature>,
    unavailable: List<PolarBleApi.PolarBleSdkFeature>
  ) {
    if (identifier == connectedDeviceId && ready.isNotEmpty()) {
      connectionState = "connected"
      sendEvent("connectionStateChanged", connectionStatePayload())
    }
  }

  override fun disInformationReceived(identifier: String, uuid: UUID, value: String) = Unit

  override fun disInformationReceived(identifier: String, disInfo: DisInfo) = Unit

  override fun batteryLevelReceived(identifier: String, level: Int) = Unit

  override fun batteryChargingStatusReceived(identifier: String, chargingStatus: ChargeState) = Unit

  override fun powerSourcesStateReceived(identifier: String, powerSourcesState: PowerSourcesState) = Unit

  override fun hrNotificationReceived(identifier: String, data: PolarHrData.PolarHrSample) = Unit

  override fun htsNotificationReceived(identifier: String, data: PolarHealthThermometerData) = Unit

  private fun requireApi(): PolarBleApi {
    api?.let { return it }

    val context = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("ApexPolar requires a React application context.")

    val polarApi = PolarBleApiDefaultImpl.defaultImplementation(
      context,
      setOf(
        PolarBleApi.PolarBleSdkFeature.FEATURE_HR,
        PolarBleApi.PolarBleSdkFeature.FEATURE_DEVICE_INFO,
        PolarBleApi.PolarBleSdkFeature.FEATURE_BATTERY_INFO,
        PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_ONLINE_STREAMING
      )
    )
    polarApi.setApiCallback(this)
    api = polarApi
    return polarApi
  }

  private fun ensureHrStreamRunning() {
    val deviceId = connectedDeviceId ?: throw IllegalStateException("No Polar device connected.")
    if (hrStreamDisposable != null) {
      return
    }

    hrStreamDisposable = requireApi().startHrStreaming(deviceId)
      .observeOn(AndroidSchedulers.mainThread())
      .subscribe({ data ->
        handleHrData(deviceId, data)
      }, { error ->
        stopAllStreams()
        emitError("ERR_POLAR_HR_STREAM", error.message ?: "Heart rate stream failed.")
      })
  }

  private fun startEcgStream() {
    val deviceId = connectedDeviceId ?: throw IllegalStateException("No Polar device connected.")
    if (ecgStreamDisposable != null) {
      return
    }

    ecgStreamDisposable = requireApi()
      .requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.ECG)
      .flatMapPublisher { settings ->
        requireApi().startEcgStreaming(deviceId, settings.maxSettings())
      }
      .observeOn(AndroidSchedulers.mainThread())
      .subscribe({ data ->
        handleEcgData(deviceId, data)
      }, { error ->
        ecgStreamDisposable?.dispose()
        ecgStreamDisposable = null
        emitError("ERR_POLAR_ECG_STREAM", error.message ?: "ECG stream failed.")
      })
  }

  private fun startAccelerometerStream() {
    val deviceId = connectedDeviceId ?: throw IllegalStateException("No Polar device connected.")
    if (accStreamDisposable != null) {
      return
    }

    accStreamDisposable = requireApi()
      .requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.ACC)
      .flatMapPublisher { settings ->
        requireApi().startAccStreaming(deviceId, settings.maxSettings())
      }
      .observeOn(AndroidSchedulers.mainThread())
      .subscribe({ data ->
        handleAccelerometerData(deviceId, data)
      }, { error ->
        accStreamDisposable?.dispose()
        accStreamDisposable = null
        emitError("ERR_POLAR_ACCEL_STREAM", error.message ?: "Polar accelerometer stream failed.")
      })
  }

  private fun handleHrData(deviceId: String, data: PolarHrData) {
    data.samples.forEach { sample ->
      val timestamp = java.time.Instant.now().toString()

      if (hrStreamEnabled) {
        sendEvent(
          "heartRateSampleReceived",
          mapOf(
            "timestamp" to timestamp,
            "bpm" to sample.hr,
            "deviceId" to deviceId,
            "contactDetected" to sample.contactStatus,
            "contactSupported" to sample.contactStatusSupported,
            "rrAvailable" to sample.rrAvailable
          )
        )
      }

      if (rrStreamEnabled && sample.rrAvailable) {
        sample.rrsMs.forEach { rrMs ->
          sendEvent(
            "rrSampleReceived",
            mapOf(
              "timestamp" to timestamp,
              "rrMs" to rrMs,
              "deviceId" to deviceId
            )
          )
        }
      }
    }
  }

  private fun handleEcgData(deviceId: String, data: PolarEcgData) {
    data.samples.forEach { sample ->
      val microVolts = when (sample) {
        is EcgSample -> sample.voltage
        is FecgSample -> sample.ecg
      }

      sendEvent(
        "ecgSampleReceived",
        mapOf(
          "timestamp" to java.time.Instant.now().toString(),
          "microVolts" to microVolts,
          "deviceId" to deviceId,
          "sourceTimestamp" to sample.timeStamp.toString()
        )
      )
    }
  }

  private fun handleAccelerometerData(deviceId: String, data: PolarAccelerometerData) {
    data.samples.forEach { sample ->
      sendEvent(
        "polarAccelerometerSampleReceived",
        mapOf(
          "timestamp" to java.time.Instant.now().toString(),
          "x" to sample.x,
          "y" to sample.y,
          "z" to sample.z,
          "deviceId" to deviceId,
          "sourceTimestamp" to sample.timeStamp.toString()
        )
      )
    }
  }

  private fun stopAllStreams() {
    hrStreamEnabled = false
    rrStreamEnabled = false
    connectedDeviceId?.let {
      requireApi().stopHrStreaming(it).subscribe({}, {})
      requireApi().stopStreaming(it, PmdMeasurementType.ECG)
      requireApi().stopStreaming(it, PmdMeasurementType.ACC)
    }
    hrStreamDisposable?.dispose()
    hrStreamDisposable = null
    ecgStreamDisposable?.dispose()
    ecgStreamDisposable = null
    accStreamDisposable?.dispose()
    accStreamDisposable = null
  }

  private fun cleanupApi() {
    stopAllStreams()
    scanDisposable?.dispose()
    scanDisposable = null
    api?.cleanup()
    api?.shutDown()
    api = null
  }

  private fun emitError(code: String, message: String) {
    connectionState = "error"
    lastError = message
    sendEvent(
      "nativeError",
      mapOf(
        "code" to code,
        "message" to message
      )
    )
    sendEvent("connectionStateChanged", connectionStatePayload())
  }

  private fun devicePayload(device: PolarDeviceInfo): Map<String, Any?> {
    return mapOf(
      "id" to device.deviceId,
      "name" to device.name,
      "address" to device.address,
      "rssi" to device.rssi,
      "connectable" to device.isConnectable,
      "hasSAGRFCFileSystem" to device.hasSAGRFCFileSystem
    )
  }

  private fun connectionStatePayload(): Map<String, Any?> {
    return mapOf(
      "connectionState" to connectionState,
      "isConnected" to (connectionState == "connected"),
      "id" to connectedDeviceId,
      "name" to connectedDeviceName,
      "lastError" to lastError,
      "discoveredDevices" to discoveredDevices.values.map { devicePayload(it) },
      "nativeAvailable" to true
    )
  }
}
