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
