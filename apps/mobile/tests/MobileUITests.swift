import XCTest

final class MobileUITests: XCTestCase {
  func testSyntheticSessionPersistsAndSyncs() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "se.apex.vip")
    app.launchArguments = ["--initialUrl", "http://127.0.0.1:8085?disableOnboarding=1"]
    app.launch()
    if app.alerts.buttons["Open"].waitForExistence(timeout: 2) {app.alerts.buttons["Open"].tap()}
    if app.buttons["Continue"].waitForExistence(timeout: 8) { app.buttons["Continue"].tap() }
    let login = app.buttons["Logga in"]
    let demo = app.buttons["Skapa syntetiskt testpass"]
    if !demo.waitForExistence(timeout: 5) { XCTAssertTrue(login.waitForExistence(timeout: 45)); login.tap() }
    XCTAssertTrue(demo.waitForExistence(timeout: 30))
    for _ in 0..<8 { if demo.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(demo.isHittable)
    demo.tap()
    let pending = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "120 samples · 1 paket väntar")).firstMatch
    XCTAssertTrue(pending.waitForExistence(timeout: 15))
    // Relaunch verifies SQLite persistence independently of React memory.
    app.terminate()
    app.launch()
    XCTAssertTrue(pending.waitForExistence(timeout: 30))
    let sync = app.buttons["Synkronisera väntande paket"]
    for _ in 0..<8 { if sync.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(sync.isHittable)
    sync.tap()
    let acknowledged = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "120 samples · Serverkvitterad")).firstMatch
    XCTAssertTrue(acknowledged.waitForExistence(timeout: 30))
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = "apexVIP synthetic native sync"
    attachment.lifetime = .keepAlways
    add(attachment)
    let logout=app.buttons["Logga ut"]
    for _ in 0..<4 { if logout.isHittable {break};app.swipeUp() }
    XCTAssertTrue(logout.isHittable)
    logout.tap()
    XCTAssertTrue(login.waitForExistence(timeout:15))
  }
}
