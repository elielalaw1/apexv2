import ExpoModulesCore
import CoreMotion
import CoreLocation
import Foundation
import UIKit

public final class ApexPolarModule: Module {
  private let manager = PolarBridgeManager()
  private let phone = PhoneSensorManager()

  public func definition() -> ModuleDefinition {
    Name("ApexPolar")

    Events(
      "phoneSampleReceived",
      "phoneSensorStatus",
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
      self.phone.emit = { [weak self] name, payload in self?.sendEvent(name,payload) }
      self.manager.eventHandler = { [weak self] eventName, payload in
        self?.sendEvent(eventName, payload)
      }
    }

    OnDestroy {
      self.phone.stop()
      self.manager.cleanup()
    }

    OnAppContextDestroys {
      self.phone.stop()
      self.manager.cleanup()
    }

    AsyncFunction("startPhoneSensors") { self.phone.start() }.runOnQueue(.main)
    AsyncFunction("stopPhoneSensors") { self.phone.stop() }.runOnQueue(.main)

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

// Phone streams share the recording's wall-clock timeline. No coordinates leave this manager.
private final class PhoneSensorManager: NSObject, CLLocationManagerDelegate {
  var emit: ((String, [String: Any]) -> Void)?
  private let motion = CMMotionManager()
  private let pedometer = CMPedometer()
  private let altimeter = CMAltimeter()
  private let location = CLLocationManager()
  private var active = false
  private var distance: Double = 0
  private var previous: CLLocation?
  private var lastLocation: Date?
  private var idleTimerWasDisabled = false
  override init() { super.init(); location.delegate = self }
  private func status(_ message: String) { emit?("phoneSensorStatus", ["message": message]) }
  private func sample(_ signal: String, _ value: Double, _ date: Date = Date(), _ quality: String = "measured") {
    guard active, value.isFinite else { return }
    emit?("phoneSampleReceived", ["signal": signal,"value": value,"timestamp": date.timeIntervalSince1970*1000,"quality": quality])
  }
  func start() {
    stop(); active=true; distance=0; previous=nil; lastLocation=nil
    idleTimerWasDisabled=UIApplication.shared.isIdleTimerDisabled
    UIApplication.shared.isIdleTimerDisabled=true
    status("Phone sensors starting. Keep the app open and the phone in a fixed position.")
    if motion.isDeviceMotionAvailable {
      motion.deviceMotionUpdateInterval=0.1
      motion.startDeviceMotionUpdates(to: .main) { [weak self] data,error in
        guard let self, self.active else { return }
        if error != nil { self.status("Phone motion unavailable. Check Motion & Fitness permission."); return }
        guard let d=data else{return}
        let date=Date(timeIntervalSince1970:Date().timeIntervalSince1970-ProcessInfo.processInfo.systemUptime+d.timestamp)
        let a=d.userAcceleration, g=d.rotationRate
        for (signal,value) in [("phoneacc",sqrt(a.x*a.x+a.y*a.y+a.z*a.z)),("phoneaccx",a.x),("phoneaccy",a.y),("phoneaccz",a.z),("phonegyrox",g.x),("phonegyroy",g.y),("phonegyroz",g.z)] { self.sample(signal,value,date) }
      }
    } else { status("Phone motion is not supported on this device.") }
    if CMPedometer.isStepCountingAvailable() {
      pedometer.startUpdates(from: Date()) { [weak self] data,error in
        DispatchQueue.main.async {
          guard let self, self.active else{return}
          if error != nil { self.status("Steps and cadence unavailable. Check Motion & Fitness permission.");return }
          guard let d=data else{return}
          self.sample("steps",d.numberOfSteps.doubleValue,d.endDate)
          if let cadence=d.currentCadence {self.sample("cadence",cadence.doubleValue*60,d.endDate)}
        }
      }
    } else {status("Step counting is not supported on this device.")}
    if CMAltimeter.isRelativeAltitudeAvailable() {
      altimeter.startRelativeAltitudeUpdates(to: .main) { [weak self] data,error in
        guard let self,self.active else{return}
        if error != nil {self.status("Elevation unavailable. Check Motion & Fitness permission.");return}
        if let d=data {self.sample("altitude",d.relativeAltitude.doubleValue)}
      }
    } else {status("Barometric elevation is not supported on this device.")}
    location.desiredAccuracy=kCLLocationAccuracyBest
    location.distanceFilter=kCLDistanceFilterNone
    location.activityType = .fitness
    location.pausesLocationUpdatesAutomatically=false
    switch location.authorizationStatus {
    case .notDetermined: location.requestWhenInUseAuthorization()
    case .authorizedWhenInUse,.authorizedAlways: location.startUpdatingLocation()
    default: status("GPS unavailable: enable Location permission for speed, pace and distance.")
    }
  }
  func stop() {
    if active { UIApplication.shared.isIdleTimerDisabled=idleTimerWasDisabled }
    active=false; motion.stopDeviceMotionUpdates();pedometer.stopUpdates();altimeter.stopRelativeAltitudeUpdates();location.stopUpdatingLocation()
  }
  func locationManagerDidChangeAuthorization(_ manager:CLLocationManager) {
    guard active else{return}
    switch manager.authorizationStatus {
    case .authorizedWhenInUse,.authorizedAlways: manager.startUpdatingLocation();status("Phone sensors active. GPS needs an outdoor signal; keep the app open.")
    case .denied,.restricted: status("GPS unavailable: enable Location permission for speed, pace and distance.")
    default:break
    }
  }
  func locationManager(_ manager:CLLocationManager,didUpdateLocations locations:[CLLocation]) {
    guard active else{return}
    for p in locations {
      guard abs(p.timestamp.timeIntervalSinceNow)<5, p.timestamp > (lastLocation ?? .distantPast) else{continue}
      lastLocation=p.timestamp
      guard p.horizontalAccuracy>=0,p.horizontalAccuracy<=30,p.speed>=0,p.speedAccuracy>=0,p.speedAccuracy<=3 else {
        sample("speed",0,p.timestamp,"missing");sample("pace",0,p.timestamp,"missing");sample("distance",distance,p.timestamp,"missing");previous=nil;continue
      }
      let speed=p.speed
      sample("speed",speed*3.6,p.timestamp)
      // A stationary person has no finite pace: do not invent zero min/km.
      sample("pace",speed>=0.5 ? 1000/speed/60 : 0,p.timestamp,speed>=0.5 ? "measured":"missing")
      if let before=previous {
        let dt=p.timestamp.timeIntervalSince(before.timestamp),delta=p.distance(from:before)
        if dt>0,dt<=10,speed>=0.5,delta>=2,delta/dt<=max(5,speed+5) {distance+=delta}
      }
      previous=p
      sample("distance",distance,p.timestamp)
    }
  }
  func locationManager(_ manager:CLLocationManager,didFailWithError error:Error) {
    guard active else{return}
    status("GPS temporarily unavailable. Speed, pace and distance need a usable location signal.")
    previous=nil
    let now=Date();sample("speed",0,now,"missing");sample("pace",0,now,"missing");sample("distance",distance,now,"missing")
  }
}
