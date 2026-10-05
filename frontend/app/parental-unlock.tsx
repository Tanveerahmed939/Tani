import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { parental } from "@/src/parental";

export default function ParentalUnlockScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ back?: string }>();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const ok = await parental.verify(pin);
    if (!ok) { setError("Wrong PIN"); return; }
    await parental.markUnlocked();
    if (params.back) router.replace(String(params.back));
    else router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable testID="unlock-back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
      </View>
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={48} color={theme.color.brand} />
        <Text style={styles.title}>Parental lock</Text>
        <Text style={styles.subtitle}>Enter your PIN to unlock this category for 10 minutes.</Text>

        <TextInput
          testID="unlock-pin"
          style={styles.input}
          value={pin}
          onChangeText={t => { setError(null); setPin(t.replace(/\D/g, "").slice(0, 6)); }}
          placeholder="••••"
          placeholderTextColor={theme.color.muted}
          secureTextEntry
          keyboardType="number-pad"
          autoFocus
        />
        {error && <Text style={styles.error} testID="unlock-error">{error}</Text>}
        <Pressable testID="unlock-submit" onPress={submit} style={styles.btn}>
          <Text style={styles.btnText}>Unlock</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.spacing.xl, gap: theme.spacing.md },
  title: { color: theme.color.onSurface, fontSize: theme.font.size["2xl"], fontWeight: "600" },
  subtitle: { color: theme.color.muted, fontSize: theme.font.size.base, textAlign: "center" },
  input: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, width: 180, textAlign: "center", fontSize: 32, letterSpacing: 10, color: theme.color.onSurface, paddingVertical: theme.spacing.md, marginTop: theme.spacing.md },
  error: { color: theme.color.error, fontSize: theme.font.size.base },
  btn: { backgroundColor: theme.color.brand, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing["3xl"], paddingVertical: theme.spacing.lg, marginTop: theme.spacing.md },
  btnText: { color: "#FFFFFF", fontSize: theme.font.size.lg, fontWeight: "600" },
});
