import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { parental } from "@/src/parental";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, logout } = useAuth();
  const [pinInput, setPinInput] = useState("");
  const [pinSet, setPinSet] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [autoLockWarn] = useState(true);

  useEffect(() => { parental.isPinSet().then(setPinSet); }, []);

  const savePin = async () => {
    if (!/^\d{4,6}$/.test(pinInput)) {
      setSavedMsg("PIN must be 4–6 digits");
      return;
    }
    await parental.setPin(pinInput);
    setPinSet(true);
    setPinInput("");
    setSavedMsg("Parental PIN saved");
    setTimeout(() => setSavedMsg(null), 2000);
  };
  const clearPin = async () => {
    const doIt = async () => { await parental.clearPin(); setPinSet(false); setSavedMsg("Parental PIN removed"); setTimeout(() => setSavedMsg(null), 2000); };
    if (Platform.OS === "web") { if (window.confirm("Remove parental PIN?")) doIt(); }
    else Alert.alert("Remove PIN?", "Locked categories will become visible to anyone.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: doIt }]);
  };

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const expiryStr = (() => {
    if (session?.mode !== "xtream") return null;
    const exp = session.userInfo?.exp_date;
    if (!exp) return null;
    const n = Number(exp);
    if (!n) return null;
    const d = new Date(n * 1000);
    return d.toLocaleDateString();
  })();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] + 60, gap: theme.spacing.lg }} testID="settings-scroll">
        <View style={styles.card} testID="settings-account-card">
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={22} color={theme.color.brandPrimary} />
            <Text style={styles.cardTitle}>Account</Text>
          </View>
          {session?.mode === "xtream" ? (
            <>
              <Row label="Username" value={session.userInfo?.username || "—"} />
              <Row label="Server" value={session.creds.server} mono />
              <Row label="Status" value={session.userInfo?.status || "—"} />
              <Row label="Max connections" value={String(session.userInfo?.max_connections || "—")} />
              {expiryStr ? <Row label="Expires" value={expiryStr} highlight /> : <Row label="Subscription" value="Lifetime / —" />}
            </>
          ) : session?.mode === "m3u" ? (
            <>
              <Row label="Playlist URL" value={session.url} mono />
              <Row label="Channels" value={String(session.channels.length)} />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed" size={22} color={theme.color.brand} />
            <Text style={styles.cardTitle}>Parental control</Text>
          </View>
          <Text style={styles.hint}>
            Categories whose names match adult keywords (adult, xxx, 18+, …) are auto-locked when a PIN is set. Enter the PIN once to unlock all locked categories for 10 minutes.
          </Text>

          <Text style={styles.label}>{pinSet ? "Change PIN" : "Create a 4–6 digit PIN"}</Text>
          <TextInput
            testID="settings-pin-input"
            style={styles.input}
            value={pinInput}
            onChangeText={t => setPinInput(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••"
            placeholderTextColor={theme.color.muted}
            keyboardType="number-pad"
            secureTextEntry
          />
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Pressable testID="settings-pin-save" onPress={savePin} style={[styles.btn, styles.btnPrimary, { flex: 1 }]}>
              <Text style={styles.btnTextPrimary}>{pinSet ? "Update PIN" : "Save PIN"}</Text>
            </Pressable>
            {pinSet && (
              <Pressable testID="settings-pin-clear" onPress={clearPin} style={[styles.btn, styles.btnDanger]}>
                <Text style={styles.btnTextDanger}>Remove</Text>
              </Pressable>
            )}
          </View>

          {savedMsg && <Text style={styles.savedMsg} testID="settings-pin-msg">{savedMsg}</Text>}
        </View>

        <Pressable testID="settings-logout" onPress={onLogout} style={[styles.card, styles.logoutRow]}>
          <Ionicons name="log-out-outline" size={22} color={theme.color.error} />
          <Text style={styles.logoutText}>Sign out</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.color.muted} style={{ marginLeft: "auto" }} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.rowValue, mono && styles.rowValueMono, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  title: { color: theme.color.onSurface, fontSize: theme.font.size["2xl"], fontWeight: "600" },

  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  cardTitle: { color: theme.color.onSurface, fontSize: theme.font.size.lg, fontWeight: "600" },
  hint: { color: theme.color.muted, fontSize: theme.font.size.sm, marginBottom: theme.spacing.md, lineHeight: 18 },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  rowLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  rowValue: { color: theme.color.onSurface, fontSize: theme.font.size.base, maxWidth: "60%", textAlign: "right" },
  rowValueMono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: theme.font.size.sm },
  rowValueHighlight: { color: theme.color.brandPrimary, fontWeight: "600" },

  label: { color: theme.color.onSurface, fontSize: theme.font.size.base, fontWeight: "500", marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },
  input: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.size.lg, color: theme.color.onSurface, letterSpacing: 6, textAlign: "center" },
  btn: { paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: theme.color.brand },
  btnTextPrimary: { color: "#FFFFFF", fontSize: theme.font.size.base, fontWeight: "600" },
  btnDanger: { borderWidth: 1, borderColor: theme.color.error, paddingHorizontal: theme.spacing.lg },
  btnTextDanger: { color: theme.color.error, fontSize: theme.font.size.base, fontWeight: "600" },
  savedMsg: { color: theme.color.success, textAlign: "center", marginTop: theme.spacing.md, fontSize: theme.font.size.base },

  logoutRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.lg },
  logoutText: { color: theme.color.error, fontSize: theme.font.size.lg, fontWeight: "500" },
});
