# APEX på en fysisk iPhone

App: `apps/mobile`. Mätningen omfattar puls (HR), RR-intervall, EKG och H10-accelerationens råa X/Y/Z samt magnitud. Passet sparas lokalt och skickas manuellt till samma API och databas som webbens sessionslista. Samtliga signaler har observerats i appens förhandsvisning på fysisk iPhone; ett fullständigt inspelnings-/synkprov verifieras separat.

## 1. Gör Macens server tillgänglig

Avsluta en eventuell `npm run dev` på port 3003. Starta sedan från repots rot:

```sh
export PATH="/opt/homebrew/bin:$PATH"
npm run dev:lan
```

Detta gör utvecklingsservern tillgänglig på det lokala nätverket. iPhone och Mac ska vara på samma Wi-Fi. I macOS Systeminställningar → Wi-Fi → Detaljer → TCP/IP finns Macens IP-adress. Om den exempelvis är `192.168.1.100` är appens serveradress `http://192.168.1.100:3003`.

Öppna den adressen i Safari på iPhone först. Om APEX inte öppnas där behöver nätverk/serveråtkomst lösas före appinloggning. `127.0.0.1` på en fysisk iPhone pekar på telefonen, inte Macen.

Serveradressen kan anges direkt i appen. För ett förifyllt fält, skapa `apps/mobile/.env.local` med:

```sh
EXPO_PUBLIC_APEX_SERVER_URL=http://192.168.1.100:3003
```

Använd Macens faktiska adress och starta om Metro efter ändring. Variabeln är offentlig konfiguration; lägg inte lösenord eller tokens i den.

## 2. Installera development build

Anslut iPhone med kabel, lås upp den och godkänn att lita på Macen. Xcode behöver telefonen tillgänglig, ett utvecklingsteam för signering och Developer Mode på telefonen när iOS kräver det.

Från `apps/mobile`:

```sh
export PATH="/opt/homebrew/bin:$PATH"
npm run ios -- --device
```

Välj den fysiska iPhonen. Kommandot bygger appen med den lokala Polar-modulen, installerar den och startar Metro. Om projektet behöver genereras eller pods uppdateras gör Expo CLI detta som del av körningen. För ett befintligt installerat bygge kan Metro startas separat med `npm run start -- --lan`.

Expo Go kan inte köra den egna Polar-bryggan. Vid signeringsfel väljs ett Apple-utvecklingsteam i Xcode under Signing & Capabilities för `apexVIP`.

En redan parkopplad telefon kan installeras och testas över samma Wi-Fi. Kontrollera i Xcodes Devices and Simulators att telefonen är tillgänglig via nätverket. För första parkopplingen på iOS 26 används kabel. Se [Apples instruktioner](https://help.apple.com/xcode/mac/current/en.lproj/devbc48d1bad.html). Håll telefonen upplåst under installationen.

För ett bygge som kan startas utan Metro, kör `npm run ios -- --device --configuration Release --no-bundler`. API-servern behövs fortfarande för inloggning och synk. Se [leverans- och testprotokollet](SHIP.md).

## 3. Kör ett första pass

1. Öppna appen och tillåt Bluetooth och lokalt nätverk när iOS frågar.
2. Ange Macens serveradress och logga in på samma konto som webben. Det syntetiska utvecklingskontot är `demo@apexvip.local` / `apex-demo-2026`.
3. Ange ett deltagar-ID, till exempel `P-001`.
4. Fukta H10-bandets elektroder, sätt på bandet och välj **Find Polar H10**. Stäng andra appar som håller bandets Bluetooth-anslutning om bandet inte blir tillgängligt.
5. Anslut bandet, vänta på **H10 streaming services ready** och kontrollera puls, RR, EKG och X/Y/Z i **Signal preview**. Kontakt ska vara god. Förhandsvisning sparas inte som ett pass.
6. Fyll i förefrågorna och välj **Start recording**. Håll appen öppen vid första testet.
7. Spela in 1–2 minuter, fyll i efterfrågorna och välj **Finish and save recording**.
8. Välj **Sync pending batches**. Passet ska visa **Synced to server** efter serverkvittens.
9. Välj **View session on web** i appen eller **Refresh** i webbens sessionslista och öppna passet. Kontrollera HR, RR, EKG, H10 X/Y/Z, händelser, självskattningar och CSV.

Fortsätt sedan med avbrott, längre pass och låst skärm enligt [mobiltestplanen](MOBILE_VERIFICATION.md). Simulatorprovet visar lagring och synk, men bevisar inte Bluetooth eller insamling i bakgrunden. Telefonrörelse i nuvarande webbdemo är syntetisk; den här mobilversionen samlar HR/RR/EKG/H10 XYZ.

## Status för förberedelsen

Ingen fysisk iPhone var ansluten vid kontrollen den 18 oktober 2026. Installation, signering och den första H10-mätningen väntar tills telefonen är tillgänglig.
