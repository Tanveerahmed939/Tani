import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { favorites, FavItem } from "@/src/favorites";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<FavItem[]>([]);

  useFocusEffect(useCallback(() => { favorites.list().then(setItems); }, []));

  const open = (f: FavItem) => {
    if (f.kind === "live") router.push({ pathname: "/player/[kind]/[id]", params: { kind: "live", id: String(f.id), title: f.name, icon: f.icon || "" } });
    else router.push({ pathname: "/vod/[kind]/[id]", params: { kind: f.kind, id: String(f.id) } });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="fav-back"><Ionicons name="chevron-back" size={24} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Favorites</Text>
        <View style={{ width: 24 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={x => x.key}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="heart-outline" size={44} color={theme.color.muted} /><Text style={styles.emptyText}>No favorites yet.</Text></View>}
        renderItem={({ item }) => (
          <Pressable testID={`fav-item-${item.key}`} onPress={() => open(item)} style={styles.row}>
            {item.icon ? <Image source={{ uri: item.icon }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="play-circle" size={22} color={theme.color.muted} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.border, justifyContent: "space-between" },
  title: { color: theme.color.onSurface, fontSize: theme.font.size.xl, fontWeight: "600" },
  empty: { alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing["3xl"] },
  emptyText: { color: theme.color.muted, fontSize: theme.font.size.base },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  thumb: { width: 64, height: 48, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceTertiary },
  name: { color: theme.color.onSurface, fontSize: theme.font.size.base, fontWeight: "500" },
  kind: { color: theme.color.muted, fontSize: theme.font.size.sm, marginTop: 2 },
});
