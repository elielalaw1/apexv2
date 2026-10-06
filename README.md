# apexVIP

En ny, separat APEX-kodbas för mätning och analys. Webbens första sammanhängande milstolpe är byggd med ett riktigt API och lokal SQLite. Expo-appen har en HR/RR-kedja, beständig utkorg och återanvänder den tidigare Polar-bryggan.

## Starta webben

Node **22.13 eller senare** krävs för `node:sqlite`.

```sh
cd apexVIP
npm ci
npm run dev
```

Öppna **http://127.0.0.1:3003** och välj **Öppna demoprojekt**. Det förifyllda kontot är `demo@apexvip.local` / `apex-demo-2026`. Ett separat syntetiskt konto `other@apexvip.local` används för arbetsyteisolering.

På denna Mac finns rätt Node i Homebrew. Om terminalen visar Node 20:

```sh
export PATH="/opt/homebrew/bin:$PATH"
```

Demodata lagras genom samma validerade ingest-kedja som mobilmätningar. Databas: `data/apexvip.sqlite`. Originalrepos och tidigare databas berörs inte.

## Webbflöden

- Översikt, deltagare, filtrerade sessioner och sessionsdetaljer med metadata/datakvalitet.
- Analysyta: lägg till, ta bort, flytta med drag eller knappar, ändra bredd/höjd och konfigurera paneler. Upp till fyra sessioner och två signalval per panel i gränssnittet.
- Overlay med märkta enheter, gemensam axel för samma enhet, två separata axlar eller explicit z-normalisering. Länkad markör, zoom/panorering och intervallstatistik från rådata.
- Absolut tid, sessionsrelativ tid och händelserelativ tid. Händelse som saknas ger ett synligt fel.
- Namnge, spara, öppna, ändra och duplicera upplägg. Definitionerna har schema v1.
- Versionerade numeriska självskattningar, händelser och sessionstyper via JSON-editor. Äldre definitioner får inte ersättas.
- Paginerad rådataexport till CSV och export av analyskonfiguration till JSON.

Diagrammets tangentbord: `+` / `−` zoomar och piltangenter panorerar. De synliga tidsknapparna är ett alternativ till drag. Diagrammen interpolerar inte över luckor eller otillräcklig mätkvalitet.

## Mobil

```sh
cd apps/mobile
npm ci
npm run ios
```

En **development build** krävs; Polar-bryggan finns inte i Expo Go. iOS är första målplattform. Ange en HTTPS-server eller Macens LAN-adress på fysisk telefon. Webben binds lokalt som standard; för LAN-utveckling kan den startas med `npx next dev --hostname 0.0.0.0 --port 3003`.

Flöde: logga in → pseudonym deltagare → sessionsupplägg → anslut H10 → föreformulär → HR/RR → händelser → efterformulär → töm buffert → paketutkorg → serverkvittens. Bufferten skrivs var 250 ms eller vid 500 samples och har en hård gräns på 1000. UI visar endast aktuell status. Avslutade sessioner packas transaktionellt i paket om högst 500 samples. Ett fel eller en förlorad kvittens lämnar samma paket väntande för nästa försök; lokala rådata raderas inte.

Återställning efter omstart säkrar redan beständiga samples och markerar avbrottet. Den sista ej skrivna minnesbufferten kan ha gått förlorad. Synk är manuell i denna version och startar efter avslut. API:t kan ta delpaket men en fullständig liveplattform är inte byggd.

Det finns ett syntetiskt mobilpass för att kontrollera lagring och överföring. Simulator/bundlekontroller är inte H10-test. Låst skärm, bakgrund, radiosignalavbrott och Android måste verifieras separat. ECG/H10-rörelsens råa vektorkedja är nästa milstolpe; signalnamnen i kontraktet är förberedelser.

## Kontroller

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run demo:ingest
```

Mobil: `npm run typecheck` och `npm run export:ios` i `apps/mobile`. Ett native XCTest har dessutom verifierat att ett syntetiskt pass överlever appomstart och synkroniseras. Kör `npm run test:mobile-api` från repots rot efter att ett syntetiskt mobilpass synkroniserats till aktuell server.

För webbläsartest mot ett redan byggt produktionsbygge: `APEX_E2E_PRODUCTION=1 APEX_E2E_PORT=3004 npm run test:e2e`. Testet startar sin egen server och använder `data/browser-test.sqlite`.

[Status](docs/STATUS.md) redovisar resultaten och kvarstående arbete. [Mobiltest](docs/MOBILE_VERIFICATION.md) beskriver native testkörning. Skärmbilder finns i `docs/analysis-desktop.png`, `docs/analysis-mobile-web.png` och `docs/mobile-ios-simulator.png`.

Repot finns lokalt på grenen `main`; det har inte publicerats på GitHub.

## Dokumentation och driftgräns

[Krav](docs/REQUIREMENTS.md) · [Arkitektur](docs/ARCHITECTURE.md) · [Plan](docs/PLAN.md) · [Status](docs/STATUS.md) · [API](docs/API.md) · [Mobiltest](docs/MOBILE_VERIFICATION.md)

Detta är en lokalt körbar utvecklingsversion, inte en driftsatt tjänst för deltagardata. Stäng demokonton med `APEX_DEMO_ENABLED=false`. Då behövs separat provisionering av användare. Produktionsautentisering, krypterad lagring, åtkomstroller, begränsning av inloggningsförsök, retention, backup och kapacitetsmätning återstår. Bakom proxy används `APEX_PUBLIC_ORIGIN` för det offentliga HTTPS-ursprunget. Inga hemligheter eller riktiga deltagardata följer med repot.

Polar-modulen kommer från `elielalaw1/apex-mobile`, commit `5e933f8`, och använder Polar BLE SDK 6.16.0. Den nya iOS-bryggan lägger till RR-offset inom ett mottaget paket; mottagningstid och ursprunglig PMD-sensortid hålls åtskilda. Se arkitekturdokumentet för antaganden.
