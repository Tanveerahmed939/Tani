import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { theme } from "@/src/theme";
import { apiListOrders, apiGetSettings } from "@/src/api";
import { StatusBadge } from "./dashboard";

type Order = { id: string; customer_name: string; customer_phone: string; total: number; status: string; created_at: string; items: any[] };

const ACTIVE = new Set(["pending", "accepted", "preparing", "ready"]);

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [currency, setCurrency] = useState("₹");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, s]: any = await Promise.all([apiListOrders(), apiGetSettings()]);
      setOrders(o);
      setCurrency(s.currency_symbol || "₹");
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = orders.filter(o => tab === "active" ? ACTIVE.has(o.status) : !ACTIVE.has(o.status));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <Text style={styles.title}>Orders</Text>
        <View style={styles.segment}>
          <Pressable
            testID="orders-tab-active"
            onPress={() => setTab("active")}
            style={[styles.segmentBtn, tab === "active" && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, tab === "active" && styles.segmentTextActive]}>Active</Text>
          </Pressable>
          <Pressable
            testID="orders-tab-past"
            onPress={() => setTab("past")}
            style={[styles.segmentBtn, tab === "past" && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, tab === "past" && styles.segmentTextActive]}>Past</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing["3xl"], gap: theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="orders-empty">
            <Ionicons name="restaurant-outline" size={48} color={theme.color.info} />
            <Text style={styles.emptyTitle}>No {tab} orders</Text>
            <Text style={styles.emptyText}>New WhatsApp orders will appear here in real time.</Text>
          </View>
        }
        renderItem={({ item: o }) => (
          <Pressable
            testID={`order-card-${o.id}`}
            onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })}
            style={styles.card}
          >
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{o.customer_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{o.customer_name}</Text>
                <Text style={styles.phone}>{o.customer_phone || "—"}</Text>
              </View>
              <StatusBadge status={o.status} />
            </View>
            <View style={styles.divider} />
            <View style={styles.cardBottom}>
              <Text style={styles.itemsCount}>{o.items.length} item{o.items.length === 1 ? "" : "s"}</Text>
              <Text style={styles.total}>{currency}{o.total.toFixed(2)}</Text>
            </View>
            <Text style={styles.timestamp}>Order #{o.id.slice(0, 8).toUpperCase()} • {new Date(o.created_at).toLocaleString()}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, backgroundColor: theme.color.surface, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title: { fontSize: theme.font.size["2xl"], fontWeight: "500", color: theme.color.onSurface, marginBottom: theme.spacing.md },
  segment: { flexDirection: "row", backgroundColor: theme.color.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, alignSelf: "flex-start" },
  segmentBtn: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  segmentBtnActive: { backgroundColor: theme.color.surfaceSecondary },
  segmentText: { fontSize: theme.font.size.base, color: theme.color.onSurfaceTertiary, fontWeight: "500" },
  segmentTextActive: { color: theme.color.onSurface },
  empty: { alignItems: "center", paddingVertical: theme.spacing["3xl"], gap: theme.spacing.sm },
  emptyTitle: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  emptyText: { fontSize: theme.font.size.base, color: theme.color.onSurfaceTertiary, textAlign: "center", paddingHorizontal: theme.spacing.xl },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border },
  cardTop: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  avatar: { width: 44, height: 44, borderRadius: theme.radius.pill, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.color.brand, fontSize: theme.font.size.lg, fontWeight: "500" },
  name: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  phone: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.color.border, marginVertical: theme.spacing.md },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemsCount: { fontSize: theme.font.size.base, color: theme.color.onSurfaceTertiary },
  total: { fontSize: theme.font.size.xl, fontWeight: "500", color: theme.color.brand },
  timestamp: { fontSize: theme.font.size.sm, color: theme.color.muted, marginTop: theme.spacing.sm },
});
