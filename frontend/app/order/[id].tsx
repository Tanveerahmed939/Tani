import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/theme";
import { apiGetOrder, apiUpdateOrderStatus, apiGetSettings } from "@/src/api";
import { StatusBadge } from "../(tabs)/dashboard";

const FLOW: Record<string, { next: string | null; label: string }> = {
  pending: { next: "accepted", label: "Accept order" },
  accepted: { next: "preparing", label: "Start preparing" },
  preparing: { next: "ready", label: "Mark as ready" },
  ready: { next: "delivered", label: "Mark delivered" },
  delivered: { next: null, label: "Order completed" },
  cancelled: { next: null, label: "Cancelled" },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any | null>(null);
  const [currency, setCurrency] = useState("₹");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, s]: any = await Promise.all([apiGetOrder(String(id)), apiGetSettings()]);
      setOrder(o); setCurrency(s.currency_symbol || "₹");
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const advance = async () => {
    if (!order) return;
    const next = FLOW[order.status]?.next;
    if (!next) return;
    setSaving(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const updated = await apiUpdateOrderStatus(order.id, next);
      setOrder(updated);
    } catch {} finally { setSaving(false); }
  };

  const cancel = async () => {
    setSaving(true);
    try {
      const updated = await apiUpdateOrderStatus(order.id, "cancelled");
      setOrder(updated);
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <View style={styles.loadingRoot}><ActivityIndicator size="large" color={theme.color.brand} /></View>;
  if (!order) return (
    <View style={styles.loadingRoot}><Text>Order not found</Text></View>
  );

  const step = FLOW[order.status];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable testID="order-back" onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 160 + insets.bottom }} testID="order-detail-scroll">
        <View style={styles.customerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{order.customer_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{order.customer_name}</Text>
            <Text style={styles.customerPhone}>{order.customer_phone || "—"}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <View style={styles.receiptCard}>
          <Text style={styles.receiptTitle}>Receipt</Text>
          <Text style={styles.receiptTime}>Placed {new Date(order.created_at).toLocaleString()}</Text>
          <View style={styles.divider} />
          {order.items.map((it: any) => (
            <View key={it.menu_item_id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemQty}>{it.quantity} × {currency}{it.price.toFixed(2)}</Text>
              </View>
              <Text style={styles.itemLineTotal}>{currency}{(it.quantity * it.price).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <SummaryRow label="Subtotal" value={`${currency}${order.subtotal.toFixed(2)}`} />
          <SummaryRow label="Tax" value={`${currency}${order.tax.toFixed(2)}`} />
          <SummaryRow label="Total" value={`${currency}${order.total.toFixed(2)}`} bold />
          <View style={styles.sourceRow}>
            <Ionicons name="logo-whatsapp" size={14} color={theme.color.success} />
            <Text style={styles.sourceText}>Received via WhatsApp</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        {step?.next ? (
          <>
            {order.status === "pending" && (
              <Pressable testID="order-cancel-btn" onPress={cancel} disabled={saving} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Reject</Text>
              </Pressable>
            )}
            <Pressable testID="order-advance-btn" onPress={advance} disabled={saving} style={[styles.advanceBtn, saving && { opacity: 0.7 }]}>
              <Text style={styles.advanceText}>{step.label}</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.color.onBrand} />
            </Pressable>
          </>
        ) : (
          <View style={styles.completedBox}>
            <Ionicons name="checkmark-circle" size={20} color={theme.color.success} />
            <Text style={styles.completedText}>{step?.label}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  customerCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border },
  avatar: { width: 48, height: 48, borderRadius: theme.radius.pill, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.color.brand, fontSize: theme.font.size.xl, fontWeight: "500" },
  customerName: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  customerPhone: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  receiptCard: { marginTop: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border },
  receiptTitle: { fontSize: theme.font.size.xl, fontWeight: "500", color: theme.color.onSurface },
  receiptTime: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.color.border, marginVertical: theme.spacing.md },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.xs },
  itemName: { fontSize: theme.font.size.base, color: theme.color.onSurface, fontWeight: "500" },
  itemQty: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  itemLineTotal: { fontSize: theme.font.size.base, color: theme.color.onSurface, fontWeight: "500" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontSize: theme.font.size.base, color: theme.color.onSurfaceTertiary },
  summaryValue: { fontSize: theme.font.size.base, color: theme.color.onSurface },
  summaryBold: { fontWeight: "500", fontSize: theme.font.size.lg, color: theme.color.brand },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: theme.spacing.md },
  sourceText: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: theme.color.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.color.border, padding: theme.spacing.md, flexDirection: "row", gap: theme.spacing.sm },
  cancelBtn: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.borderStrong, alignItems: "center", justifyContent: "center" },
  cancelText: { color: theme.color.error, fontSize: theme.font.size.base, fontWeight: "500" },
  advanceBtn: { flex: 1, flexDirection: "row", gap: theme.spacing.sm, backgroundColor: theme.color.brand, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" },
  advanceText: { color: theme.color.onBrand, fontSize: theme.font.size.lg, fontWeight: "500" },
  completedBox: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.lg, backgroundColor: theme.color.surfaceTertiary, borderRadius: theme.radius.md },
  completedText: { fontSize: theme.font.size.lg, color: theme.color.onSurfaceTertiary, fontWeight: "500" },
});
