import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

export default function CatchUpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable testID="catchup-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Catch Up</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.body}>
        <Ionicons name="time-outline" size={60} color={theme.color.muted} />
        <Text style={styles.msg}>Catch Up (EPG rewind) will appear here once your Xtream provider has `tv_archive` enabled on channels.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title: { color: theme.color.onSurface, fontSize: theme.font.size.xl, fontWeight: "600" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.xl },
  msg: { color: theme.color.muted, fontSize: theme.font.size.base, textAlign: "center" },
});
