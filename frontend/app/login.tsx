import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/src/auth-context";
import { theme } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1707328835878-5492802ae561?w=1200&q=80";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("owner@restaurant.com");
  const [password, setPassword] = useState("owner12345");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await login(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(28,27,26,0.1)", "rgba(28,27,26,0.6)", theme.color.surface]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.heroContent, { paddingTop: insets.top + theme.spacing.xl }]}>
              <View style={styles.badge}>
                <Ionicons name="logo-whatsapp" size={16} color={theme.color.onBrand} />
                <Text style={styles.badgeText}>WhatsApp POS</Text>
              </View>
              <Text style={styles.brandTitle}>WhatsOrder</Text>
              <Text style={styles.brandSub}>Manage restaurant orders that arrive via WhatsApp — from one tidy console.</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formHint}>Enter your owner credentials to continue</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="owner@restaurant.test"
              placeholderTextColor={theme.color.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                testID="login-password-input"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="••••••••"
                placeholderTextColor={theme.color.muted}
                autoCapitalize="none"
              />
              <Pressable testID="login-toggle-password" onPress={() => setShowPw(v => !v)} style={styles.pwToggle}>
                <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={theme.color.onSurfaceTertiary} />
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorBox} testID="login-error">
                <Ionicons name="alert-circle" size={16} color={theme.color.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.demoHint}>
              <Ionicons name="information-circle-outline" size={14} color={theme.color.info} />
              <Text style={styles.demoHintText}>Demo: owner@restaurant.com / owner12345</Text>
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>New restaurant?</Text>
              <Link href="/signup" asChild>
                <Pressable testID="login-goto-signup">
                  <Text style={styles.signupLink}>Create an account</Text>
                </Pressable>
              </Link>
            </View>
          </View>

          <View style={{ flex: 1 }} />
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <Pressable
          testID="login-submit-button"
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, submitting && { opacity: 0.7 }]}
        >
          {submitting ? (
            <ActivityIndicator color={theme.color.onBrand} />
          ) : (
            <>
              <Text style={styles.submitText}>Sign in</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.color.onBrand} />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  hero: { height: 320, position: "relative" },
  heroContent: { flex: 1, justifyContent: "flex-end", paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  badge: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    backgroundColor: theme.color.brand, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill, gap: 6, marginBottom: theme.spacing.md,
  },
  badgeText: { color: theme.color.onBrand, fontSize: theme.font.size.sm, fontWeight: "500" },
  brandTitle: { color: "#FFFFFF", fontSize: 40, fontWeight: "500", letterSpacing: -0.5 },
  brandSub: { color: "rgba(255,255,255,0.92)", fontSize: theme.font.size.lg, marginTop: theme.spacing.xs, lineHeight: 22 },

  formCard: {
    backgroundColor: theme.color.surfaceSecondary,
    marginHorizontal: theme.spacing.lg,
    marginTop: -theme.spacing["2xl"],
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  formTitle: { fontSize: theme.font.size["2xl"], fontWeight: "500", color: theme.color.onSurface },
  formHint: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.base, marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
  label: { color: theme.color.onSurface, fontWeight: "500", fontSize: theme.font.size.base, marginBottom: theme.spacing.xs, marginTop: theme.spacing.md },
  input: {
    backgroundColor: theme.color.surface,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md,
    fontSize: theme.font.size.lg, color: theme.color.onSurface,
    marginBottom: theme.spacing.xs,
  },
  pwRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  pwToggle: { padding: theme.spacing.md, backgroundColor: theme.color.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: theme.spacing.md, backgroundColor: "#FCEEEC", padding: theme.spacing.md, borderRadius: theme.radius.md },
  errorText: { color: theme.color.error, fontSize: theme.font.size.base, flex: 1 },
  demoHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: theme.spacing.md },
  demoHintText: { color: theme.color.info, fontSize: theme.font.size.sm },
  signupRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: theme.spacing.lg, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.color.border },
  signupText: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.base },
  signupLink: { color: theme.color.brand, fontSize: theme.font.size.base, fontWeight: "500" },

  stickyCta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, backgroundColor: theme.color.surface, borderTopWidth: 1, borderTopColor: theme.color.border },
  submitBtn: { backgroundColor: theme.color.brand, borderRadius: theme.radius.md, paddingVertical: theme.spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  submitText: { color: theme.color.onBrand, fontSize: theme.font.size.lg, fontWeight: "500" },
});
