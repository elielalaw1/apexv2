# Verifierad status — 6 oktober 2026

Första sammanhängande milstolpen är genomförd i ett nytt lokalt Git-repo, `apexVIP`, på grenen `main`. Repot är inte publicerat på GitHub. Originalrepos är bevarade: apex-web `7459997`, apex-mobile `5e933f8`.

## Förenklad dashboard

Startsidan visar en kort sammanfattning och de fyra senaste sessionerna. Upplägg och konfiguration ligger under Fler verktyg. Analysens redigering visas via Anpassa analys, medan tekniska sampleuppgifter finns under Datakvalitet. Ingen lagrad mätdata eller analysfunktion har tagits bort.

Omdesignen har granskats på desktop och mobil. TypeScript, produktionsbygge och två uppdaterade Playwright-tester passerade. Testerna kontrollerar också att startsidan håller extra verktyg hopfällda och att den smala vyn saknar horisontell sidöverströmning. [Ny översikt](dashboard-desktop.png) · [Mobil översikt](dashboard-mobile-web.png).

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
| Separat API-kontroll efter mobiltestet | 2 syntetiska mobilpass, exakt 60 HR + 60 RR per pass |
| Webbens npm audit | 0 rapporterade sårbarheter vid kontrollen |
| Mobilens npm audit | 32 rapporterade beroendesårbarheter: 10 moderate, 22 high; kvarstående arbete |

Skärmbilder från körningarna: [desktop](analysis-desktop.png), [mobil webb](analysis-mobile-web.png), [native iOS-simulator](mobile-ios-simulator.png). Gränssnittet har granskats visuellt. Testdatabaser ligger separat från appens standarddatabas och ingår inte i Git.

## Kvarstår

Fysisk Polar H10-insamling är **inte verifierad**. Simulatorns syntetiska pass bevisar lagring, omstart och API-överföring, men inte sensorkontakt, Bluetooth, RR-tid på fysisk enhet eller insamling med låst skärm. Se [mobiltestplanen](MOBILE_VERIFICATION.md).

Android, verklig telefonacceleration, hela ECG/H10-XYZ-kedjan, samtidig högfrekvensinsamling och kapacitetsmätningar återstår. RMSSD-hjälpfunktionen är testad men visas inte som kliniskt mått eller stressklassificering.

Produktionsdrift kräver separat autentisering/provisionering, åtkomstroller, kryptering, retention, backup och belastningstest. Mobilens SDK 54-beroenden behöver kompatibilitets- och säkerhetsgranskning före distribution; tvingad versionsnedgradering har inte använts för att få en grön audit. Endast syntetiska deltagardata medföljer.
