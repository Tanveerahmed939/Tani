import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { Channel, VodItem, SeriesItem, xtream } from "@/src/iptv";

type Row = { kind: "live" | "movie" | "series"; id: number; name: string; icon?: string };

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [q, setQ] = useState("");
  const [live, setLive] = useState<Channel[]>([]);
  const [vod, setVod] = useState<VodItem[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    if (!session) { setLoading(false); return; }
    try {
      if (session.mode === "xtream") {
        const [a, b, c] = await Promise.all([
          xtream.liveStreams(session.creds),
          xtream.vodStreams(session.creds),
          xtream.seriesList(session.creds),
        ]);
        setLive(a || []); setVod(b || []); setSeries(c || []);
      } else {
        setLive(session.channels as any);
      }
    } catch {} finally { setLoading(false); }
  })(); }, [session]);

  const results: Row[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const match = (name: string) => name.toLowerCase().includes(term);
    const l: Row[] = live.filter(x => match(x.name)).slice(0, 20).map(x => ({ kind: "live", id: x.stream_id, name: x.name, icon: x.stream_icon }));
    const v: Row[] = vod.filter(x => match(x.name)).slice(0, 20).map(x => ({ kind: "movie", id: x.stream_id, name: x.name, icon: x.stream_icon }));
    const s: Row[] = series.filter(x => match(x.name)).slice(0, 20).map(x => ({ kind: "series", id: x.series_id, name: x.name, icon: x.cover }));
    return [...l, ...v, ...s];
  }, [q, live, vod, series]);

  const open = (r: Row) => {
    if (r.kind === "live") router.push({ pathname: "/player/[kind]/[id]", params: { kind: "live", id: String(r.id), title: r.name, icon: r.icon || "" } });
    else router.push({ pathname: "/vod/[kind]/[id]", params: { kind: r.kind, id: String(r.id) } });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="search-back"><Ionicons name="chevron-back" size={24} color={theme.color.onSurface} /></Pressable>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={theme.color.muted} />
          <TextInput
            testID="search-input"
            autoFocus
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="Search channels, movies, series…"
            placeholderTextColor={theme.color.muted}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ("")} testID="search-clear"><Ionicons name="close-circle" size={18} color={theme.color.muted} /></Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.color.brandPrimary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={r => `${r.kind}-${r.id}`}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={44} color={theme.color.muted} />
              <Text style={styles.emptyText}>{q ? "No matches." : "Start typing to search."}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable testID={`search-row-${item.kind}-${item.id}`} onPress={() => open(item)} style={styles.row}>
              {item.icon ? <Image source={{ uri: item.icon }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="play-circle" size={22} color={theme.color.muted} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.color.border },
  input: { flex: 1, color: theme.color.onSurface, fontSize: theme.font.size.base, paddingVertical: 4 },
  empty: { alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing["3xl"] },
  emptyText: { color: theme.color.muted, fontSize: theme.font.size.base },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  thumb: { width: 56, height: 42, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceTertiary },
  name: { color: theme.color.onSurface, fontSize: theme.font.size.base, fontWeight: "500" },
  kind: { color: theme.color.muted, fontSize: theme.font.size.sm, marginTop: 2 },
});
