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
