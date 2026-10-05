import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, FlatList } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { favorites, FavItem } from "@/src/favorites";

const HERO = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&q=80";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [favs, setFavs] = useState<FavItem[]>([]);

  useFocusEffect(useCallback(() => { favorites.list().then(setFavs); }, []));

  const greeting = session?.mode === "xtream"
    ? session.userInfo?.username || "Welcome back"
    : session?.mode === "m3u" ? "M3U Playlist" : "";

  const shortcuts = [
    { key: "live", title: "Live TV", icon: "tv", color: "#EF4444", route: "/(tabs)/live" },
    { key: "movies", title: "Movies", icon: "film", color: theme.color.brandPrimary, route: "/(tabs)/movies" },
    { key: "series", title: "Series", icon: "videocam", color: theme.color.brand, route: "/(tabs)/series" },
    { key: "catchup", title: "Catch Up", icon: "time", color: "#10B981", route: "/catchup" },
    { key: "favorites", title: "Favorites", icon: "heart", color: "#F59E0B", route: "/favorites" },
  ] as const;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] }}
      showsVerticalScrollIndicator={false}
      testID="home-scroll"
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["transparent", "rgba(5,5,5,0.5)", theme.color.surface]} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroInner, { paddingTop: insets.top + theme.spacing.md }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.hello}>Hello,</Text>
              <Text style={styles.name} testID="home-greeting">{greeting}</Text>
            </View>
            <Pressable testID="home-settings" onPress={() => router.push("/(tabs)/settings")} style={styles.iconBtn}>
              <Ionicons name="person-circle" size={30} color="#FFFFFF" />
            </Pressable>
          </View>

          <Pressable
            testID="home-search"
            onPress={() => router.push("/search")}
            style={styles.searchBar}
          >
            <Ionicons name="search" size={18} color={theme.color.muted} />
            <Text style={styles.searchPlaceholder}>Search channels, movies, series…</Text>
          </Pressable>
        </View>
      </View>

      {/* Shortcuts */}
      <Text style={styles.sectionTitle}>Browse</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutRow}>
        {shortcuts.map(s => (
          <Pressable
            key={s.key}
            testID={`home-shortcut-${s.key}`}
            onPress={() => router.push(s.route as any)}
            style={styles.shortcut}
          >
            <LinearGradient colors={[s.color + "33", s.color + "11"]} style={styles.shortcutGrad}>
              <View style={[styles.shortcutIcon, { backgroundColor: s.color + "22", borderColor: s.color }]}>
                <Ionicons name={s.icon as any} size={24} color={s.color} />
              </View>
              <Text style={styles.shortcutText}>{s.title}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>

      {/* Favorites preview */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Favorites</Text>
        {favs.length > 0 && (
          <Pressable onPress={() => router.push("/favorites")} testID="home-favorites-all">
            <Text style={styles.linkText}>View all</Text>
          </Pressable>
        )}
      </View>
      {favs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="heart-outline" size={28} color={theme.color.muted} />
          <Text style={styles.emptyText}>Tap the heart on a channel or movie to save it here.</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={favs.slice(0, 10)}
          keyExtractor={x => x.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (item.kind === "live") router.push({ pathname: "/player/[kind]/[id]", params: { kind: "live", id: String(item.id), title: item.name } });
                else if (item.kind === "movie") router.push({ pathname: "/vod/[kind]/[id]", params: { kind: "movie", id: String(item.id) } });
                else router.push({ pathname: "/vod/[kind]/[id]", params: { kind: "series", id: String(item.id) } });
              }}
              style={styles.favCard}
            >
              {item.icon ? (
                <Image source={{ uri: item.icon }} style={styles.favImage} contentFit="cover" />
              ) : (
                <View style={[styles.favImage, { alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surfaceTertiary }]}>
                  <Ionicons name="play-circle" size={32} color={theme.color.muted} />
                </View>
              )}
              <Text style={styles.favName} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  hero: { height: 260, position: "relative" },
  heroInner: { flex: 1, justifyContent: "flex-end", paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { color: "rgba(255,255,255,0.75)", fontSize: theme.font.size.sm },
  name: { color: "#FFFFFF", fontSize: theme.font.size["2xl"], fontWeight: "600", marginTop: 2 },
  iconBtn: { padding: 4 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, backgroundColor: "rgba(28,28,30,0.9)", borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  searchPlaceholder: { color: theme.color.muted, fontSize: theme.font.size.base, flex: 1 },

  sectionTitle: { color: theme.color.onSurface, fontSize: theme.font.size.xl, fontWeight: "600", marginTop: theme.spacing.xl, marginBottom: theme.spacing.md, marginHorizontal: theme.spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: theme.spacing.xl, marginBottom: theme.spacing.md, marginHorizontal: theme.spacing.lg },
  linkText: { color: theme.color.brandPrimary, fontSize: theme.font.size.base, fontWeight: "500" },

  shortcutRow: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  shortcut: { width: 110, height: 120, borderRadius: theme.radius.lg, overflow: "hidden", borderWidth: 1, borderColor: theme.color.border, flexShrink: 0 },
  shortcutGrad: { flex: 1, padding: theme.spacing.md, justifyContent: "space-between" },
  shortcutIcon: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  shortcutText: { color: "#FFFFFF", fontSize: theme.font.size.base, fontWeight: "600" },

  emptyBox: { alignItems: "center", gap: theme.spacing.sm, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.xl, marginHorizontal: theme.spacing.lg },
  emptyText: { color: theme.color.muted, fontSize: theme.font.size.base, textAlign: "center" },

  favCard: { width: 120 },
  favImage: { width: 120, height: 72, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceTertiary },
  favName: { color: theme.color.onSurface, fontSize: theme.font.size.sm, marginTop: 6 },
});
