# API / kontrakt v1

Alla anrop utom inloggning kräver HttpOnly-cookie eller `Authorization: Bearer <token>`. Arbetsyta hämtas på servern från kontot. JSON-fel använder HTTP 400/401/403/404/409/413. Ingen klient får ange arbetsyta i ingest-payload.

| Metod | Resurs                                               | Innehåll                                                                         |
| ----- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| POST  | `/api/auth/login`                                    | `{email,password}` → användare och token; webb får cookie                        |
| POST  | `/api/auth/logout`                                   | Ta bort webbens session                                                          |
| GET   | `/api/me`                                            | Aktuellt konto/arbetsyta                                                         |
| POST  | `/api/demo`                                          | Versionerade definitioner och fyra syntetiska sessioner via ingest               |
| POST  | `/api/templates`                                     | Oföränderlig `{id,version,title,eventLabels,questions}`                          |
| GET   | `/api/templates`                                     | Arbetsytans definitioner                                                         |
| POST  | `/api/ingest`                                        | `{version:1,batchId,session,samples}` → `{version:1,batchId,accepted,duplicate}` |
| GET   | `/api/sessions`                                      | Arbetsytans sessionsmetadata                                                     |
| GET   | `/api/sessions/:id`                                  | En session                                                                       |
| GET   | `/api/sessions/:id/series?signal=hr&from=0&to=60000` | Renderpunkter, råstatistik och luckor för numeriskt tidsfönster                  |
| GET   | `/api/sessions/:id/raw?after=-1`                     | Högst 1000 råsamples med cursor; fortsätt från sista cursor                      |
| POST  | `/api/layouts`                                       | Validerat upplägg v1; alla sessioner måste tillhöra arbetsytan                   |
| GET   | `/api/layouts`                                       | Sparade upplägg                                                                  |

Paket: högst 2000 samples och 2 MB JSON. Mobil använder 500. Definitionen för sessionens typ/version ska synkroniseras först. Självskattning kontrolleras mot definitionens fråge-ID eller äldre svarsetikett, intervall och version. Samples identifieras med session/signal/index; en ändrad kopia ger 409. Oförändrade återförsök kvitteras utan dubbletter. Metadata från äldre paket kan inte ta bort händelser eller korta sessionen. Avslutad session får inte återöppnas.

Råsample: `signal`, `index`, `t` relativa ms, `receivedAt` Unix ms, valfritt `sensorTime` sträng, `value`, `quality`. Signaler och enheter definieras centralt i `src/core/contract.ts`. `sensorTime` är inte automatiskt konverterad till gemensam tid. `quality=measured` ingår i statistik; suspect/missing bevaras men bryter diagrammets giltiga kurva.

Renderpunkter är första/sista/min/max per tidsbucket; statistik är SQL-beräkning på rådata. Populationsstandardavvikelse används för z-normalisering. Ett tomt fönster ger null-statistik, inte nollvärden. CSV-export innehåller rådata och dess källtid, inte normaliserade eller renderförenklade värden. Signalernas faktiska enheter följer kontraktet; analyskonfigurationen exporteras separat.

`GET /api/sessions/:id/signals` ger tillgängliga signaler och råsampleantal. Samma arbetsytekontroll som series/raw gäller; saknad eller främmande session ger 404. Endpunkten används av signalväljare och HR-fallback.

H10-signaler: `hr` (bpm), `rr` (ms), `ecg` (µV), `h10accx`, `h10accy`, `h10accz` och `h10acc` (mg). Magnituden är härledd; axlarna är råvärden inklusive gravitation. EKG/XYZ har ursprunglig PMD-nanosekundstid i `sensorTime`; det lagras som sträng. Samtliga signaler stöds av ingest, `/signals`, `/series`, `/raw` och CSV-export.
