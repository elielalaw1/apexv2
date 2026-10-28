# APEX: installation, telefonprov och leverans

Detta repo innehåller webb/API och en iOS-app med Polar H10-brygga. Den första leveransen är en lokal pilot för HR/RR. GitHub-publicering är källkodsleverans; den installerar inte appen hos andra och driftsätter inte servern.

## Från en ny Mac

Installera Git, Node 22.13 eller senare, Xcode och CocoaPods. Klona repot och kör från roten:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run dev:lan
```

Öppna `http://MACENS-IP:3003` i telefonens Safari på samma Wi-Fi. Se [iPhone-guiden](IPHONE_SETUP.md) för serveradress, konton och installation. Kör sedan från `apps/mobile`:

```sh
npm ci
npm run typecheck
npm run ios -- --device
```

För ett lokalt bygge som har JavaScript inbäddat och kan starta utan Metro:

```sh
npm run ios -- --device --configuration Release --no-bundler
```

Servern måste fortfarande vara nåbar för inloggning och synk. Personal Team-signering kan behöva förnyas; detta är inte TestFlight-distribution. Välj ditt eget Apple-team i Xcode. Lokala iOS-projekt och signeringsuppgifter ingår inte i Git.

## Testprotokoll på fysisk telefon

Använd ett nytt pseudonymt test-ID. Notera telefonmodell, iOS, appens Git-commit, bandmodell, tid och serveradress. Använd endast testdata tills produktionskraven är lösta.

| Prov | Förväntat resultat | Resultat |
| --- | --- | --- |
| Öppna app, logga in | Inget kraschfel, rätt server | Ej genomfört |
| Skapa syntetiskt testpass | 60 HR + 60 RR lagras | Ej genomfört |
| Avsluta och öppna app före synk | Passet och väntande paket finns kvar | Ej genomfört |
| Synk och öppna i webben | Serverkvittens, samma pass i sessionslistan | Ej genomfört |
| `npm run test:mobile-api` i repots rot | Exakt 60 HR + 60 RR i syntetiskt pass | Ej genomfört |
| Anslut H10 och spela in 2 minuter | Levande HR/RR, före-/eftersvar och händelser sparas | Ej genomfört |
| Synk av H10-pass och CSV | Rätt deltagare, tid, signaler och inga dubletter | Ej genomfört |
| Nätverk av vid synk, sedan på och försök igen | Paket finns kvar tills kvittens, inga dubletter | Ej genomfört |
| Kort Bluetooth-avbrott | Tydlig status och synligt avbrott i signalen | Ej genomfört |
| Lås skärmen och återgå | Dokumentera faktisk insamling och eventuella luckor | Ej genomfört |
| Längre pass och omstart | Dokumentera datamängd, återhämtning och förlorad buffert | Ej genomfört |

Ett syntetiskt pass bevisar lagring och överföring, inte Bluetooth eller bakgrundsinsamling. Markera varje rad först efter faktisk observation. För detaljer: [mobilverifiering](MOBILE_VERIFICATION.md).

## Automatiska kontroller

GitHub Actions kör webbens typkontroll, tester, produktionsbygge och webbläsartester samt mobilens typkontroll och iOS-export. Native signering och fysisk H10 provas lokalt. För motsvarande webbläsarkontroll lokalt:

```sh
npx playwright install chromium
APEX_E2E_PRODUCTION=1 APEX_E2E_PORT=3004 npm run test:e2e
```

## Från pilot till distribution

För TestFlight behövs Apple Developer Program, ett App Store Connect-appobjekt, distributionssignering och ett uppladdat arkiv. En gemensam HTTPS-server måste ersätta Macens LAN-adress. Webbens SQLite-fil behöver beständig disk och en verifierad backup-/återställningsrutin.

Innan riktiga deltagardata: ersätt demoinloggning och provisionera användare, inför roller, lämpligt skydd för lagring och transport, retention samt begränsning av inloggningsförsök. Granska mobilberoenden och kör belastningstest. Följ [status](STATUS.md) för öppna begränsningar. HR/RR är pilotens scope; ECG, H10-råacceleration och Android är inte färdigverifierade.

## GitHub-hygien

Repo ska initialt vara privat. `.env.local`, SQLite-filer, `data/`, native byggmappar och certifikat ska inte committas. `.env.example` beskriver endast konfiguration. Testresultat från en riktig deltagare ska inte läggas i publika issues, screenshots eller Actions-artifakter.
