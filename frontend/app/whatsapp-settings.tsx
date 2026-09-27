import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator,
  Switch, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { theme } from "@/src/theme";
import { apiGetSettings, apiUpdateSettings, apiGetWhatsAppSettings } from "@/src/api";

type WA = {
  webhook_url: string;
  verify_token: string;
  whatsapp_enabled: boolean;
  phone_number_id: string;
  owner_whatsapp_number: string;
  access_token_set: boolean;
  app_secret_set: boolean;
};

export default function WhatsAppSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [wa, setWa] = useState<WA | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [ownerNumber, setOwnerNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [maskedToken, setMaskedToken] = useState<string>("");
  const [maskedSecret, setMaskedSecret] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const [s, w]: any = await Promise.all([apiGetSettings(), apiGetWhatsAppSettings()]);
      setWa(w);
      setEnabled(!!w.whatsapp_enabled);
      setOwnerNumber(w.owner_whatsapp_number || "");
      setPhoneNumberId(w.phone_number_id || "");
      setMaskedToken(s.whatsapp_access_token_masked || "");
      setMaskedSecret(s.whatsapp_app_secret_masked || "");
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = async (label: string, val: string) => {
    if (!val) return;
    await Clipboard.setStringAsync(val);
    setSavedMsg(`${label} copied`);
    setTimeout(() => setSavedMsg(null), 1500);
  };

  const save = async () => {
    setSaving(true); setError(null); setSavedMsg(null);
    try {
      const body: any = {
        whatsapp_enabled: enabled,
        owner_whatsapp_number: ownerNumber.trim(),
        whatsapp_phone_number_id: phoneNumberId.trim(),
      };
      if (accessToken.trim()) body.whatsapp_access_token = accessToken.trim();
      if (appSecret.trim()) body.whatsapp_app_secret = appSecret.trim();
      await apiUpdateSettings(body);
      setSavedMsg("WhatsApp settings saved");
      setAccessToken(""); setAppSecret("");
      await load();
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable testID="wa-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>WhatsApp Integration</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.color.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 140 }} testID="wa-scroll">
          {/* Status card */}
          <View style={[styles.statusCard, { backgroundColor: enabled && wa?.access_token_set ? "#DDF3E5" : "#FCEBD6" }]}>
            <Ionicons
              name={enabled && wa?.access_token_set ? "checkmark-circle" : "warning"}
              size={22}
              color={enabled && wa?.access_token_set ? theme.color.success : theme.color.warning}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {enabled && wa?.access_token_set ? "Live on WhatsApp" : "Simulator mode"}
              </Text>
              <Text style={styles.statusText}>
                {enabled && wa?.access_token_set
                  ? "Customer messages will be answered on your WhatsApp number."
                  : "Add your Meta credentials below to go live. Orders still work via the in-app simulator."}
              </Text>
            </View>
          </View>

          {/* Toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>WhatsApp integration enabled</Text>
              <Text style={styles.hint}>Turn off to fall back to the in-app Simulator.</Text>
            </View>
            <Switch
              testID="wa-toggle-enabled"
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: theme.color.success, false: theme.color.borderStrong }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Webhook config */}
          <Text style={styles.section}>Meta webhook configuration</Text>
          <Text style={styles.hint}>Paste both values into Meta → WhatsApp → Configuration.</Text>

          <ReadonlyRow
            label="Callback URL"
            value={wa?.webhook_url || ""}
            testID="wa-webhook-url"
            onCopy={() => copy("Webhook URL", wa?.webhook_url || "")}
          />
          <ReadonlyRow
            label="Verify token (auto-generated)"
            value={wa?.verify_token || "—"}
            testID="wa-verify-token"
            onCopy={() => copy("Verify token", wa?.verify_token || "")}
            hint={wa?.verify_token ? undefined : "Save any WhatsApp field to generate this."}
          />

          {/* Meta credentials */}
          <Text style={styles.section}>Meta credentials</Text>

          <Text style={styles.label}>Phone Number ID</Text>
          <Text style={styles.hint}>From Meta → WhatsApp → API Setup (numeric, not your display number).</Text>
          <TextInput
            testID="wa-phone-id"
            style={styles.input}
            value={phoneNumberId}
            onChangeText={setPhoneNumberId}
            placeholder="123456789012345"
            placeholderTextColor={theme.color.muted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Access Token{maskedToken ? ` (current: ${maskedToken})` : ""}</Text>
          <Text style={styles.hint}>Paste a new token to replace, or leave blank to keep the current one.</Text>
          <TextInput
            testID="wa-access-token"
            style={styles.input}
            value={accessToken}
            onChangeText={setAccessToken}
            placeholder={maskedToken ? "Leave blank to keep" : "EAA…"}
            placeholderTextColor={theme.color.muted}
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.label}>App Secret{maskedSecret ? ` (current: ${maskedSecret})` : ""}</Text>
          <Text style={styles.hint}>Used to verify Meta&apos;s X-Hub-Signature-256 (optional but recommended).</Text>
          <TextInput
            testID="wa-app-secret"
            style={styles.input}
            value={appSecret}
            onChangeText={setAppSecret}
            placeholder={maskedSecret ? "Leave blank to keep" : "Meta App Secret"}
            placeholderTextColor={theme.color.muted}
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.section}>Restaurant WhatsApp</Text>
          <Text style={styles.label}>Owner WhatsApp number</Text>
          <Text style={styles.hint}>Order receipts are auto-sent to this number when a customer confirms an order (international format).</Text>
          <TextInput
            testID="wa-owner-number"
            style={styles.input}
            value={ownerNumber}
            onChangeText={setOwnerNumber}
            placeholder="+15551234567"
            placeholderTextColor={theme.color.muted}
            keyboardType="phone-pad"
          />

          <View style={styles.helpCard}>
            <Ionicons name="information-circle" size={18} color={theme.color.info} />
            <View style={{ flex: 1 }}>
              <Text style={styles.helpTitle}>How to get these credentials</Text>
              <Text style={styles.helpText}>1. Sign up at developers.facebook.com → create an app → add WhatsApp product.</Text>
              <Text style={styles.helpText}>2. In WhatsApp → API Setup: copy the Phone Number ID and a temporary or permanent System User Access Token.</Text>
              <Text style={styles.helpText}>3. In App Settings → Basic: copy the App Secret.</Text>
              <Text style={styles.helpText}>4. In WhatsApp → Configuration: paste the Callback URL and Verify Token shown above, then subscribe to the messages field.</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox} testID="wa-error">
              <Ionicons name="alert-circle" size={16} color={theme.color.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {savedMsg && <Text style={styles.savedMsg} testID="wa-saved">{savedMsg}</Text>}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Pressable
          testID="wa-save"
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        >
          {saving ? <ActivityIndicator color={theme.color.onBrand} /> : (
            <>
              <Ionicons name="save-outline" size={18} color={theme.color.onBrand} />
              <Text style={styles.saveText}>Save WhatsApp settings</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ReadonlyRow({ label, value, testID, onCopy, hint }: { label: string; value: string; testID: string; onCopy: () => void; hint?: string }) {
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readonlyRow}>
        <Text style={styles.readonlyValue} numberOfLines={1} testID={testID}>{value}</Text>
        <Pressable onPress={onCopy} style={styles.copyBtn} testID={`${testID}-copy`}>
          <Ionicons name="copy-outline" size={18} color={theme.color.brand} />
        </Pressable>
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },

  statusCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.lg },
  statusTitle: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  statusText: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },

  section: { fontSize: theme.font.size.sm, fontWeight: "500", color: theme.color.onSurfaceTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm },
  label: { fontSize: theme.font.size.base, color: theme.color.onSurface, fontWeight: "500", marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  hint: { fontSize: theme.font.size.sm, color: theme.color.info, marginTop: 2 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.size.lg, color: theme.color.onSurface, marginTop: theme.spacing.xs },

  readonlyRow: { flexDirection: "row", alignItems: "center", backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, marginTop: theme.spacing.xs, gap: theme.spacing.sm },
  readonlyValue: { flex: 1, color: theme.color.onSurface, fontSize: theme.font.size.base, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  copyBtn: { padding: 6, borderRadius: theme.radius.sm },

  helpCard: { flexDirection: "row", gap: theme.spacing.sm, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: theme.spacing.xl },
  helpTitle: { fontSize: theme.font.size.base, fontWeight: "500", color: theme.color.onSurface, marginBottom: theme.spacing.xs },
  helpText: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2, lineHeight: 18 },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: theme.spacing.md, backgroundColor: "#FCEEEC", padding: theme.spacing.md, borderRadius: theme.radius.md },
  errorText: { color: theme.color.error, fontSize: theme.font.size.base, flex: 1 },
  savedMsg: { textAlign: "center", marginTop: theme.spacing.md, color: theme.color.success, fontSize: theme.font.size.base, fontWeight: "500" },

  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.color.border },
  saveBtn: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.brand, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.md },
  saveText: { color: theme.color.onBrand, fontSize: theme.font.size.lg, fontWeight: "500" },
});
