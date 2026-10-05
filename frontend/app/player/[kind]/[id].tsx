import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { buildStreamUrl } from "@/src/iptv";
import { favorites } from "@/src/favorites";

type Params = { kind: "live" | "movie" | "series"; id: string; title?: string; icon?: string; url?: string; container?: string };

export default function PlayerScreen() {
  const p = useLocalSearchParams<Params>();
  const kind = (p.kind || "live") as Params["kind"];
  const id = String(p.id || "");
  const title = String(p.title || "Now playing");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [fav, setFav] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    if (p.url) return String(p.url);
    if (!session) return "";
    if (session.mode === "xtream") {
      return buildStreamUrl(session.creds, kind, id, p.container as string | undefined);
    }
    const n = Number(id);
    const ch = session.channels[n];
    return ch?.direct_url || "";
  }, [session, kind, id, p.url, p.container]);

  const player = useVideoPlayer(url || undefined, (pl) => {
    pl.loop = false;
    pl.play();
  });

  useEffect(() => {
    favorites.has(kind, id).then(setFav);
    if (Platform.OS !== "web") {
      ScreenOrientation.unlockAsync().catch(() => {});
    }
    return () => {
      if (Platform.OS !== "web") {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, [kind, id]);

  const toggleFav = async () => {
    const now = await favorites.toggle({ kind, id, name: title, icon: p.icon as string | undefined });
    setFav(now);
  };

  if (!url) {
    return (
      <View style={styles.root}>
        <View style={styles.center}><Text style={styles.errorText}>No stream URL</Text></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="contain"
        allowsFullscreen
        nativeControls
      />

      {/* Top overlay */}
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.sm }]} pointerEvents="box-none">
        <Pressable testID="player-back" onPress={() => router.back()} style={styles.circleBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          <Text style={styles.subText}>{kind.toUpperCase()}</Text>
        </View>
        <Pressable testID="player-fav" onPress={toggleFav} style={styles.circleBtn}>
          <Ionicons name={fav ? "heart" : "heart-outline"} size={22} color={fav ? theme.color.error : "#FFFFFF"} />
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning" size={18} color={theme.color.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  topBar: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, backgroundColor: "rgba(0,0,0,0.45)" },
  titleWrap: { flex: 1 },
  titleText: { color: "#FFFFFF", fontSize: theme.font.size.lg, fontWeight: "600" },
  subText: { color: "rgba(255,255,255,0.65)", fontSize: theme.font.size.sm, marginTop: 2 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  errorBox: { position: "absolute", bottom: 40, left: 20, right: 20, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, backgroundColor: "rgba(0,0,0,0.7)", padding: theme.spacing.md, borderRadius: theme.radius.md },
  errorText: { color: "#FFFFFF", fontSize: theme.font.size.base },
});
