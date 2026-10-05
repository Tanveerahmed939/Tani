import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { xtream } from "@/src/iptv";
import { favorites } from "@/src/favorites";

type Params = { kind: "movie" | "series"; id: string };

export default function VodDetailScreen() {
  const p = useLocalSearchParams<Params>();
  const kind = (p.kind || "movie") as Params["kind"];
  const id = Number(p.id || 0);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [seasonKey, setSeasonKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || session.mode !== "xtream") { setLoading(false); return; }
    setError(null); setLoading(true);
    try {
      if (kind === "movie") {
        const info = await xtream.vodInfo(session.creds, id);
        setData(info);
      } else {
        const info = await xtream.seriesInfo(session.creds, id);
        setData(info);
        const seasons = info?.episodes ? Object.keys(info.episodes) : [];
        if (seasons.length) setSeasonKey(seasons[0]);
      }
    } catch (e: any) { setError(e?.message || "Failed to load details"); }
    finally { setLoading(false); }
  }, [session, kind, id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { favorites.has(kind, id).then(setFav); }, [kind, id]);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={theme.color.brandPrimary} /></View>;
  if (error || !data) return (
    <View style={styles.loading}>
      <Text style={{ color: theme.color.muted, marginBottom: theme.spacing.md }}>{error || "Not found"}</Text>
      <Pressable onPress={() => router.back()}><Text style={{ color: theme.color.brandPrimary }}>Go back</Text></Pressable>
    </View>
  );

  const movie = kind === "movie" ? (data?.movie_data || data?.info || data) : null;
  const info = kind === "movie" ? (data?.info || {}) : (data?.info || {});
  const title = movie?.name || info?.name || info?.title || "Untitled";
  const cover = info?.cover_big || info?.movie_image || info?.cover || info?.poster_url || "";
  const year = info?.releasedate?.slice?.(0, 4) || info?.year || "";
  const plot = info?.plot || info?.description || "";
  const rating = info?.rating || info?.rating_kinopoisk || "";
  const genre = info?.genre || "";
  const containerExt = movie?.container_extension || data?.container_extension || "mp4";

  const play = () => {
    if (kind === "movie") {
      router.push({ pathname: "/player/[kind]/[id]", params: { kind: "movie", id: String(id), title, container: containerExt, icon: cover } });
    }
  };

  const playEpisode = (epId: number | string, epName: string, ext?: string) => {
    router.push({ pathname: "/player/[kind]/[id]", params: { kind: "series", id: String(epId), title: epName, container: ext || "mkv", icon: cover } });
  };

  const toggleFav = async () => {
    const now = await favorites.toggle({ kind, id, name: title, icon: cover });
    setFav(now);
  };

  const seasons: Record<string, any[]> = (kind === "series" && data?.episodes) || {};
  const seasonKeys = Object.keys(seasons);
  const episodes = seasonKey ? (seasons[seasonKey] || []) : [];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] }}>
        <View style={styles.heroWrap}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={14} /> : null}
          <LinearGradient colors={["rgba(5,5,5,0.3)", theme.color.surface]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroInner, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable testID="vod-back" onPress={() => router.back()} style={styles.circleBtn}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable testID="vod-fav" onPress={toggleFav} style={styles.circleBtn}>
              <Ionicons name={fav ? "heart" : "heart-outline"} size={22} color={fav ? theme.color.error : "#FFFFFF"} />
            </Pressable>
          </View>
          <View style={styles.posterWrap}>
            {cover ? <Image source={{ uri: cover }} style={styles.poster} contentFit="cover" /> : <View style={styles.poster} />}
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.titleText}>{title}</Text>
          <View style={styles.metaRow}>
            {year ? <Text style={styles.metaChip}>{year}</Text> : null}
            {genre ? <Text style={styles.metaChip} numberOfLines={1}>{genre}</Text> : null}
            {rating ? <View style={styles.ratingPill}><Ionicons name="star" size={12} color={theme.color.warning} /><Text style={styles.ratingText}>{rating}</Text></View> : null}
          </View>

          {kind === "movie" && (
            <Pressable testID="vod-play" onPress={play} style={styles.playBtn}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
              <Text style={styles.playText}>Play movie</Text>
            </Pressable>
          )}

          {plot ? <Text style={styles.plot}>{plot}</Text> : null}

          {kind === "series" && seasonKeys.length > 0 && (
            <View style={{ marginTop: theme.spacing.lg }}>
              <Text style={styles.sectionTitle}>Seasons</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}>
                {seasonKeys.map(k => (
                  <Pressable key={k} onPress={() => setSeasonKey(k)} style={[styles.chip, seasonKey === k && styles.chipActive]}>
                    <Text style={[styles.chipText, seasonKey === k && styles.chipTextActive]}>Season {k}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.sectionTitle}>Episodes</Text>
              {episodes.map((ep: any) => (
                <Pressable
                  key={String(ep.id)}
                  testID={`episode-${ep.id}`}
                  onPress={() => playEpisode(ep.id, `${title} • E${ep.episode_num} ${ep.title || ""}`, ep.container_extension)}
                  style={styles.epRow}
                >
                  <View style={styles.epNum}><Text style={styles.epNumText}>E{ep.episode_num}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.epTitle} numberOfLines={1}>{ep.title || `Episode ${ep.episode_num}`}</Text>
                    {ep.info?.plot ? <Text style={styles.epPlot} numberOfLines={2}>{ep.info.plot}</Text> : null}
                  </View>
                  <Ionicons name="play-circle" size={26} color={theme.color.brandPrimary} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surface },
  heroWrap: { height: 340 },
  heroInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.lg },
  posterWrap: { position: "absolute", left: theme.spacing.lg, bottom: -40, width: 120, height: 180, borderRadius: theme.radius.md, overflow: "hidden", borderWidth: 1, borderColor: theme.color.border },
  poster: { width: "100%", height: "100%", backgroundColor: theme.color.surfaceTertiary },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },

  content: { padding: theme.spacing.lg, paddingTop: 56 },
  titleText: { color: theme.color.onSurface, fontSize: theme.font.size["2xl"], fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexWrap: "wrap" },
  metaChip: { color: theme.color.muted, fontSize: theme.font.size.sm, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radius.sm },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(245,158,11,0.15)", borderWidth: 1, borderColor: theme.color.warning, paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radius.sm },
  ratingText: { color: theme.color.warning, fontSize: theme.font.size.sm, fontWeight: "500" },

  playBtn: { marginTop: theme.spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, backgroundColor: theme.color.brand, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.md },
  playText: { color: "#FFFFFF", fontSize: theme.font.size.lg, fontWeight: "600" },

  plot: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.size.base, lineHeight: 20, marginTop: theme.spacing.lg },
  sectionTitle: { color: theme.color.onSurface, fontSize: theme.font.size.lg, fontWeight: "600", marginTop: theme.spacing.md },

  chip: { height: 34, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: theme.font.size.sm, fontWeight: "500" },
  chipTextActive: { color: "#FFFFFF" },

  epRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, marginTop: theme.spacing.sm },
  epNum: { width: 42, alignItems: "center" },
  epNumText: { color: theme.color.brandPrimary, fontSize: theme.font.size.base, fontWeight: "600" },
  epTitle: { color: theme.color.onSurface, fontSize: theme.font.size.base, fontWeight: "500" },
  epPlot: { color: theme.color.muted, fontSize: theme.font.size.sm, marginTop: 2 },
});
