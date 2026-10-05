import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { Category, Channel, buildStreamUrl, xtream } from "@/src/iptv";
import { parental } from "@/src/parental";
import { favorites } from "@/src/favorites";

type LockState = Record<string, boolean>; // category_id -> locked?

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locks, setLocks] = useState<LockState>({});
  const [pinSet, setPinSet] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null); setLoading(true);
    try {
      setPinSet(await parental.isPinSet());
      if (session.mode === "xtream") {
        const [c, s] = await Promise.all([xtream.liveCategories(session.creds), xtream.liveStreams(session.creds)]);
        setCats(c || []);
        setChannels(s || []);
        const next: LockState = {};
        for (const cat of c || []) next[String(cat.category_id)] = await parental.isCategoryLocked(cat.category_id, cat.category_name);
        setLocks(next);
      } else {
        // Build pseudo-categories from M3U groups
        const grouped = new Map<string, string>();
        session.channels.forEach(ch => grouped.set(String(ch.category_id), String(ch.category_id)));
        const cats: Category[] = Array.from(grouped.values()).map(name => ({ category_id: name, category_name: name }));
        setCats(cats);
        setChannels(session.channels as any);
        const next: LockState = {};
        for (const cat of cats) next[cat.category_id] = await parental.isCategoryLocked(cat.category_id, cat.category_name);
        setLocks(next);
      }
    } catch (e: any) { setError(e?.message || "Failed to load channels"); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (selected === "all") return channels;
    return channels.filter(c => String(c.category_id) === selected);
  }, [channels, selected]);

  const handleCategorySelect = async (id: string, name?: string) => {
    if (id !== "all") {
      const locked = locks[id];
      if (locked && !(await parental.isSessionUnlocked())) {
        router.push({ pathname: "/parental-unlock", params: { back: "/(tabs)/live" } });
        return;
      }
    }
    setSelected(id);
  };

  const openChannel = (c: Channel) => {
    router.push({
      pathname: "/player/[kind]/[id]",
      params: {
        kind: "live",
        id: String(c.stream_id),
        title: c.name,
        icon: c.stream_icon || "",
        url: (c as any).direct_url || "",
      },
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.title}>Live TV</Text>
        <Text style={styles.subtitle}>{channels.length} channels</Text>
      </View>

      {/* Category chip row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All" active={selected === "all"} onPress={() => handleCategorySelect("all")} testID="chip-all" />
        {cats.map(cat => (
          <Chip
            key={cat.category_id}
            label={cat.category_name}
            active={selected === String(cat.category_id)}
            locked={!!locks[String(cat.category_id)]}
            onPress={() => handleCategorySelect(String(cat.category_id), cat.category_name)}
            testID={`chip-${cat.category_id}`}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={theme.color.brandPrimary} style={{ marginTop: 60 }} testID="live-loading" />
      ) : error ? (
        <View style={styles.errorBox} testID="live-error">
          <Ionicons name="alert-circle" size={22} color={theme.color.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.stream_id)}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] + 60 }}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>No channels in this category.</Text></View>}
          renderItem={({ item, index }) => (
            <Pressable testID={`channel-${item.stream_id}`} onPress={() => openChannel(item)} style={styles.row}>
              <View style={styles.num}><Text style={styles.numText}>{item.num ?? index + 1}</Text></View>
              {item.stream_icon ? (
                <Image source={{ uri: item.stream_icon }} style={styles.logo} contentFit="contain" />
              ) : (
                <View style={[styles.logo, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="tv" size={22} color={theme.color.muted} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.chName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.chCat}>Tap to play</Text>
              </View>
              <Ionicons name="play-circle" size={28} color={theme.color.brandPrimary} />
            </Pressable>
          )}
        />
      )}
    </View>
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
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.size.sm, fontWeight: "500", maxWidth: 140 },
  chipTextActive: { color: "#FFFFFF" },

  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  num: { width: 36, alignItems: "center" },
  numText: { color: theme.color.muted, fontSize: theme.font.size.sm, fontWeight: "500" },
  logo: { width: 46, height: 46, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceTertiary },
  chName: { color: theme.color.onSurface, fontSize: theme.font.size.lg, fontWeight: "500" },
  chCat: { color: theme.color.muted, fontSize: theme.font.size.sm, marginTop: 2 },

  emptyBox: { paddingVertical: theme.spacing["3xl"], alignItems: "center" },
  emptyText: { color: theme.color.muted, fontSize: theme.font.size.base },

  errorBox: { padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.sm },
  errorText: { color: theme.color.error, fontSize: theme.font.size.base, textAlign: "center" },
  retryBtn: { marginTop: theme.spacing.md, backgroundColor: theme.color.brand, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md },
  retryText: { color: "#FFFFFF", fontSize: theme.font.size.base, fontWeight: "600" },
});
