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

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signup } = useAuth();
  const [restaurantName, setRestaurantName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);
    if (!restaurantName.trim()) return setError("Restaurant name is required");
    if (!name.trim()) return setError("Your name is required");
    if (!email.trim()) return setError("Email is required");
    if (password.length < 6) return setError("Password must be at least 6 characters");

    setSubmitting(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signup(email.trim(), password, name.trim(), restaurantName.trim());
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.message || "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(28,27,26,0.1)", "rgba(28,27,26,0.6)", theme.color.surface]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.heroContent, { paddingTop: insets.top + theme.spacing.md }]}>
              <Pressable testID="signup-back" onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Text style={styles.brandTitle}>Get started</Text>
              <Text style={styles.brandSub}>Create your restaurant workspace in under a minute.</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create account</Text>
            <Text style={styles.formHint}>Tell us a bit about your restaurant</Text>

            <Text style={styles.label}>Restaurant name</Text>
            <TextInput
              testID="signup-restaurant-input"
              style={styles.input}
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder="e.g. Sunrise Cafe"
              placeholderTextColor={theme.color.muted}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Your name</Text>
            <TextInput
              testID="signup-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Owner name"
              placeholderTextColor={theme.color.muted}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="signup-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@restaurant.com"
              placeholderTextColor={theme.color.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                testID="signup-password-input"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="At least 6 characters"
                placeholderTextColor={theme.color.muted}
                autoCapitalize="none"
              />
              <Pressable testID="signup-toggle-password" onPress={() => setShowPw(v => !v)} style={styles.pwToggle}>
                <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={theme.color.onSurfaceTertiary} />
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorBox} testID="signup-error">
                <Ionicons name="alert-circle" size={16} color={theme.color.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <Link href="/login" asChild>
                <Pressable testID="signup-goto-login">
                  <Text style={styles.loginLink}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <Pressable
          testID="signup-submit-button"
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, submitting && { opacity: 0.7 }]}
        >
          {submitting ? (
            <ActivityIndicator color={theme.color.onBrand} />
          ) : (
            <>
              <Text style={styles.submitText}>Create account</Text>
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
  hero: { height: 240, position: "relative" },
  heroContent: { flex: 1, paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingVertical: theme.spacing.xs },
  backText: { color: "#FFFFFF", fontSize: theme.font.size.base, fontWeight: "500" },
  brandTitle: { color: "#FFFFFF", fontSize: 34, fontWeight: "500", letterSpacing: -0.5 },
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
  formHint: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.base, marginTop: theme.spacing.xs },
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
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: theme.spacing.lg, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.color.border },
  loginText: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.base },
  loginLink: { color: theme.color.brand, fontSize: theme.font.size.base, fontWeight: "500" },

  stickyCta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, backgroundColor: theme.color.surface, borderTopWidth: 1, borderTopColor: theme.color.border },
  submitBtn: { backgroundColor: theme.color.brand, borderRadius: theme.radius.md, paddingVertical: theme.spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  submitText: { color: theme.color.onBrand, fontSize: theme.font.size.lg, fontWeight: "500" },
});
