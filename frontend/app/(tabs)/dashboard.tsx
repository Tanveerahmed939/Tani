import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { apiDashboardStats, apiListOrders, apiGetSettings } from "@/src/api";
import { useAuth } from "@/src/auth-context";

type Stats = { revenue_today: number; orders_today: number; active_orders: number; pending_orders: number; total_orders: number };
type Order = { id: string; customer_name: string; total: number; status: string; created_at: string; items: any[] };

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<{ restaurant_name: string; currency_symbol: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, o, st] = await Promise.all([apiDashboardStats(), apiListOrders(), apiGetSettings()]);
      setStats(s as any);
      setOrders(o as any);
      setSettings(st as any);
    } catch (e) { /* no-op */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const currency = settings?.currency_symbol || "₹";
  const recent = orders.slice(0, 5);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing["2xl"] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
      testID="dashboard-scroll"
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.restaurantName} testID="dashboard-restaurant-name">{settings?.restaurant_name || "Your restaurant"}</Text>
        </View>
        <Pressable testID="dashboard-profile-btn" onPress={() => router.push("/profile")} style={styles.profileBtn}>
          <Ionicons name="person-circle-outline" size={28} color={theme.color.onSurface} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
        <StatCard testID="stat-revenue" label="Revenue today" value={`${currency}${(stats?.revenue_today ?? 0).toFixed(0)}`} icon="cash-outline" tint={theme.color.brand} />
        <StatCard testID="stat-orders-today" label="Orders today" value={`${stats?.orders_today ?? 0}`} icon="receipt-outline" tint={theme.color.brandSecondary} />
        <StatCard testID="stat-pending" label="Pending" value={`${stats?.pending_orders ?? 0}`} icon="time-outline" tint={theme.color.warning} />
        <StatCard testID="stat-active" label="Active" value={`${stats?.active_orders ?? 0}`} icon="flame-outline" tint={theme.color.success} />
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent orders</Text>
        <Pressable onPress={() => router.push("/(tabs)/orders")} testID="dashboard-view-all">
          <Text style={styles.linkText}>View all</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyBox} testID="dashboard-empty">
          <Ionicons name="cafe-outline" size={40} color={theme.color.info} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Open the Simulator tab and send &quot;Hi&quot; to try placing an order.</Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
          {recent.map(o => (
            <Pressable
              key={o.id}
              testID={`recent-order-${o.id}`}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })}
              style={styles.orderRow}
            >
              <View style={styles.orderAvatar}>
                <Text style={styles.orderAvatarText}>{o.customer_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderName}>{o.customer_name}</Text>
                <Text style={styles.orderMeta}>{o.items.length} item{o.items.length === 1 ? "" : "s"} • {currency}{o.total.toFixed(2)}</Text>
              </View>
              <StatusBadge status={o.status} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, icon, tint, testID }: any) {
  return (
    <View style={styles.statCard} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: "#FCEBD6", fg: theme.color.warning, label: "Pending" },
    accepted: { bg: "#E4EEF7", fg: "#2C6EA8", label: "Accepted" },
    preparing: { bg: "#FBE6D7", fg: theme.color.brand, label: "Preparing" },
    ready: { bg: "#DDF3E5", fg: theme.color.success, label: "Ready" },
    delivered: { bg: "#E8E6E1", fg: theme.color.onSurfaceTertiary, label: "Delivered" },
    cancelled: { bg: "#FCEEEC", fg: theme.color.error, label: "Cancelled" },
  };
  const s = map[status] || map.pending;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: theme.spacing.md, paddingVertical: 4, borderRadius: theme.radius.pill }}>
      <Text style={{ color: s.fg, fontSize: theme.font.size.sm, fontWeight: "500" }}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg, flexDirection: "row", alignItems: "center" },
  greeting: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.base },
  restaurantName: { color: theme.color.onSurface, fontSize: theme.font.size["2xl"], fontWeight: "500", marginTop: 2 },
  profileBtn: { padding: theme.spacing.xs },
  statsRow: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, paddingRight: theme.spacing.lg },
  statCard: { width: 150, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border },
  statIcon: { width: 36, height: 36, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center", marginBottom: theme.spacing.md },
  statLabel: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.sm },
  statValue: { color: theme.color.onSurface, fontSize: theme.font.size.xl, fontWeight: "500", marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  sectionTitle: { color: theme.color.onSurface, fontSize: theme.font.size.xl, fontWeight: "500" },
  linkText: { color: theme.color.brand, fontSize: theme.font.size.base, fontWeight: "500" },
  emptyBox: { alignItems: "center", padding: theme.spacing.xl, marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, gap: theme.spacing.sm },
  emptyTitle: { color: theme.color.onSurface, fontSize: theme.font.size.lg, fontWeight: "500" },
  emptyText: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.base, textAlign: "center" },
  orderRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border },
  orderAvatar: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  orderAvatarText: { color: theme.color.brand, fontSize: theme.font.size.lg, fontWeight: "500" },
  orderName: { color: theme.color.onSurface, fontSize: theme.font.size.lg, fontWeight: "500" },
  orderMeta: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.sm, marginTop: 2 },
});
