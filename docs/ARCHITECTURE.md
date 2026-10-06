# Arkitektur och beslut

Next.js 15.5.27 / React 19 / TypeScript för webb och API; Expo 54 / React Native 0.81.5 för mobil. Bekanta tekniker behålls. Gemensamt Zod-kontrakt v1 i `src/core/contract.ts`. Mobilappen är ett separat npm-projekt.

Lokal server använder Node SQLite, WAL och transaktioner. Det ger en körbar, isolerad utvecklingskedja utan produktionsåtkomst. Metadata och råsamples är separata tabeller. Samples indexeras på session/signal/tid/index. Paket-ID och innehållshash ger idempotens; redan lagrade råsamples kan inte ersättas. Detta är en ensamserverlösning. För större samtidighet behövs PostgreSQL och chunk-/objektlagring, mätning och migration före drift.

Arbetsyta kommer alltid från autentiserad användare, aldrig klientpayload. Session, serie, export och upplägg kontrolleras servermässigt. Lösenord scrypt; slumpmässiga sessionstokens lagras hashade. Webben använder HttpOnly/SameSite-cookie; mobil Bearer-token i SecureStore. Demokonton är offentliga syntetiska konton och ska vara avstängda vid drift. SQLite-filen är inte krypterad; åtkomstskydd och krypterad enhetslagring måste konfigureras före riktiga data.

Tid: `t` är analysens relativa millisekunder, `receivedAt` UTC-mottagningstid, `sensorTime` ursprunglig sensortid som sträng (utan förlust av stora heltal). HR/RR använder initialt `receipt-relative-v1`; RR i samma paket fördelas bakåt med RR-durationssummering. Det är en uppskattning, inte en synkroniserad sensorklocka. Polar SDK använder för PMD sensortid med epok 2000-01-01; den får inte direkt blandas med Unix-tid.

Webbserier hämtas per tidsfönster. SQL väljer första/sista/min/max per tidsbucket, högst ungefär 900 renderpunkter per serie. Statistik kommer från samtliga giltiga råsamples i fönstret, aldrig renderpunkterna. Luckor beräknas på rådata. Normalisering använder råfönstrets medel och populationsstandardavvikelse och påverkar enbart visningen. Råexport är paginerad. Lucktrösklar och metodversioner finns i kontrakt/analys; inga interpolerade mätningar skapas.

Officiella referenser: [Expo SQLite SDK54](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/), [Polar H10](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/products/PolarH10.md), [Polar tidssystem](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/TimeSystemExplained.md). Återanvänd bryggan på SDK6.16; modern dokumentation bevisar inte att fysisk enhet fungerar.
