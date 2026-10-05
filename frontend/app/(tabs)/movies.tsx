import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { Category, VodItem, xtream } from "@/src/iptv";
import { parental } from "@/src/parental";

const COLUMNS = Math.max(2, Math.min(4, Math.floor(Dimensions.get("window").width / 170)));
const GAP = theme.spacing.md;

export default function MoviesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<VodItem[]>([]);
  const [selected, setSelected] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locks, setLocks] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!session || session.mode !== "xtream") { setLoading(false); return; }
    setError(null); setLoading(true);
    try {
      const [c, s] = await Promise.all([xtream.vodCategories(session.creds), xtream.vodStreams(session.creds)]);
      setCats(c || []);
      setItems(s || []);
      const next: Record<string, boolean> = {};
      for (const cat of c || []) next[String(cat.category_id)] = await parental.isCategoryLocked(cat.category_id, cat.category_name);
      setLocks(next);
    } catch (e: any) { setError(e?.message || "Failed to load movies"); }
    finally { setLoading(false); }
  }, [session]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => selected === "all" ? items : items.filter(i => String(i.category_id) === selected), [items, selected]);

  const pickCategory = async (id: string, name?: string) => {
    if (id !== "all" && locks[id] && !(await parental.isSessionUnlocked())) {
      router.push({ pathname: "/parental-unlock", params: { back: "/(tabs)/movies" } });
      return;
    }
    setSelected(id);
  };

  if (!session || session.mode === "m3u") {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
          <Text style={styles.title}>Movies</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="film-outline" size={44} color={theme.color.muted} />
          <Text style={styles.hint}>Movies are available with Xtream Codes login.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.title}>Movies</Text>
        <Text style={styles.subtitle}>{items.length} titles</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All" active={selected === "all"} onPress={() => pickCategory("all")} testID="movies-chip-all" />
        {cats.map(cat => (
          <Chip key={cat.category_id} label={cat.category_name} active={selected === String(cat.category_id)} locked={!!locks[String(cat.category_id)]}
            onPress={() => pickCategory(String(cat.category_id), cat.category_name)} testID={`movies-chip-${cat.category_id}`} />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={theme.color.brandPrimary} style={{ marginTop: 60 }} testID="movies-loading" />
      ) : error ? (
        <View style={styles.errorBox}><Ionicons name="alert-circle" size={22} color={theme.color.error} /><Text style={styles.errorText}>{error}</Text><Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>Retry</Text></Pressable></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => String(m.stream_id)}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: theme.spacing.lg }}
          contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] + 60, gap: GAP, paddingTop: theme.spacing.sm }}
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>No movies in this category.</Text></View>}
          renderItem={({ item }) => <PosterCard item={item} onPress={() => router.push({ pathname: "/vod/[kind]/[id]", params: { kind: "movie", id: String(item.stream_id) } })} />}
        />
      )}
    </View>
  );
}

export function PosterCard({ item, onPress }: { item: VodItem; onPress: () => void }) {
  const width = (Dimensions.get("window").width - theme.spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  return (
    <Pressable testID={`poster-${item.stream_id}`} onPress={onPress} style={{ width }}>
      {item.stream_icon ? (
        <Image source={{ uri: item.stream_icon }} style={[styles.poster, { width, aspectRatio: 2 / 3 }]} contentFit="cover" />
      ) : (
        <View style={[styles.poster, { width, aspectRatio: 2 / 3, alignItems: "center", justifyContent: "center" }]}>
          <Ionicons name="film" size={32} color={theme.color.muted} />
        </View>
      )}
      <Text style={styles.pName} numberOfLines={2}>{item.name}</Text>
      {item.year && <Text style={styles.pYear}>{item.year}</Text>}
    </Pressable>
  );
}

function Chip({ label, active, onPress, testID, locked }: { label: string; active: boolean; onPress: () => void; testID: string; locked?: boolean }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {locked && <Ionicons name="lock-closed" size={12} color={active ? "#FFFFFF" : theme.color.warning} style={{ marginRight: 4 }} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  title: { color: theme.color.onSurface, fontSize: theme.font.size["2xl"], fontWeight: "600" },
  subtitle: { color: theme.color.muted, fontSize: theme.font.size.sm, marginTop: 2 },

  chipRow: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, flexDirection: "row", alignItems: "center", flexShrink: 0 },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.size.sm, fontWeight: "500", maxWidth: 160 },
  chipTextActive: { color: "#FFFFFF" },

  poster: { borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceTertiary },
  pName: { color: theme.color.onSurface, fontSize: theme.font.size.sm, fontWeight: "500", marginTop: 6 },
  pYear: { color: theme.color.muted, fontSize: theme.font.size.sm, marginTop: 2 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md },
  hint: { color: theme.color.muted, fontSize: theme.font.size.base, textAlign: "center", paddingHorizontal: theme.spacing.xl },

  emptyBox: { paddingVertical: theme.spacing["3xl"], alignItems: "center" },
  emptyText: { color: theme.color.muted, fontSize: theme.font.size.base },

  errorBox: { padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.sm },
  errorText: { color: theme.color.error, fontSize: theme.font.size.base, textAlign: "center" },
  retryBtn: { marginTop: theme.spacing.md, backgroundColor: theme.color.brand, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md },
  retryText: { color: "#FFFFFF", fontSize: theme.font.size.base, fontWeight: "600" },
});
