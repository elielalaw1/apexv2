# Mobilverifiering

## Genomfört på iOS-simulator — 6 oktober 2026

Native bygget inklusive Polar-bryggan kompilerade. `MobileUITests.swift` kördes på iPhone 17/iOS 26.5 med Xcode: ett godkänt test, inga fel. Testet skapade ett syntetiskt pass, kontrollerade 120 lokala samples och väntande utkorg, avslutade och återstartade appen, kontrollerade att utkorgen fanns kvar, synkroniserade och verifierade serverkvittens. Utloggning kontrollerades också. Separat API-kontroll hittade två sådana testpass med exakt 60 HR + 60 RR per pass. [Skärmbild](mobile-ios-simulator.png).

Detta verifierar Expo SQLite, SecureStore, återstart och överföring. Det verifierar inte fysisk H10 eller bakgrundsinsamlingsförmåga.

## Återskapa simulatorprovet

Starta webbens API med `APEX_DB_PATH=data/mobile-test.sqlite npm run start` efter `npm run build`. Starta sedan Metro från `apps/mobile` med `npx expo start --dev-client --port 8085 --offline`. Testet använder API-port 3003 och Metro-port 8085. En tidigare inloggad app ska använda samma testdatabas.

Generera först native projektet och installera pods med `npx expo prebuild --platform ios` och `npx pod-install`. Från `apps/mobile`, kör:

```sh
ruby scripts/prepare-ui-tests.rb
xcrun simctl list devices available
xcodebuild -workspace ios/apexVIP.xcworkspace \
  -scheme ApexVIPUITests -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- \
  -derivedDataPath ios/build/DerivedData test
```

Ruby behöver gemet `xcodeproj`. På denna Mac finns det via CocoaPods:

```sh
GEM_HOME=/opt/homebrew/Cellar/cocoapods/1.16.2_2/libexec \
  /opt/homebrew/opt/ruby/bin/ruby scripts/prepare-ui-tests.rb
```

Välj en tillgänglig simulator från listan om namnet skiljer sig. Ad hoc-signering krävs för SecureStore i simulatorn. Pod-pluginen höjer gamla podtargets till iOS 15.1 för det använda Xcode-bygget. På denna Mac saknades Simulator.app-startaren som Expo CLI förväntade sig; direkt `xcodebuild` och `simctl` fungerade.

Efter provet, kör `npm run test:mobile-api` från repots rot medan test-API:t fortfarande kör. Testets `.xcresult` sparas lokalt under den ignorerade `ios`-mappen; native projekt och testtarget kan återskapas med skriptet.

## Kvarstående fysisk verifiering / iOS + Polar H10

Följande är en testplan, inte ett påstående om genomförda hårdvarutester.

1. Installera development build på fysisk iPhone. Anslut H10 och kontrollera Bluetooth-behörighet, sensorkontakt och HR/RR-strömmar.
2. Kör minst 30 minuter. Jämför sampleantal och tidsordning mellan lokal SQLite, API och råexport. Kontrollera minnesutveckling och RR-paketoffset.
3. Lägg till händelser och pre/post-svar från två formulärversioner. Kontrollera exakt koppling till originaldefinition.
4. Bryt Bluetooth, återanslut och verifiera att HR/RR faktiskt återstartar. Lucka och avbrottshändelse ska synas; ingen interpolation.
5. Lås skärmen och lägg appen i bakgrunden. Kontrollera faktisk insamling och lagring, inte endast Bluetooth-background-konfiguration.
6. Tvångsavsluta appen under mätning. Återställ beständiga samples och kontrollera avbrottsnotering. Maximal ej beständig buffert och eventuell förlust ska dokumenteras.
7. Bryt nätverk mitt i uppladdning, inklusive efter servercommit före kvittens. Samma utkorgspaket ska skickas igen och ge exakt ett lagrat råsample per index.
8. Avsluta direkt efter sensorpaket. Sista buffert, slutmetadata och post-svar ska bli beständiga innan paket markeras klara.
9. Simulera skrivfel/full lagring. Bufferten får inte växa obegränsat och felet måste vara synligt. Synkstatus ska skiljas från lokal lagring.
10. Gör en separat Android-matris för behörighet, anslutning, RR-tid, avbrott och bakgrund. Android har ännu ingen fysisk verifiering och återanvänd brygga saknar nya iOS-RR-offseten.

ECG130Hz och H10-acceleration: efterföljande milstolpe med bevarande av rå XYZ, källkoordinater och original-sensortid, chunkning, samtidiga strömmar och högfrekvensprestanda. Telefonrörelse i webbens demo är syntetisk amplitud i g, inte H10-rörelse eller faktisk telefoninsamling.
