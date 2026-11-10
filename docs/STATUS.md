# Training streams and contextual graph help — 10 November 2026

Implemented iOS phone acquisition using Core Motion/Core Location: user acceleration magnitude and XYZ (g, gravity removed), rotation XYZ (rad/s), GPS speed (km/h), pace (min/km), estimated cumulative GPS distance (m), steps, cadence (steps/min) and relative barometric elevation (m). Location coordinates stay on the phone. Location/Motion usage descriptions are in app config and the native build. Permissions/unsupported sensors produce status messages; unavailable pace/GPS intervals are not fabricated. Motion runs at 10 Hz; phone auto-lock is disabled only while these streams are active and restored on stop. Foreground collection is the supported MVP path.

Mobile supports optional known maximum heart rate and Work/Rest markers. The shared API computes zones (0 below 50%; zones 1–5 at 50/60/70/80/90% of entered max), time in zones with valid coverage, 30-beat rolling RMSSD and recovery relative to each Rest marker. RMSSD windows with gaps, uncertain beats, RR outside 250–2000 ms or adjacent changes above 20% are omitted. This is an explicit exploratory method, not a validated readiness/stress classifier. Recovery summaries require readings within 2 seconds of 60/120-second targets and stop at the next phase. Computed metrics are not stored as raw sensor samples; raw CSV exports remain raw. Existing recordings gain derived graphs only when sufficient source data/configuration exists; no historic phone streams are invented.

Graphs support up to eight overlaid signals. Same-unit graphs share an axis, two units have separate labelled axes, and more than two units use explicitly labelled visible-window z-score normalization with original units in hover readouts. Every graph has an accessible info disclosure; combined help lists each source and adapts to relationships such as HR vs pace, inverse speed/pace, terrain context, derived HRV/RR and phone vs chest movement. Pace is formatted m:ss; small motion values retain precision. Cumulative values show totals/latest values rather than averages.

Verified: 19 unit/integrity tests, five browser tests, web production build, mobile TypeScript and signed native iOS Release build. Synthetic phone streams passed ingestion, derived-series inventory, exact recovery/zone values, 3-signal normalized overlay, live help updates, reload and narrow-layout checks. Desktop info-card screenshot visually reviewed. The updated Release build is installed on the connected iPhone as APEX MVP, and devicectl confirmed launch. Phone preview state is cleared between recordings so a new session does not inherit the previous phone readout. Real outdoor GPS, Motion permission denial, pedometer/barometer accuracy and a complete physical phone-to-web workout still require an on-device exercise trial.

References: Apple Core Motion https://developer.apple.com/documentation/coremotion and Core Location https://developer.apple.com/documentation/corelocation; Polar H10 SDK capabilities https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/products/PolarH10.md; Polar resting HRV context https://support.polar.com/en/recovery-pro.

---

# Physical iPhone installation — 10 November 2026

The current MVP was built successfully in Release configuration with the Polar native module and an embedded Hermes bundle. Installed on the connected iPhone 17 running iOS 26.6.2 as **APEX MVP**, bundle ID `se.apex.vip.mvp`, using the owner's Apple development team. The older `se.apex.vip` app was signed by a different team and iOS rejected an in-place upgrade, so it was preserved alongside the new app. Its local recordings were not deleted or migrated.

The new build embeds `http://192.168.1.14:3003`, verified reachable on the Mac's LAN interface. Signature verification passed and the provisioning profile includes the connected phone. The user confirmed the app opened and a session was started after installation. This confirms launch from the user’s observation; completed H10 collection and web upload have not yet been verified.

---

# Visual refinement — 10 November 2026

The MVP web interface now uses a neutral palette, system typography, a compact session list, larger signal summaries and quieter chart controls. Repeated instructions and single-signal legends are removed. Built-in legacy labels are displayed in English, including composed session titles. Mobile layout, keyboard controls, drag overlays, shared cursor, zoom and local preferences are preserved. Cursor readouts reserve space to avoid shifting the charts. Axis labels retain enough precision to distinguish near-constant values.

Verified: production build and TypeScript; four browser tests across the MVP and legacy analysis views, followed by both MVP tests after final visual adjustments. Desktop, narrow viewport, comparison and customization screenshots reviewed.

---

# MVP — 10 november 2026

Webb: ingen inloggning, sessioner grupperade på sessionsnamn, deltagarval och en dashboard med alla inspelade signaler. Drag, omordning, parvis överlagring, signalval, delad zoom/markör, sparad lokal layout och rådataexport. Introduktioner, konto, administration och formulär är borttagna från standardflödet.

Mobil: anslut bandet, ange namn/session, starta, avsluta och skicka. Namn accepterar Unicode och mellanslag; separat stabilt ID. Offlineinspelningar och misslyckade överföringar behålls för nytt försök. Ingen inloggning eller självskattning behövs. Samma ingest-validering och kvitterade utkorg används.

Verifierat: webb- och mobiltypkontroll, webbens produktionsbygge, iOS/Hermes-export, 13 enhets-/integritetstester och hela webbläsarsviten med 4 tester. MVP-proven täcker inloggningsfri syntetisk fullsignalöverföring, sessionsgruppering, deltagarval, verkligt pointer-drag, separata enheter, delning av grafer, sparande/omladdning, signalval, avbryt/återställ, zoom, CSV utan saknade/dubblerade samples, smal vy samt saknad inspelning och pass utan samples. Äldre analysytans två tester passerar också. Webbläsarproven använder en separat databas per körning och separat MVP-arbetsyta. Fysisk iPhone-installation och Polar H10-inspelning har inte testats. Tidigare signeringsbegränsning behöver fortfarande lösas för telefoninstallation. Bygge och iOS-export ersätter inte ett hårdvaruprov.

---

Tidigare status (historik):

# HR/RR/EKG/H10 XYZ — 28 oktober 2026

Appen har nu livevärden för puls, RR, EKG, rå X/Y/Z och härledd accelerationsmagnitud, med begränsade förhandskurvor för EKG och magnitud. Alla sju signalerna sparas lokalt under en inspelning och synkas med samma kvitterade utkorg som tidigare. Lokala pass visar antal per signal. **View session on web** öppnar det synkade passet; webben visar samtliga signaler och rå-CSV.

Native EKG/XYZ går i paket; nanosekundstider bevaras och differenser beräknas före omvandling till ms. SQLite skriver samples i fler-radsstatement. Buffertgräns och synligt stopp vid skrivproblem finns kvar. UI-förhandsvisning och råinsamling har separata uppdateringstakter.

Verifierat: mobil- och webbtypkontroll, 13 Node-tester, webbproduktionsbygge och 8 Playwright-tester mot produktionsbygget. Native iOS Release är byggt, installerat och startat på fysisk iPhone 17 med godkänt LikeLab-team. Användaren rapporterade att alla riktiga H10-signaler får värden i förhandsvisningen. Ett komplett fysiskt inspelnings-/synkprov samt långtid, avbrott och bakgrund återstår. Inga riktiga mätdata läggs i Git.

# Leveransförberedelse — 28 oktober 2026

## Uppdatering: fysisk installation genomförd

Efter användarens uttryckliga godkännande användes LikeLab-teamet för lokal utvecklingssignering. Ett Release-bygge inklusive Polar-bryggan passerade med Xcode. `devicectl` bekräftade installation av `se.apex.vip` på den fysiska iPhone 17 och lyckad start av appen. JavaScript är inbäddat; Metro behövs inte. Serveradress för detta lokala test är Macens LAN-adress, via ignorerad lokal miljökonfiguration. Inga signeringsuppgifter eller profiler har lagts i Git.

Den första GitHub Actions-körningen är också godkänd: webbtypkontroll, 10 tester, produktionsbygge, 7 webbläsartester, mobiltypkontroll och iOS-export. Installation och processstart bevisar ännu inte inloggning, synk eller fysisk H10-insamling; dessa telefonprov återstår. Personal Team-felet nedan är historiken före bytet av signeringsteam.

Privat GitHub-repo: `elielalaw1/apexv2`. Installations- och testinstruktioner finns i [SHIP.md](SHIP.md). GitHub Actions har lagts till för webbtypkontroll, tester, produktionsbygge, Playwright, mobiltypkontroll och iOS-export. CI-resultat kontrolleras separat efter push.

Lokalt verifierat idag: webbtypkontroll, 10 enhets-/integritetstester, produktionsbygge och 7 Playwright-tester mot produktionsbygget är godkända. Mobilens typkontroll och iOS/Hermes-export är godkända. Webbservern svarade över Macens LAN-adress.

En fysisk iPhone 17 med iOS 26.6.2 är tillgänglig och Developer Mode är aktiverat. Installation är **inte genomförd**: Apple nekar provisionering med användarens Personal Team eftersom teamet nått maxantalet registrerade iPhones. Inget annat utvecklingsteam används. Expo CLI misslyckades dessutom med lokal Simulator-appidentifiering; direkt Xcode-bygge nådde Apples provisionering men stoppades där. Ingen fysisk HR/RR- eller H10-verifiering har gjorts. Åtgärda enhetsregistrering/provisionering i det egna Apple-teamet innan native-installationen kan fortsätta.

# Förenklat webbflöde — 18 oktober 2026

Standardflödet är nu sessionslista → passvy, baserat på originalets lokala apex-web-kod och examensarbetets skärmbilder. En fast passvy med signalflikar, zoom, sessionsmedel/topp, självskattningar, händelser och paginerad CSV-export ersätter analysbyggaren på startsidan. Den tidigare analysytan finns separat på `/advanced`; sparade vyer, API, insamling och rådata behålls.

Verifierat i denna ändring: TypeScript, produktionsbygge (i separat temporär byggmapp), 8 integritets-/synktester och 4 Playwright-tester. De två nya webbläsartesterna kontrollerar sökning, filter, signalbyte, tangentbordsnavigation, zoom, CSV över flera API-sidor utan tappade eller dubblerade samples, omladdning, bakåt, smal layout, tom arbetsyta, saknad session och utloggning. De två tidigare testerna kontrollerar analysytan på `/advanced`.

Skärmbilder: [lista](simple-sessions-desktop.png), [pass](simple-review-desktop.png), [smal lista](simple-sessions-mobile.png), [smalt pass](simple-review-mobile.png). Mobilappen har inte ändrats i denna förenkling; tidigare hårdvarubegränsningar gäller fortsatt.

## UX-förbättringar — 18 oktober 2026

Sessionsraderna har nu en sammanhängande länkyta, tydligare text och större kontroller. Aktiva filter kan återställas direkt med fokus tillbaka till sökfältet. Bakåt återför fokus och scrollposition till sessionslistan. Smala vyer behåller både datum och demo-markering.

Passvyn förklarar signalernas enheter, visar aktuellt tidsfönster och har synliga zoom-/återställningsknappar. Drag visar en förhandsmarkering. Värdeavläsning har reserverad plats och vertikal touchscroll tillåts över diagrammet. Zoomgränser hålls inom passets inspelade tid. Ingen ny analysfunktion har lagts till.

Verifierat: TypeScript och de två utökade UX-webbläsartesterna passerar (desktop/smal vy, klickyta, filterfokus, tangentbord, återgång, stabil diagramhöjd, zoomknapp, dragmarkering och CSV). De två regressionstesterna för tidigare analysyta passerade också under denna ändring. Skärmbilderna ovan är uppdaterade. Inget användartest har genomförts. Testservern använder nu separat Next-byggmapp så att den öppna utvecklingsvyn inte påverkas.

## Förberett för fysisk iPhone — 18 oktober 2026

Telefonen ansluts vid ett senare tillfälle. Xcode-listningen visade bara simulatorer, så inget fysiskt bygge har installerats och inget H10-pass har spelats in. Mobilens typkontroll och iOS/Hermes-export passerade.

Förberedelser: `npm run dev:lan` för API-åtkomst på lokalt nätverk; valfri `EXPO_PUBLIC_APEX_SERVER_URL` i mobilens lokala miljöfil; normaliserad och validerad serveradress samt tydligare fel vid nätverksfel/timeout. [iPhone-guiden](IPHONE_SETUP.md) beskriver installation, signering och det första riktiga HR/RR-passet. LAN-servern har inte startats i denna förberedelse; den öppna webben kör fortsatt lokalt.

## Guidning och grafanpassning — 18 oktober 2026

Valfri animerad introduktion med markering av verkliga kontroller, återöppning, fokusåterställning, Escape och stöd för reducerad rörelse. Ingen påtvingad modal vid inloggning. Customize låter användaren välja och ordna informationskort med drag eller pilknappar, kombinera högst två signalgrafer med separata enheter/axlar och dela upp dem igen. Tid, zoom och markör delas mellan grafer.

Inställningar valideras och sparas lokalt per arbetsyta/pass/webbläsare. Cancel och Restore default finns. Ingen synk av dessa nya kortinställningar mellan enheter är byggd. Standardvyn är fortsatt enkel. Rådata, API och mobilinsamling har inte ändrats i detta steg.

Verifierat: TypeScript, separat produktionsbygge, 10 enhets-/integritetstester och 7 webbläsartester. De tre nya webbläsartesterna täcker guidning/återöppning, verkligt pointer-drag för grafkombination, kortval/ordning, separat axelvisning, delad markör, sparande/omladdning, uppdelning, avbryt/återställ, smal vy, tangentbordsalternativ och reducerad rörelse. Skärmbilder: [guidning](dashboard-tour.png), [anpassad vy](customized-dashboard.png), [smal vy](customized-dashboard-mobile.png). Ingen fysisk touch-enhet har testats.

---

# Verifierad status — 6 oktober 2026

Första sammanhängande milstolpen är genomförd i ett nytt lokalt Git-repo, `apexVIP`, på grenen `main`. Repot är inte publicerat på GitHub. Originalrepos är bevarade: apex-web `7459997`, apex-mobile `5e933f8`.

## Omdesign och engelskt gränssnitt

Den nya sessionsbaserade designen är implementerad enligt DESIGN_BRIEF.txt med engelska systemtexter för webb och mobil. En ny analys börjar med ett diagram; Add signal och Compare sessions öppnar uppgiftsbaserade väljare. Tekniska detaljer, formulär-JSON och avancerad anpassning öppnas vid behov. Tidigare sparade vyer och historiska formulär behåller sin struktur och betydelse.

8 integritetstester, 2 uppdaterade tester mot produktionsbygget och mobilens engelska XCTest passerade. Simulatorprovet verifierade återstart och synk; separat API-kontroll hittade 3 syntetiska mobilpass med exakt 60 HR + 60 RR per pass i testdatabasen. Den vanliga webbdatabasen har kvar 4 pass, 3 deltagare och 72 minuter.

Se [omdesign och begränsningar](REDESIGN.md), [standardanalys](analysis-default.png), [desktop](dashboard-desktop.png) och [mobilöversikt](dashboard-mobile-web.png). Formulärstödet omfattar numeriska skalor; kategoriska svarsalternativ återstår som utökning av datakontraktet.

## Implementerat och kontrollerat

- Validerat API → SQLite → sessionslista → analys, med 12 696 syntetiska samples genom den riktiga ingest-kedjan.
- Idempotent ingest och skydd mot ändring av redan lagrade råsamples. Omordnade paket bevarar slutmetadata och händelser.
- Flera synkroniserade paneler, sessionsoverlay, märkta enheter, separata axlar och explicit normalisering. Gemensam zoom och markör kontrollerades i webbläsaren.
- Händelser och dataluckor visas. Luckor interpoleras inte; statistik beräknas från rådata.
- Sparade, duplicerade och återöppnade analysupplägg, även efter omladdning. Sessionsdata och upplägg isoleras per arbetsyta.
- Versionerade sessionsdefinitioner och numeriska självskattningar; äldre definitioner är oföränderliga.
- Mobilens SQLite-lagring, begränsade skrivbuffert, beständiga paketutkorg, återställning och manuell synk.

## Körda kontroller

| Kontroll | Resultat |
| --- | --- |
| API/lagring/analys/synkkvittens | 8 automatiska tester godkända |
| Playwright mot produktionsbygget | 2 tester godkända; desktop och smal webbvy |
| Webbens TypeScript och Next-produktionsbygge | Godkända |
| Mobilens TypeScript och iOS/Hermes-export | Godkända |
| Native iOS-bygge inklusive Polar-brygga | Godkänt med Xcode |
| XCTest på iPhone 17-simulator | 1 test godkänt: skapa syntetiskt pass, avsluta appen, återstarta, synkronisera och logga ut |
| Separat API-kontroll efter mobiltestet | 3 syntetiska mobilpass, exakt 60 HR + 60 RR per pass |
| Webbens npm audit | 0 rapporterade sårbarheter vid kontrollen |
| Mobilens npm audit | 32 rapporterade beroendesårbarheter: 10 moderate, 22 high; kvarstående arbete |

Skärmbilder från körningarna: [desktop](analysis-desktop.png), [mobil webb](analysis-mobile-web.png), [native iOS-simulator](mobile-ios-simulator.png). Gränssnittet har granskats visuellt. Testdatabaser ligger separat från appens standarddatabas och ingår inte i Git.

## Kvarstår

Fysisk Polar H10-insamling är **inte verifierad**. Simulatorns syntetiska pass bevisar lagring, omstart och API-överföring, men inte sensorkontakt, Bluetooth, RR-tid på fysisk enhet eller insamling med låst skärm. Se [mobiltestplanen](MOBILE_VERIFICATION.md).

Android, verklig telefonacceleration, hela ECG/H10-XYZ-kedjan, samtidig högfrekvensinsamling och kapacitetsmätningar återstår. RMSSD-hjälpfunktionen är testad men visas inte som kliniskt mått eller stressklassificering.

Produktionsdrift kräver separat autentisering/provisionering, åtkomstroller, kryptering, retention, backup och belastningstest. Mobilens SDK 54-beroenden behöver kompatibilitets- och säkerhetsgranskning före distribution; tvingad versionsnedgradering har inte använts för att få en grön audit. Endast syntetiska deltagardata medföljer.
