import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { apiGetSettings, apiUpdateSettings } from "@/src/api";
import { useAuth } from "@/src/auth-context";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s: any = await apiGetSettings();
      setRestaurantName(s.restaurant_name);
      setPhone(s.restaurant_phone);
      setTaxRate(String(s.tax_rate ?? 0.05));
      setCurrency(s.currency_symbol || "₹");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setSavedMsg(null);
    try {
      const body = {
        restaurant_name: restaurantName,
        restaurant_phone: phone,
        tax_rate: parseFloat(taxRate) || 0,
        currency_symbol: currency,
      };
      await apiUpdateSettings(body);
      setSavedMsg("Settings saved");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e: any) {
      setSavedMsg("Failed to save");
    } finally { setSaving(false); }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable testID="profile-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.title}>Restaurant settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.color.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 140 }} testID="profile-scroll">
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Ionicons name="person" size={28} color={theme.color.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>

          <Pressable
            testID="profile-open-whatsapp-settings"
            onPress={() => router.push("/whatsapp-settings")}
            style={styles.waCard}
          >
            <View style={styles.waIcon}>
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.waTitle}>WhatsApp Business integration</Text>
              <Text style={styles.waSub}>Connect Meta Cloud API, auto-send order receipts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.color.onSurfaceTertiary} />
          </Pressable>

          <Text style={styles.section}>Restaurant</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput testID="profile-restaurant-name" style={styles.input} value={restaurantName} onChangeText={setRestaurantName} placeholder="Your restaurant name" placeholderTextColor={theme.color.muted} />

          <Text style={styles.label}>WhatsApp Business number</Text>
          <TextInput testID="profile-phone" style={styles.input} value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" placeholderTextColor={theme.color.muted} keyboardType="phone-pad" />
          <Text style={styles.hint}>Customers see this as your restaurant contact; order receipts are addressed to this number.</Text>

          <Text style={styles.label}>Tax rate (0.05 = 5%)</Text>
          <TextInput testID="profile-tax" style={styles.input} value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" placeholder="0.05" placeholderTextColor={theme.color.muted} />

          <Text style={styles.label}>Currency symbol</Text>
          <TextInput testID="profile-currency" style={styles.input} value={currency} onChangeText={setCurrency} placeholder="₹" placeholderTextColor={theme.color.muted} maxLength={3} />

          {savedMsg && <Text style={styles.savedMsg}>{savedMsg}</Text>}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Pressable testID="profile-logout" onPress={onLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={theme.color.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <Pressable testID="profile-save" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  userCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border, marginBottom: theme.spacing.lg },
  userAvatar: { width: 52, height: 52, borderRadius: theme.radius.pill, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  userName: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  userEmail: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  waCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border, marginBottom: theme.spacing.lg },
  waIcon: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" },
  waTitle: { fontSize: theme.font.size.base, fontWeight: "500", color: theme.color.onSurface },
  waSub: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  section: { fontSize: theme.font.size.sm, fontWeight: "500", color: theme.color.onSurfaceTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: theme.spacing.sm },
  label: { fontSize: theme.font.size.base, color: theme.color.onSurface, fontWeight: "500", marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  input: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.size.lg, color: theme.color.onSurface },
  hint: { fontSize: theme.font.size.sm, color: theme.color.info, marginTop: theme.spacing.xs },
  savedMsg: { textAlign: "center", marginTop: theme.spacing.md, color: theme.color.success, fontSize: theme.font.size.base, fontWeight: "500" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.color.border },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.borderStrong },
  logoutText: { color: theme.color.error, fontSize: theme.font.size.base, fontWeight: "500" },
  saveBtn: { flex: 1, backgroundColor: theme.color.brand, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" },
  saveText: { color: theme.color.onBrand, fontSize: theme.font.size.lg, fontWeight: "500" },
});
