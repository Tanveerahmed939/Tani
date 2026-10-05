import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Switch, Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth-context";
import { theme } from "@/src/theme";

const DEMO_M3U = "https://iptv-org.github.io/iptv/categories/news.m3u";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginXtream, loginM3U } = useAuth();
  const [tab, setTab] = useState<"xtream" | "m3u">("xtream");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (tab === "xtream") {
        if (!server.trim() || !username.trim() || !password) throw new Error("Fill all fields");
        await loginXtream({ server: server.trim(), username: username.trim(), password }, remember);
      } else {
        if (!m3uUrl.trim()) throw new Error("Paste an M3U playlist URL");
        await loginM3U(m3uUrl.trim(), remember);
      }
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = () => { setTab("m3u"); setM3uUrl(DEMO_M3U); };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[theme.color.gradientA, theme.color.gradientB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + theme.spacing.lg }]}>
            <View style={styles.logoWrap}>
              <Ionicons name="play-circle" size={44} color="#FFFFFF" />
              <Text style={styles.brand}>StreamX</Text>
            </View>
            <Text style={styles.tagline}>Live TV, Movies & Series in 4K — on every screen.</Text>
          </LinearGradient>

          <View style={styles.card}>
            <View style={styles.tabRow}>
              <TabButton testID="login-tab-xtream" label="Xtream Codes" active={tab === "xtream"} onPress={() => setTab("xtream")} />
              <TabButton testID="login-tab-m3u" label="M3U URL" active={tab === "m3u"} onPress={() => setTab("m3u")} />
            </View>

            {tab === "xtream" ? (
              <View>
                <Text style={styles.label}>Server URL</Text>
                <TextInput
                  testID="login-server"
                  style={styles.input}
                  value={server}
                  onChangeText={setServer}
                  placeholder="http://your-server.com:8080"
                  placeholderTextColor={theme.color.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={styles.label}>Username</Text>
                <TextInput
                  testID="login-username"
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="your_username"
                  placeholderTextColor={theme.color.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.label}>Password</Text>
                <View style={styles.pwRow}>
                  <TextInput
                    testID="login-password"
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    placeholder="••••••••"
                    placeholderTextColor={theme.color.muted}
                    autoCapitalize="none"
                  />
                  <Pressable testID="login-toggle-pw" onPress={() => setShowPw(v => !v)} style={styles.pwToggle}>
                    <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={theme.color.onSurfaceTertiary} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.label}>M3U playlist URL</Text>
                <TextInput
                  testID="login-m3u"
                  style={styles.input}
                  value={m3uUrl}
                  onChangeText={setM3uUrl}
                  placeholder="https://.../playlist.m3u8"
                  placeholderTextColor={theme.color.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Pressable testID="login-use-demo" onPress={useDemo} style={styles.demoLink}>
                  <Ionicons name="flash" size={14} color={theme.color.brandPrimary} />
                  <Text style={styles.demoText}>Use the public IPTV-ORG demo playlist</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.rememberRow}>
              <Switch
                testID="login-remember"
                value={remember}
                onValueChange={setRemember}
                trackColor={{ true: theme.color.brandPrimary, false: theme.color.borderStrong }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.rememberLabel}>Remember me on this device</Text>
            </View>

            {error ? (
              <View style={styles.errorBox} testID="login-error">
                <Ionicons name="alert-circle" size={16} color={theme.color.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <Pressable
          testID="login-submit"
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9 }, submitting && { opacity: 0.7 }]}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <Text style={styles.submitText}>Sign in</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function TabButton({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  hero: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing["2xl"], paddingTop: theme.spacing["2xl"] },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  brand: { color: "#FFFFFF", fontSize: 36, fontWeight: "700", letterSpacing: -1 },
  tagline: { color: "rgba(255,255,255,0.9)", fontSize: theme.font.size.lg, marginTop: theme.spacing.sm },
  card: { backgroundColor: theme.color.surfaceSecondary, marginHorizontal: theme.spacing.lg, marginTop: -theme.spacing["2xl"], padding: theme.spacing.xl, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border },
  tabRow: { flexDirection: "row", backgroundColor: theme.color.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, marginBottom: theme.spacing.md },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center" },
  tabBtnActive: { backgroundColor: theme.color.brand },
  tabText: { color: theme.color.muted, fontSize: theme.font.size.base, fontWeight: "500" },
  tabTextActive: { color: "#FFFFFF" },
  label: { color: theme.color.onSurface, fontWeight: "500", fontSize: theme.font.size.base, marginBottom: 6, marginTop: theme.spacing.md },
  input: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.size.lg, color: theme.color.onSurface },
  pwRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  pwToggle: { padding: theme.spacing.md, backgroundColor: theme.color.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  rememberLabel: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.size.base },
  demoLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: theme.spacing.sm },
  demoText: { color: theme.color.brandPrimary, fontSize: theme.font.size.sm, fontWeight: "500" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: theme.spacing.md, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: theme.radius.md, padding: theme.spacing.md },
  errorText: { color: theme.color.error, fontSize: theme.font.size.base, flex: 1 },
  stickyCta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, backgroundColor: theme.color.surface, borderTopWidth: 1, borderTopColor: theme.color.border },
  submitBtn: { backgroundColor: theme.color.brand, borderRadius: theme.radius.md, paddingVertical: theme.spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  submitText: { color: "#FFFFFF", fontSize: theme.font.size.lg, fontWeight: "600" },
});
