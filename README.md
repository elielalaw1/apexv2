# apexVIP

[Installation, telefonprov och leverans](docs/SHIP.md) · [Installera på iPhone](docs/IPHONE_SETUP.md)

En ny, separat APEX-kodbas för mätning och analys. Webbens första sammanhängande milstolpe är byggd med ett riktigt API och lokal SQLite. Expo-appen har insamling av HR, RR, EKG och H10-acceleration (rå XYZ och magnitud), beständig utkorg och återanvänder den tidigare Polar-bryggan.

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

## Enklare webbflöde — 18 oktober 2026

Startsidan öppnar direkt på **Sessions**. Sök eller filtrera på deltagare, öppna ett pass och växla mellan inspelade signaler. Passet visar ett fast diagram med sessionsmedel och toppvärde, självskattningar, händelser samt rådataexport till CSV. Välj **Zoom in** eller dra över diagrammet för att zooma och välj **Full session** för att återställa. Hela sessionsraden öppnar passet. Sökning och deltagarfilter kan återställas direkt; bakåt återför fokus till det öppnade passet. Smala vyer behåller datum och demo-markering. Signalbeskrivningar, en fast värdeavläsning och synlig zoommarkering hjälper läsningen av diagrammet. Sessionens adress kan bokmärkas; bakåt och omladdning fungerar.

Ingen sidomeny, panelbyggare, jämförelse eller formuläradministration ingår i standardflödet. Den tidigare analysytan finns kvar separat på `/advanced` för befintliga sparade vyer och fortsatt utveckling. Mobilinsamling, API och databas behåller sina kontrakt.

Originalreferens: de lokala kopiorna av [apex-web](https://github.com/elielalaw1/apex-web) och [apex-mobile](https://github.com/elielalaw1/apex-mobile), tillsammans med skärmbilderna från examensarbetet. Grundflödet är sessionslista → inspelning → signaler och självskattningar.

Skärmbilder: [sessionslista](docs/simple-sessions-desktop.png), [passvy](docs/simple-review-desktop.png), [smal sessionslista](docs/simple-sessions-mobile.png) och [smal passvy](docs/simple-review-mobile.png).

## Guidning och valfri anpassning

**Quick tour** ger en frivillig, animerad genomgång av sessionslistan och passvyn. Den pekar ut verkliga kontroller, kan hoppas över och öppnas igen. En kort introduktionsruta visas tills den stängts per arbetsyta/webbläsare. Guiden hanterar tangentbordsfokus och `prefers-reduced-motion`.

I ett pass öppnar **Customize** en redigeringsvy. Välj inspelade signaler, självskattningar och tidslinje; flytta kort med handtaget eller pilknapparna. Släpp en signalgraf i en annan grafs markerade mittzon för att kombinera dem. Släpp på kortets övriga yta för att flytta. **Combine with…** är ett alternativ utan drag. Högst två signaler ingår i en gemensam graf; olika enheter får varsin märkt axel. **Separate graphs** delar upp dem igen. Alla grafer delar tid, zoom och markör.

**Save layout** sparar lokalt per arbetsyta och pass i den aktuella webbläsaren. **Cancel** återställer den tidigare vyn; **Restore default** tar tillbaka den enkla standardvyn. Inställningen synkas ännu inte mellan datorer. Saknade signaler och ogiltiga äldre inställningar faller tillbaka till standardvyn. Själva mätdata ändras inte.

[Guidning](docs/dashboard-tour.png) · [Anpassad vy](docs/customized-dashboard.png) · [Smal anpassad vy](docs/customized-dashboard-mobile.png).

## Tidigare analysyta (`/advanced`)

- Gränssnittet är på engelska. Starta i **Overview** och klicka på en sessionsrad för att öppna analysen.
- Deltagare, filtrerade sessioner och sessionsdetaljer med metadata/datakvalitet.
- En ny analys börjar med ett stort hjärtfrekvensdiagram, eller första tillgängliga signal om HR saknas. **Add signal** visar endast signaler med data; **Compare sessions** öppnar en sökbar väljare för upp till fyra pass.
- **Customize** öppnar avancerad redigering. **View options** samlar öppna, duplicera, döpa om och exportera sparade vyer. **Settings** samlar administration och formulär.
- Analysyta: lägg till, ta bort, flytta med drag eller knappar, ändra bredd/höjd och konfigurera paneler. Upp till fyra sessioner och två signalval per panel i gränssnittet.
- Overlay med märkta enheter, gemensam axel för samma enhet, två separata axlar eller explicit z-normalisering. Länkad markör, zoom/panorering och intervallstatistik från rådata.
- Absolut tid, sessionsrelativ tid och händelserelativ tid. Händelse som saknas ger ett synligt fel.
- Namnge, spara, öppna, ändra och duplicera upplägg. Definitionerna har schema v1.
- Versionerade numeriska självskattningar, händelser och sessionstyper redigeras med vanliga formulärkontroller. JSON finns under **Advanced JSON**. Äldre definitioner får inte ersättas.
- Paginerad rådataexport till CSV och export av analyskonfiguration till JSON.

Diagrammets tangentbord: `+` / `−` zoomar, piltangenter flyttar markören, `Shift` + piltangent panorerar, `Enter` markerar 30 sekunder runt markören och `Escape` tar bort markeringen. **Drag to** väljer separat mellan markering, zoom och panorering. Intervallstatistik visas endast efter markering. Händelser kan öppnas med klick eller tangentbord. Diagrammen interpolerar inte över luckor eller otillräcklig mätkvalitet.

## Mobil

[Steg för fysisk iPhone och Polar H10](docs/IPHONE_SETUP.md). Starta webben med `npm run dev:lan` när telefonen ska ansluta över samma Wi-Fi. Valfri standardadress för appen kan anges i `apps/mobile/.env.local` med `EXPO_PUBLIC_APEX_SERVER_URL`; se `apps/mobile/.env.example`.

```sh
cd apps/mobile
npm ci
npm run ios
```

En **development build** krävs; Polar-bryggan finns inte i Expo Go. iOS är första målplattform. Ange en HTTPS-server eller Macens LAN-adress på fysisk telefon. Webben binds lokalt som standard; för LAN-utveckling kan den startas med `npx next dev --hostname 0.0.0.0 --port 3003`.

Flöde: logga in → pseudonym deltagare → sessionsupplägg → anslut H10 → föreformulär → HR/RR/EKG/XYZ → händelser → efterformulär → töm buffert → paketutkorg → serverkvittens. Bufferten skrivs var 250 ms eller vid 500 samples och har en hård gräns på 1000. UI visar endast aktuell status. Avslutade sessioner packas transaktionellt i paket om högst 500 samples. Ett fel eller en förlorad kvittens lämnar samma paket väntande för nästa försök; lokala rådata raderas inte.

Återställning efter omstart säkrar redan beständiga samples och markerar avbrottet. Den sista ej skrivna minnesbufferten kan ha gått förlorad. Synk är manuell i denna version och startar efter avslut. API:t kan ta delpaket men en fullständig liveplattform är inte byggd.

Det finns ett syntetiskt mobilpass för att kontrollera lagring och överföring. Simulator/bundlekontroller är inte H10-test. Låst skärm, bakgrund, radiosignalavbrott och Android måste verifieras separat. EKG och H10-råaxlar ingår nu i insamling, lagring och synk; långvarig samtidig högfrekvensinsamling måste fortfarande kapacitetstestas.

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

Repot finns på grenen `main` och publiceras privat som [elielalaw1/apexv2](https://github.com/elielalaw1/apexv2). Den lokala mappen och appnamnet är fortsatt `apexVIP`.

## Dokumentation och driftgräns

[Omdesign](docs/REDESIGN.md) · [Krav](docs/REQUIREMENTS.md) · [Arkitektur](docs/ARCHITECTURE.md) · [Plan](docs/PLAN.md) · [Status](docs/STATUS.md) · [API](docs/API.md) · [Mobiltest](docs/MOBILE_VERIFICATION.md)

Detta är en lokalt körbar utvecklingsversion, inte en driftsatt tjänst för deltagardata. Stäng demokonton med `APEX_DEMO_ENABLED=false`. Då behövs separat provisionering av användare. Produktionsautentisering, krypterad lagring, åtkomstroller, begränsning av inloggningsförsök, retention, backup och kapacitetsmätning återstår. Bakom proxy används `APEX_PUBLIC_ORIGIN` för det offentliga HTTPS-ursprunget. Inga hemligheter eller riktiga deltagardata följer med repot.

Polar-modulen kommer från `elielalaw1/apex-mobile`, commit `5e933f8`, och använder Polar BLE SDK 6.16.0. Den nya iOS-bryggan lägger till RR-offset inom ett mottaget paket; mottagningstid och ursprunglig PMD-sensortid hålls åtskilda. Se arkitekturdokumentet för antaganden.
