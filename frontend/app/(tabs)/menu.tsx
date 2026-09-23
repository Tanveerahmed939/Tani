import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Modal,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Switch, Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { apiCreateMenu, apiDeleteMenu, apiListMenu, apiUpdateMenu, apiGetSettings } from "@/src/api";

type MenuItem = {
  id: string; name: string; description: string; price: number;
  category: string; image_url: string; available: boolean;
};

const CATEGORIES = ["Burgers", "Pizza", "Salads", "Sides", "Drinks", "Desserts", "Main"];

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [currency, setCurrency] = useState("₹");
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, s]: any = await Promise.all([apiListMenu(), apiGetSettings().catch(() => ({ currency_symbol: "₹" }))]);
      setItems(m);
      setCurrency(s.currency_symbol || "₹");
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleAvailable = async (item: MenuItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i));
    try { await apiUpdateMenu(item.id, { available: !item.available }); }
    catch { load(); }
  };

  const remove = (item: MenuItem) => {
    const doDelete = async () => {
      try { await apiDeleteMenu(item.id); setItems(prev => prev.filter(i => i.id !== item.id)); } catch {}
    };
    if (Platform.OS === "web") { if (window.confirm(`Delete "${item.name}"?`)) doDelete(); }
    else Alert.alert("Delete item", `Delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: doDelete }
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <View>
          <Text style={styles.title}>Menu</Text>
          <Text style={styles.subtitle}>{items.length} item{items.length === 1 ? "" : "s"} • {items.filter(i => i.available).length} available</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] + 80, gap: theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="menu-empty">
            <Ionicons name="fast-food-outline" size={48} color={theme.color.info} />
            <Text style={styles.emptyTitle}>Your menu is empty</Text>
            <Text style={styles.emptyText}>Tap &quot;Add item&quot; to create your first dish.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, !item.available && { opacity: 0.6 }]} testID={`menu-item-${item.id}`}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: theme.color.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="restaurant-outline" size={28} color={theme.color.info} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.category}</Text>
              <Text style={styles.itemPrice}>{currency}{item.price.toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: theme.spacing.sm }}>
              <Switch
                testID={`menu-toggle-${item.id}`}
                value={item.available}
                onValueChange={() => toggleAvailable(item)}
                trackColor={{ true: theme.color.brand, false: theme.color.borderStrong }}
                thumbColor="#FFFFFF"
              />
              <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
                <Pressable testID={`menu-edit-${item.id}`} onPress={() => { setEditing(item); setModalOpen(true); }} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={16} color={theme.color.onSurfaceTertiary} />
                </Pressable>
                <Pressable testID={`menu-delete-${item.id}`} onPress={() => remove(item)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={16} color={theme.color.error} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <Pressable
        testID="menu-add-fab"
        onPress={() => { setEditing(null); setModalOpen(true); }}
        style={[styles.fab, { bottom: insets.bottom + theme.spacing.lg }]}
      >
        <Ionicons name="add" size={26} color={theme.color.onBrand} />
        <Text style={styles.fabText}>Add item</Text>
      </Pressable>

      <MenuFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={async () => { setModalOpen(false); await load(); }}
      />
    </View>
  );
}

function MenuFormModal({ open, initial, onClose, onSaved }: {
  open: boolean; initial: MenuItem | null; onClose: () => void; onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [price, setPrice] = useState(""); const [category, setCategory] = useState("Main");
  const [imageUrl, setImageUrl] = useState(""); const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name || ""); setDescription(initial?.description || "");
      setPrice(initial ? String(initial.price) : ""); setCategory(initial?.category || "Main");
      setImageUrl(initial?.image_url || ""); setAvailable(initial?.available ?? true);
      setError(null);
    }
  }, [open, initial]);

  const submit = async () => {
    const p = parseFloat(price);
    if (!name.trim() || isNaN(p) || p < 0) { setError("Provide a valid name and price"); return; }
    setSaving(true); setError(null);
    try {
      const body = { name: name.trim(), description, price: p, category, image_url: imageUrl.trim(), available };
      if (initial) await apiUpdateMenu(initial.id, body);
      else await apiCreateMenu(body);
      onSaved();
    } catch (e: any) { setError(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing["2xl"] }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{initial ? "Edit item" : "Add item"}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput testID="menu-form-name" style={styles.input} value={name} onChangeText={setName} placeholder="Cheeseburger" placeholderTextColor={theme.color.muted} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={description} onChangeText={setDescription} multiline placeholder="Short description" placeholderTextColor={theme.color.muted} />

            <Text style={styles.label}>Price</Text>
            <TextInput testID="menu-form-price" style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="249" placeholderTextColor={theme.color.muted} />

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
              {CATEGORIES.map(c => (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" placeholderTextColor={theme.color.muted} autoCapitalize="none" />

            <View style={styles.availableRow}>
              <Text style={styles.label}>Available for orders</Text>
              <Switch value={available} onValueChange={setAvailable} trackColor={{ true: theme.color.brand, false: theme.color.borderStrong }} thumbColor="#FFFFFF" />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable testID="menu-form-save" onPress={submit} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.border, backgroundColor: theme.color.surface },
  title: { fontSize: theme.font.size["2xl"], fontWeight: "500", color: theme.color.onSurface },
  subtitle: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: theme.spacing["3xl"], gap: theme.spacing.sm },
  emptyTitle: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  emptyText: { fontSize: theme.font.size.base, color: theme.color.onSurfaceTertiary },
  row: { flexDirection: "row", gap: theme.spacing.md, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  thumb: { width: 60, height: 60, borderRadius: theme.radius.md },
  itemName: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  itemMeta: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  itemPrice: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.brand, marginTop: theme.spacing.xs },
  iconBtn: { padding: 6, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceTertiary },
  fab: { position: "absolute", right: theme.spacing.lg, backgroundColor: theme.color.brand, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.pill, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  fabText: { color: theme.color.onBrand, fontSize: theme.font.size.base, fontWeight: "500" },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalScrim: { ...StyleSheet.absoluteFillObject },
  modalSheet: { backgroundColor: theme.color.surface, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, maxHeight: "90%" },
  modalHandle: { alignSelf: "center", width: 40, height: 4, backgroundColor: theme.color.borderStrong, borderRadius: theme.radius.pill, marginTop: theme.spacing.sm },
  modalTitle: { fontSize: theme.font.size["2xl"], fontWeight: "500", color: theme.color.onSurface, marginBottom: theme.spacing.md },
  label: { fontSize: theme.font.size.base, color: theme.color.onSurface, fontWeight: "500", marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  input: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.size.lg, color: theme.color.onSurface },
  chip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, height: 36, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceTertiary, fontSize: theme.font.size.base, fontWeight: "500" },
  chipTextActive: { color: theme.color.onBrand },
  availableRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.spacing.md },
  errorText: { color: theme.color.error, marginTop: theme.spacing.md, fontSize: theme.font.size.base },
  saveBtn: { marginTop: theme.spacing.lg, backgroundColor: theme.color.brand, borderRadius: theme.radius.md, paddingVertical: theme.spacing.lg, alignItems: "center" },
  saveBtnText: { color: theme.color.onBrand, fontSize: theme.font.size.lg, fontWeight: "500" },
});
