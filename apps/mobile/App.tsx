import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import Polar, { PolarConnectionStatePayload } from "./modules/apex-polar";
import { Session, Template, defaultTemplate } from "../../src/core/contract";
import { displayText } from "../../src/core/presentation";
import { start, event, finish, snapshot } from "./src/collector";
import {
  counts,
  localSessions,
  recover,
  saveSession,
  seal,
  SampleWriter,
  saveLocalTemplate,
  localTemplates,
} from "./src/storage";
import { request, synchronize } from "./src/sync";
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
function validateAnswers(
  template: Template,
  phase: "pre" | "post",
  answers: Record<string, string>,
) {
  const out: Record<string, number> = {};
  for (const q of template.questions.filter((q) => q.phase === phase)) {
    const value = Number(answers[q.id]);
    if (
      !answers[q.id]?.trim() ||
      !Number.isFinite(value) ||
      value < q.min ||
      value > q.max
    )
      throw Error(`${displayText(q.label)}: enter ${q.min}–${q.max}`);
    out[q.id] = value;
  }
  return out;
}
export default function App() {
  const previewRef = useRef<{
    bpm: number;
    contactDetected: boolean;
    contactSupported: boolean;
    rrAvailable: boolean;
  } | null>(null);
  const [preview, setPreview] = useState(previewRef.current);
  const [account, setAccount] = useState<Account | null>(null),
    [server, setServer] = useState(
      process.env.EXPO_PUBLIC_APEX_SERVER_URL ?? "http://127.0.0.1:3003",
    ),
    [email, setEmail] = useState("demo@apexvip.local"),
    [password, setPassword] = useState("apex-demo-2026"),
    [participant, setParticipant] = useState("P-001"),
    [answers, setAnswers] = useState<Record<string, string>>({
      readiness: "7",
      rpe: "6",
    }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [connection, setConnection] = useState<PolarConnectionStatePayload | null>(
      null,
    ),
    [current, setCurrent] = useState(snapshot()),
    [rows, setRows] = useState<
      { session: Session; sealed: number; samples: number; pending: number }[]
    >([]),
    [templates, setTemplates] = useState<Template[]>([defaultTemplate]),
    [template, setTemplate] = useState(defaultTemplate);
  async function refresh(a = account) {
    if (!a) return;
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
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The action failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void SecureStore.getItemAsync("apex-account")
      .then(async (data) => {
        if (data) {
          const a = JSON.parse(data);
          setAccount(a);
          setServer(a.server);
          await refresh(a);
          const cached = await localTemplates(a.workspace);
          if (cached.length) {
            setTemplates(cached);
            setTemplate(cached[0]);
          }
        }
      })
      .catch((e) => setMessage(e.message));
    const subs = Polar
      ? [
          Polar.addListener("connectionStateChanged", (s) => {
            setConnection(s);
            if (!s.isConnected) previewRef.current = null;
            if (s.isConnected && !snapshot().session)
              void Polar?.startHeartRateStream().catch((e) =>
                setMessage(e.message),
              );
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
    void Polar?.getConnectionState().then(setConnection);
    const timer = setInterval(() => {
      setCurrent(snapshot());
      setPreview(previewRef.current);
    }, 1000);
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active" && snapshot().session)
        setMessage(
          "Background recording must be verified on a physical device.",
        );
    });
    return () => {
      subs.forEach((s) => s.remove());
      clearInterval(timer);
      app.remove();
    };
  }, []);
  async function login() {
    await act(async () => {
      const address = server.trim().replace(/\/+$/, "");
      let parsed: URL;
      try {
        parsed = new URL(address);
      } catch {
        throw Error(
          "Enter your APEX server address, for example http://192.168.1.100:3003",
        );
      }
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        parsed.pathname !== "/"
      )
        throw Error(
          "Enter only the HTTP or HTTPS server address, without a page path or login details.",
        );
      const r = await request<{ token: string; user: { workspace: string } }>(
        address,
        "auth/login",
        { email, password },
      );
      const a = {
        token: r.token,
        workspace: r.user.workspace,
        server: address,
      };
      await SecureStore.setItemAsync("apex-account", JSON.stringify(a));
      setAccount(a);
      setServer(address);
      await refresh(a);
      const resp = await fetch(`${address}/api/templates`, {
        headers: { Authorization: `Bearer ${a.token}` },
      });
      if (resp.ok) {
        const t: Template[] = await resp.json();
        if (t.length) {
          for (const definition of t)
            await saveLocalTemplate(a.workspace, definition);
          setTemplates(t);
          setTemplate(t[0]);
        }
      }
      setMessage(
        "Signed in. Batches are marked synced only after server acknowledgment.",
      );
    });
  }
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
  async function demo() {
    if (!account) return;
    await act(async () => {
      const now = Date.now(),
        s: Session = {
          id: randomUUID(),
          participantId: participant,
          participantLabel: participant,
          title: "Synthetic mobile session",
          typeId: template.id,
          typeVersion: template.version,
          startedAt: now,
          durationMs: 60000,
          demo: true,
          source: "mobile-synthetic-v1",
          timePolicy: "receipt-relative-v1",
          state: "ended",
          events: [
            { id: randomUUID(), t: 15000, type: "event", label: "Arbete" },
          ],
        };
      await saveLocalTemplate(account.workspace, template);
      await saveSession(s, account.workspace);
      const writer = new SampleWriter(s.id);
      for (let n = 0; n < 60; n++) {
        writer.append({
          signal: "hr",
          index: n,
          t: n * 1000,
          receivedAt: now + n * 1000,
          value: 100 + 20 * Math.sin(n / 8),
          quality: "measured",
        });
        writer.append({
          signal: "rr",
          index: n,
          t: n * 1000,
          receivedAt: now + n * 1000,
          value: 60000 / (100 + 20 * Math.sin(n / 8)),
          quality: "measured",
        });
      }
      await writer.close();
      await seal(s, account.workspace);
      await refresh();
      setMessage(
        "Synthetic recording saved. Tap Sync pending batches to upload it.",
      );
    });
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
            <Text style={styles.logo}>
              apex<Text style={styles.vip}> VIP</Text>
            </Text>
            <Text style={styles.tag}>RECORDING</Text>
          </View>
          <Text style={styles.eyebrow}>RECORDING / POLAR H10</Text>
          <Text style={styles.title}>
            {current.session ? "Recording in progress" : "Ready to record."}
          </Text>
          <Text style={styles.subtitle}>
            Heart rate and RR. Saved locally, then synced to your workspace.
          </Text>
          {message !== "" && (
            <View accessibilityRole="alert" style={styles.notice}>
              <Text style={styles.noticeText}>{message}</Text>
            </View>
          )}
          {!account ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connect to workspace</Text>
              <Text style={styles.label}>Server address</Text>
              <TextInput
                style={styles.input}
                accessibilityLabel="Server address"
                autoCapitalize="none"
                value={server}
                onChangeText={setServer}
              />
              <Text style={styles.hint}>
                On iPhone, use your Mac’s LAN address or an HTTPS server. Use
                127.0.0.1 in the iOS simulator.
              </Text>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                accessibilityLabel="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                accessibilityLabel="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Button
                title="Sign in"
                onPress={() => void login()}
                disabled={busy}
              />
            </View>
          ) : (
            <>
              <View style={styles.project}>
                <Text style={styles.label}>WORKSPACE</Text>
                <Text style={styles.projectName}>{account.workspace}</Text>
                <Text style={styles.hint}>Pseudonymous participants</Text>
              </View>
              {!current.session ? (
                <>
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.step}>01</Text>
                      <Text style={styles.sectionTitle}>
                        Participant & session type
                      </Text>
                    </View>
                    <Text style={styles.label}>Participant ID</Text>
                    <TextInput
                      style={styles.input}
                      accessibilityLabel="Participant ID"
                      value={participant}
                      onChangeText={setParticipant}
                      autoCapitalize="none"
                    />
                    <Text style={styles.hint}>
                      Use a pseudonymous ID, such as P-014.
                    </Text>
                    <View style={styles.chips}>
                      {templates.map((t) => (
                        <Pressable
                          accessibilityRole="button"
                          key={`${t.id}-${t.version}`}
                          onPress={() => setTemplate(t)}
                          style={[
                            styles.chip,
                            template.id === t.id &&
                              template.version === t.version &&
                              styles.chipSelected,
                          ]}
                        >
                          <Text style={styles.chipText}>
                            {displayText(t.title)} v{t.version}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.step}>02</Text>
                      <Text style={styles.sectionTitle}>Polar H10</Text>
                    </View>
                    <Text style={styles.sensorStatus}>
                      {connection?.isConnected
                        ? "Connected · " + connection.name
                        : connection?.connectionState === "scanning"
                          ? "Searching for sensors…"
                          : "No sensor connected"}
                    </Text>
                    <Text style={styles.hint}>
                      Put on the strap and wet the electrodes. Sensor contact
                      marks each sample as measured or uncertain.
                    </Text>
                    {connection?.isConnected && (
                      <Text style={styles.hint}>
                        {preview
                          ? `${preview.bpm} bpm · RR ${preview.rrAvailable ? "available" : "missing"} · Contact ${!preview.contactSupported ? "unknown" : preview.contactDetected ? "good" : "uncertain"}`
                          : "Waiting for the first HR packet to check contact…"}
                      </Text>
                    )}
                    {connection?.discoveredDevices.map((d) => (
                      <Button
                        title={`Connect ${d.name} · ${d.id}`}
                        key={d.id}
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
                    <Button
                      title="Find Polar H10"
                      secondary
                      disabled={busy}
                      onPress={() => void scan()}
                    />
                  </View>
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.step}>03</Text>
                      <Text style={styles.sectionTitle}>Before recording</Text>
                    </View>
                    {template.questions
                      .filter((q) => q.phase === "pre")
                      .map((q) => (
                        <View key={q.id} style={{ gap: 8 }}>
                          <Text style={styles.label}>
                            {displayText(q.label)} · {q.min}–{q.max}
                          </Text>
                          <TextInput
                            accessibilityLabel={displayText(q.label)}
                            style={styles.input}
                            keyboardType="numeric"
                            value={answers[q.id] ?? ""}
                            onChangeText={(value) =>
                              setAnswers((prev) => ({ ...prev, [q.id]: value }))
                            }
                          />
                        </View>
                      ))}
                    <Button
                      title="Start HR/RR recording"
                      disabled={
                        busy ||
                        !connection?.isConnected ||
                        !!(
                          preview?.contactSupported && !preview.contactDetected
                        )
                      }
                      onPress={() =>
                        void act(async () => {
                          if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(participant))
                            throw Error(
                              "Participant ID: letters, numbers, hyphens or dots.",
                            );
                          await start(
                            participant,
                            account.workspace,
                            validateAnswers(template, "pre", answers),
                            template,
                          );
                          setCurrent(snapshot());
                          setMessage("Samples are being saved locally.");
                        })
                      }
                    />
                  </View>
                </>
              ) : (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {current.session.participantLabel} ·{" "}
                    {displayText(template.title)}
                  </Text>
                  <Text style={styles.duration}>
                    {Math.floor(
                      (Date.now() - current.session.startedAt) / 60000,
                    )}
                    :
                    {String(
                      Math.floor(
                        (Date.now() - current.session.startedAt) / 1000,
                      ) % 60,
                    ).padStart(2, "0")}
                  </Text>
                  <Text style={styles.sensorStatus}>
                    {connection?.isConnected
                      ? "H10 connected"
                      : "Connection lost · recording is waiting"}
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
                  <Text style={styles.hint}>
                    {current.persisted} samples saved to storage · Contact{" "}
                    {current.contact ? "good" : "uncertain"}
                  </Text>
                  {current.error && (
                    <Text style={styles.error}>{current.error}</Text>
                  )}
                  <View style={styles.chips}>
                    {template.eventLabels.map((label) => (
                      <Button
                        title={displayText(label)}
                        key={label}
                        secondary
                        disabled={busy}
                        onPress={() =>
                          void act(async () => {
                            await event(label);
                            setMessage(`Event: ${displayText(label)}`);
                          })
                        }
                      />
                    ))}
                  </View>
                  {template.questions
                    .filter((q) => q.phase === "post")
                    .map((q) => (
                      <View key={q.id} style={{ gap: 8 }}>
                        <Text style={styles.label}>
                          {displayText(q.label)} · {q.min}–{q.max}
                        </Text>
                        <TextInput
                          accessibilityLabel={displayText(q.label)}
                          style={styles.input}
                          keyboardType="numeric"
                          value={answers[q.id] ?? ""}
                          onChangeText={(value) =>
                            setAnswers((prev) => ({ ...prev, [q.id]: value }))
                          }
                        />
                      </View>
                    ))}
                  <Button
                    title="Finish and save recording"
                    disabled={busy}
                    onPress={() =>
                      void act(async () => {
                        await finish(
                          validateAnswers(template, "post", answers),
                        );
                        setCurrent(snapshot());
                        await refresh();
                        setMessage(
                          "Final buffer saved. The session is ready to sync.",
                        );
                      })
                    }
                  />
                </View>
              )}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.step}>04</Text>
                  <Text style={styles.sectionTitle}>Storage & sync</Text>
                </View>
                {rows.map((r) => (
                  <View style={styles.localRow} key={r.session.id}>
                    <Text style={styles.localTitle}>
                      {r.session.participantLabel} ·{" "}
                      {r.session.demo ? "DEMO" : "H10"}
                    </Text>
                    <Text style={styles.hint}>
                      {r.samples} samples ·{" "}
                      {!r.sealed
                        ? "Interrupted / unfinished"
                        : r.pending
                          ? `${r.pending} pending batches`
                          : "Synced to server"}
                    </Text>
                    {!r.sealed && r.session.id !== current.session?.id && (
                      <Button
                        title="Recover interrupted session"
                        secondary
                        disabled={busy}
                        onPress={() =>
                          void act(async () => {
                            await recover(r.session.id, account.workspace);
                            await refresh();
                            setMessage(
                              "Saved samples recovered. The last unsaved buffer may be missing.",
                            );
                          })
                        }
                      />
                    )}
                  </View>
                ))}
                <Button
                  title="Sync pending batches"
                  disabled={busy}
                  onPress={() =>
                    void act(async () => {
                      const n = await synchronize(
                        account.server,
                        account.token,
                        account.workspace,
                        (n) => setMessage(`${n} batches acknowledged…`),
                      );
                      await refresh();
                      setMessage(
                        `${n} batches acknowledged by the server. Raw data remains on this device.`,
                      );
                    })
                  }
                />
                <Button
                  title="Create synthetic test session"
                  secondary
                  disabled={busy || !!current.session}
                  onPress={() => void demo()}
                />
                <Text style={styles.hint}>
                  The test uses the same storage, outbox and API. It does not
                  test sensor hardware.
                </Text>
              </View>
              <Button
                title="Sign out"
                secondary
                disabled={busy || !!current.session}
                onPress={() =>
                  void act(async () => {
                    try {
                      await request(
                        account.server,
                        "auth/logout",
                        {},
                        account.token,
                      );
                    } catch {
                      setMessage(
                        "Signed out locally. Could not revoke the server session without a connection.",
                      );
                    }
                    await Polar?.stopHeartRateStream();
                    await SecureStore.deleteItemAsync("apex-account");
                    setAccount(null);
                    setRows([]);
                  })
                }
              />
            </>
          )}
          {busy && <ActivityIndicator color="#2b766b" style={{ margin: 12 }} />}
          <Text style={styles.footer}>
            apexVIP / Local recording · HR + RR{"\n"}ECG and H10 motion are
            planned milestones.
          </Text>
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
