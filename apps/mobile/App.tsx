import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  PermissionsAndroid,
  Platform,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import Polar, { PolarConnectionStatePayload } from "./modules/apex-polar";
import { Session, defaultTemplate } from "../../src/core/contract";
import { start, finish, snapshot, event } from "./src/collector";
import { counts, localSessions, recover } from "./src/storage";
import LiveSignals from "./src/LiveSignals";
import {
  observePolar,
  liveSnapshot,
  startPreview,
  stopStreams,
} from "./src/livePolar";
import { synchronize } from "./src/sync";
const mvpTemplate = {
  ...defaultTemplate,
  id: "mvp-recording",
  version: 1,
  title: "H10 recording",
  questions: [],
  eventLabels: [],
};
type Account = { token: string; workspace: string; server: string };
function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: "#2b766b" }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export default function App() {
  const defaultServer =
    process.env.EXPO_PUBLIC_APEX_SERVER_URL ?? "http://127.0.0.1:3003";
  const [server, setServer] = useState(defaultServer);
  const [account, setAccount] = useState<Account>({
    token: "",
    workspace: "demo-lab",
    server: defaultServer,
  });
  const [phoneSensors, setPhoneSensors] = useState(true);
  const [maxHeartRate, setMaxHeartRate] = useState("");
  const [name, setName] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [connection, setConnection] =
    useState<PolarConnectionStatePayload | null>(null);
  const [current, setCurrent] = useState(snapshot());
  const [live, setLive] = useState(liveSnapshot());
  const previewRef = useRef<{
    bpm: number;
    contactDetected: boolean;
    contactSupported: boolean;
    rrAvailable: boolean;
  } | null>(null);
  const [preview, setPreview] = useState(previewRef.current);
  const [rows, setRows] = useState<
    {
      session: Session;
      sealed: number;
      samples: number;
      pending: number;
      signals: { signal: string; count: number }[];
    }[]
  >([]);
  async function refresh(a = account) {
    const locals = await localSessions(a.workspace);
    setRows(
      await Promise.all(
        locals.map(async (r) => ({
          session: JSON.parse(r.metadata),
          sealed: r.sealed,
          ...(await counts(r.id)),
        })),
      ),
    );
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The action failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void SecureStore.getItemAsync("apex-mvp-server")
      .then((address) => {
        if (address) {
          setServer(address);
          setAccount({ token: "", workspace: "demo-lab", server: address });
        }
      })
      .catch((e) => setMessage(e.message));
    void refresh().catch((e) => setMessage(e.message));
    const stopObserving = observePolar();
    const subs = Polar
      ? [
          Polar.addListener("connectionStateChanged", (s) => {
            setConnection(s);
            if (!s.isConnected) previewRef.current = null;
            if (s.isConnected && !snapshot().session)
              void startPreview().catch((e) => setMessage(e.message));
          }),
          Polar.addListener("heartRateSampleReceived", (s) => {
            previewRef.current = s;
          }),
          Polar.addListener(
            "deviceDiscovered",
            () => void Polar?.getConnectionState().then(setConnection),
          ),
          Polar.addListener("nativeError", (e) => setMessage(e.message)),
        ]
      : [];
    void Polar?.getConnectionState().then((s) => {
      setConnection(s);
      if (s.isConnected)
        void startPreview().catch((e) => setMessage(e.message));
    });
    const timer = setInterval(() => {
      setCurrent(snapshot());
      setPreview(previewRef.current);
      setLive(liveSnapshot());
    }, 250);
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active" && snapshot().session)
        setMessage(
          "Background recording must be verified on a physical device.",
        );
    });
    return () => {
      stopObserving();
      subs.forEach((s) => s.remove());
      clearInterval(timer);
      app.remove();
    };
  }, []);
  async function scan() {
    await act(async () => {
      if (!Polar)
        throw Error(
          "Install a development build for Polar H10. Expo Go is not supported.",
        );
      if (Platform.OS === "android") {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        if (Object.values(result).some((v) => v !== "granted"))
          throw Error("Bluetooth permission is required");
      }
      await Polar.startScan();
      setConnection(await Polar.getConnectionState());
    });
  }

  function address() {
    const value = server.trim().replace(/\/+$/, "");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw Error("Enter the Mac’s server address in Server settings.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw Error("Enter an HTTP or HTTPS server address without a page path.");
    return value;
  }
  async function send() {
    const target = address();
    await SecureStore.setItemAsync("apex-mvp-server", target);
    setAccount((a) => ({ ...a, server: target }));
    await synchronize(target, "", account.workspace, (n) =>
      setMessage(`Sending… ${n} batches received`),
    );
    await refresh();
    setMessage("Sent. Open the web dashboard to view your session.");
  }
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>apex</Text>
            <Text style={styles.tag}>POLAR H10</Text>
          </View>
          {message ? (
            <View style={styles.notice}>
              <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
                {message}
              </Text>
            </View>
          ) : null}
          {!current.session ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>1. Connect your H10</Text>
                <Text style={styles.sensorStatus}>
                  {connection?.isConnected
                    ? `Connected · ${connection.name}`
                    : connection?.connectionState === "scanning"
                      ? "Searching…"
                      : "Put on your strap, then find your sensor."}
                </Text>
                {connection?.isConnected && (
                  <Text style={styles.hint}>
                    {preview
                      ? `${preview.bpm} bpm · Contact ${!preview.contactSupported ? "unknown" : preview.contactDetected ? "good" : "adjust strap"}`
                      : "Waiting for sensor…"}
                  </Text>
                )}
                {connection?.discoveredDevices
                  .filter(
                    (d) => d.id !== connection.id || !connection.isConnected,
                  )
                  .map((d) => (
                    <Button
                      key={d.id}
                      title={`Connect ${d.name} · ${d.id}`}
                      secondary
                      disabled={busy}
                      onPress={() =>
                        void act(async () => {
                          await Polar?.stopScan();
                          await Polar?.connectToDevice(d.id);
                        })
                      }
                    />
                  ))}
                {!connection?.isConnected && (
                  <Button
                    title="Find Polar H10"
                    disabled={busy}
                    onPress={() => void scan()}
                  />
                )}
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>2. Name your recording</Text>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  style={styles.input}
                  accessibilityLabel="Your name"
                  placeholder="Your name"
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                />
                <Text style={styles.label}>Session</Text>
                <TextInput
                  style={styles.input}
                  accessibilityLabel="Session name"
                  placeholder="e.g. Wednesday training"
                  value={sessionTitle}
                  onChangeText={setSessionTitle}
                  maxLength={160}
                />
                <Text style={styles.hint}>
                  Use the same session name to group participants on the web.
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={styles.label}>Phone sensors</Text>
                  <Switch
                    accessibilityLabel="Phone sensors"
                    value={phoneSensors}
                    onValueChange={setPhoneSensors}
                  />
                </View>
                <Text style={styles.hint}>
                  Motion, rotation, steps, cadence, elevation and GPS. Keep your
                  phone in a fixed position and the app open.
                </Text>
                <Text style={styles.label}>Maximum heart rate (optional)</Text>
                <TextInput
                  accessibilityLabel="Maximum heart rate"
                  keyboardType="number-pad"
                  maxLength={3}
                  style={styles.input}
                  value={maxHeartRate}
                  onChangeText={setMaxHeartRate}
                  placeholder="Your known max, e.g. 190"
                />
                <Text style={styles.hint}>
                  Used for zones. Leave blank if unknown.
                </Text>
                <Button
                  title="Start recording"
                  disabled={
                    busy ||
                    !name.trim() ||
                    !sessionTitle.trim() ||
                    !connection?.isConnected ||
                    !connection.hrReady ||
                    !connection.streamingReady ||
                    !!(preview?.contactSupported && !preview.contactDetected)
                  }
                  onPress={() =>
                    void act(async () => {
                      const max = maxHeartRate.trim()
                        ? Number(maxHeartRate)
                        : undefined;
                      if (
                        max !== undefined &&
                        (!Number.isInteger(max) || max < 100 || max > 240)
                      )
                        throw Error(
                          "Enter a maximum heart rate between 100 and 240, or leave it blank.",
                        );
                      await start(
                        await digestStringAsync(
                          CryptoDigestAlgorithm.SHA256,
                          name.trim().normalize("NFKC").toLowerCase(),
                        ),
                        account.workspace,
                        {},
                        mvpTemplate,
                        {
                          name: name.trim(),
                          title: sessionTitle.trim(),
                          phoneSensors,
                          maxHeartRate: max,
                        },
                      );
                      setCurrent(snapshot());
                    })
                  }
                />
              </View>
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {current.session.participantLabel} · {current.session.title}
              </Text>
              <Text style={styles.duration}>
                {Math.floor((Date.now() - current.session.startedAt) / 60000)}:
                {String(
                  Math.floor((Date.now() - current.session.startedAt) / 1000) %
                    60,
                ).padStart(2, "0")}
              </Text>
              <Text style={styles.sensorStatus}>
                {connection?.isConnected
                  ? "Recording · H10 connected"
                  : "Connection lost · reconnect your strap"}
              </Text>
              {!connection?.isConnected && (
                <Button
                  title="Reconnect H10"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void act(async () => {
                      const id = current.session?.source.replace(
                        "polar-h10:",
                        "",
                      );
                      if (id) await Polar?.connectToDevice(id);
                    })
                  }
                />
              )}
              {current.error && (
                <Text style={styles.error}>{current.error}</Text>
              )}
              <Text style={styles.hint}>{current.phoneStatus}</Text>
              <View style={styles.chips}>
                {["Work", "Rest"].map((label) => (
                  <Button
                    key={label}
                    title={`Mark ${label}`}
                    secondary
                    disabled={busy}
                    onPress={() =>
                      void act(async () => {
                        await event(label);
                        setCurrent(snapshot());
                        setMessage(`${label} marked`);
                      })
                    }
                  />
                ))}
              </View>
              <LiveSignals data={live} recording />
              <Button
                title="Finish and send to web"
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await finish({});
                    setCurrent(snapshot());
                    await refresh();
                    try {
                      await send();
                    } catch (e) {
                      throw Error(
                        `Recording saved on this phone. ${e instanceof Error ? e.message : "Upload failed"} Use Send saved recordings to retry.`,
                      );
                    }
                  })
                }
              />
            </View>
          )}
          {!current.session && rows.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Saved recordings</Text>
              {rows.map((r) => (
                <View style={styles.localRow} key={r.session.id}>
                  <Text style={styles.localTitle}>
                    {r.session.title} · {r.session.participantLabel}
                  </Text>
                  <Text style={styles.hint}>
                    {!r.sealed
                      ? "Interrupted recording"
                      : r.pending
                        ? "Saved on phone · waiting to send"
                        : "Sent to web"}
                    {r.session.demo ? " · Synthetic demo" : ""}
                  </Text>
                  {!r.sealed && (
                    <Button
                      title="Recover recording"
                      secondary
                      disabled={busy}
                      onPress={() =>
                        void act(async () => {
                          await recover(r.session.id, account.workspace);
                          await refresh();
                        })
                      }
                    />
                  )}
                  {!!r.sealed && !r.pending && (
                    <Button
                      title="Open dashboard"
                      secondary
                      onPress={() =>
                        void act(async () => {
                          await Linking.openURL(
                            `${address()}/?session=${encodeURIComponent(r.session.id)}`,
                          );
                        })
                      }
                    />
                  )}
                </View>
              ))}
              <Button
                title="Send saved recordings"
                disabled={busy}
                onPress={() => void act(send)}
              />
            </View>
          )}
          {!current.session && (
            <>
              <Button
                title={settings ? "Close server settings" : "Server settings"}
                secondary
                onPress={() => setSettings(!settings)}
              />
              {settings && (
                <View style={styles.section}>
                  <Text style={styles.label}>Web server address</Text>
                  <TextInput
                    style={styles.input}
                    accessibilityLabel="Web server address"
                    value={server}
                    onChangeText={setServer}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <Text style={styles.hint}>
                    Use your Mac’s Wi-Fi address, with :3003. Connect both
                    devices to the same Wi-Fi.
                  </Text>
                  <Button
                    title="Save server address"
                    disabled={busy}
                    onPress={() =>
                      void act(async () => {
                        const target = address();
                        await SecureStore.setItemAsync(
                          "apex-mvp-server",
                          target,
                        );
                        setAccount((a) => ({ ...a, server: target }));
                        setSettings(false);
                        setMessage("Server address saved.");
                      })
                    }
                  />
                </View>
              )}
            </>
          )}
          {busy && <ActivityIndicator color="#2b766b" />}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f6f0" },
  content: { padding: 24, paddingBottom: 40, gap: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1.5,
    color: "#26392e",
  },
  vip: { fontSize: 11, letterSpacing: 1 },
  tag: { fontSize: 9, letterSpacing: 2, color: "#7e8c75" },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: "#2b766b" },
  title: {
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: -1,
    color: "#27312b",
  },
  subtitle: { fontSize: 13, color: "#7e8578", lineHeight: 21, marginTop: -9 },
  notice: { padding: 14, backgroundColor: "#e6eee2", borderRadius: 6 },
  noticeText: { fontSize: 12, lineHeight: 18, color: "#36523e" },
  section: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4d7",
    borderRadius: 8,
    padding: 20,
    gap: 13,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#303c32" },
  step: { fontSize: 11, color: "#95a08b", fontVariant: ["tabular-nums"] },
  label: { fontSize: 11, color: "#7e8775", fontWeight: "500" },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: "#dbe1d3",
    paddingHorizontal: 12,
    borderRadius: 5,
    color: "#27332a",
    fontSize: 14,
  },
  hint: { fontSize: 11, lineHeight: 18, color: "#8b9380" },
  button: {
    backgroundColor: "#2b766b",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 6,
    minHeight: 46,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  secondary: {
    backgroundColor: "#eef3e9",
    borderWidth: 1,
    borderColor: "#dce6d5",
  },
  project: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#dce2d4",
    gap: 8,
  },
  projectName: { fontSize: 16, fontWeight: "600", color: "#334635" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#dbe2d2",
    borderRadius: 5,
    padding: 10,
  },
  chipSelected: { backgroundColor: "#e6eedf", borderColor: "#a8bf9d" },
  chipText: { fontSize: 11, color: "#4e6445" },
  sensorStatus: { fontSize: 13, color: "#2b766b", fontWeight: "500" },
  duration: { fontSize: 48, fontVariant: ["tabular-nums"], color: "#2b4935" },
  error: { fontSize: 12, color: "#954d43" },
  localRow: {
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderColor: "#edf0e6",
    gap: 8,
  },
  localTitle: { fontSize: 12, fontWeight: "600", color: "#44533d" },
  footer: {
    fontSize: 10,
    lineHeight: 18,
    color: "#99a08f",
    textAlign: "center",
    marginTop: 10,
  },
});
