import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView,
  Platform, Modal, FlatList, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/theme";
import { apiSendWhatsappMessage, apiGetSettings } from "@/src/api";

type Msg = { id: string; sender: "user" | "bot"; text: string; payload?: any; created_at: string };
type MenuItem = { id: string; name: string; description: string; price: number; category: string; image_url: string };

export default function SimulatorScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [customerName, setCustomerName] = useState("Aarav");
  const [customerPhone, setCustomerPhone] = useState("+91 98765 43210");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [currency, setCurrency] = useState("₹");

  useEffect(() => { (async () => {
    try { const s: any = await apiGetSettings(); setRestaurantName(s.restaurant_name); setCurrency(s.currency_symbol || "₹"); } catch {}
  })(); }, []);

  const send = async (message: string) => {
    if (!message.trim() || sending) return;
    const tempId = "u-" + Date.now();
    setMessages(prev => [...prev, { id: tempId, sender: "user", text: message, created_at: new Date().toISOString() }]);
    setInput("");
    setSending(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const resp: any = await apiSendWhatsappMessage({
        session_id: sessionId, customer_name: customerName, customer_phone: customerPhone, message,
      });
      setSessionId(resp.session_id);
      setMessages(prev => [...prev, ...resp.replies]);
      // If bot delivered menu, populate menu items for the sheet
      const menuReply = resp.replies.find((r: Msg) => r.payload?.type === "menu_list");
      if (menuReply) setMenuItems(menuReply.payload.items);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: "err-" + Date.now(), sender: "bot", text: "⚠️ " + (e.message || "Something went wrong"), created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const resetChat = () => {
    setSessionId(undefined); setMessages([]); setMenuItems([]);
  };

  const showQuickActions = messages.length === 0;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <View style={styles.avatar}>
          <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} testID="simulator-header-name">{restaurantName}</Text>
          <Text style={styles.headerSub}>WhatsApp Business • online</Text>
        </View>
        <Pressable testID="simulator-reset" onPress={resetChat} style={styles.headerBtn}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Chat area */}
      <View style={styles.chatArea}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: theme.spacing.sm }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          testID="simulator-chat-scroll"
        >
          {showQuickActions && (
            <View style={styles.emptyState}>
              <View style={styles.emptyBubble}>
                <Text style={styles.emptyBubbleText}>👋 Send &quot;Hi&quot; to start ordering</Text>
              </View>
              <View style={styles.customerBox}>
                <Text style={styles.customerLabel}>Simulating customer</Text>
                <TextInput style={styles.customerInput} value={customerName} onChangeText={setCustomerName} placeholder="Name" placeholderTextColor={theme.color.muted} testID="simulator-name-input" />
                <TextInput style={styles.customerInput} value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone" placeholderTextColor={theme.color.muted} keyboardType="phone-pad" testID="simulator-phone-input" />
              </View>
              <Pressable testID="simulator-quick-hi" onPress={() => send("Hi")} style={styles.quickBtn}>
                <Text style={styles.quickBtnText}>Send &quot;Hi&quot; 👋</Text>
              </Pressable>
            </View>
          )}

          {messages.map(m => (
            <MessageBubble
              key={m.id}
              message={m}
              currency={currency}
              onOpenMenu={() => setShowMenuSheet(true)}
              onQuickReply={(text) => send(text)}
            />
          ))}
          {sending && (
            <View style={[styles.bubble, styles.bubbleIn]} testID="simulator-typing">
              <ActivityIndicator size="small" color={theme.color.info} />
            </View>
          )}
        </ScrollView>
      </View>

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.inputBar, { paddingBottom: theme.spacing.sm }]}>
          <TextInput
            testID="simulator-input"
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message…"
            placeholderTextColor={theme.color.muted}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable testID="simulator-send" onPress={() => send(input)} style={styles.sendBtn} disabled={sending}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Menu Bottom Sheet Modal */}
      <Modal visible={showMenuSheet} transparent animationType="slide" onRequestClose={() => setShowMenuSheet(false)}>
        <View style={styles.sheetRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMenuSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Menu • {restaurantName}</Text>
            <Text style={styles.sheetSub}>Tap an item to add to your order</Text>
            <FlatList
              data={menuItems}
              keyExtractor={i => i.id}
              contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.color.border }} />}
              renderItem={({ item }) => (
                <Pressable
                  testID={`sheet-item-${item.id}`}
                  onPress={() => { setShowMenuSheet(false); send(`add:${item.id}`); }}
                  style={styles.sheetRow}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.sheetThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.sheetThumb, { backgroundColor: theme.color.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
                      <Ionicons name="restaurant-outline" size={20} color={theme.color.info} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetItemName}>{item.name}</Text>
                    <Text style={styles.sheetItemDesc} numberOfLines={1}>{item.description || item.category}</Text>
                  </View>
                  <Text style={styles.sheetItemPrice}>{currency}{item.price.toFixed(2)}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MessageBubble({ message, currency, onOpenMenu, onQuickReply }: {
  message: Msg; currency: string; onOpenMenu: () => void; onQuickReply: (text: string) => void;
}) {
  const isUser = message.sender === "user";
  const payload = message.payload || {};

  return (
    <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
      <View style={[styles.bubble, isUser ? styles.bubbleOut : styles.bubbleIn]}>
        <Text style={styles.bubbleText}>{formatWaText(message.text)}</Text>

        {payload.type === "menu_list" && (
          <Pressable testID="msg-open-menu" onPress={onOpenMenu} style={styles.interactiveBtn}>
            <Ionicons name="list" size={16} color={theme.color.chatHeader} />
            <Text style={styles.interactiveBtnText}>View menu</Text>
          </Pressable>
        )}

        {payload.type === "cart_update" && (
          <View style={styles.quickRow}>
            <Pressable testID="msg-quick-checkout" onPress={() => onQuickReply("checkout")} style={styles.quickChip}>
              <Text style={styles.quickChipText}>Checkout ({currency}{payload.total?.toFixed(2)})</Text>
            </Pressable>
            <Pressable testID="msg-quick-more" onPress={onOpenMenu} style={styles.quickChip}>
              <Text style={styles.quickChipText}>Add more</Text>
            </Pressable>
          </View>
        )}

        {payload.type === "checkout" && (
          <View style={styles.quickRow}>
            <Pressable testID="msg-quick-yes" onPress={() => onQuickReply("yes")} style={[styles.quickChip, { backgroundColor: theme.color.success }]}>
              <Text style={[styles.quickChipText, { color: "#FFFFFF" }]}>Confirm order</Text>
            </Pressable>
            <Pressable testID="msg-quick-cancel" onPress={() => onQuickReply("cancel")} style={styles.quickChip}>
              <Text style={styles.quickChipText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {payload.type === "receipt" && (
          <View style={styles.receiptCard}>
            <Text style={styles.receiptTitle}>Order Receipt</Text>
            <Text style={styles.receiptId}>#{(payload.order?.id || "").slice(0, 8).toUpperCase()}</Text>
            {(payload.order?.items || []).map((it: any) => (
              <View key={it.menu_item_id} style={styles.receiptRow}>
                <Text style={styles.receiptRowText}>{it.quantity}× {it.name}</Text>
                <Text style={styles.receiptRowText}>{currency}{(it.price * it.quantity).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.receiptRowText}>Subtotal</Text>
              <Text style={styles.receiptRowText}>{currency}{payload.order?.subtotal?.toFixed(2)}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptRowText}>Tax</Text>
              <Text style={styles.receiptRowText}>{currency}{payload.order?.tax?.toFixed(2)}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptTotal}>Total</Text>
              <Text style={styles.receiptTotal}>{currency}{payload.order?.total?.toFixed(2)}</Text>
            </View>
            <Text style={styles.receiptFooter}>Sent to owner: {payload.restaurant_phone || "—"}</Text>
          </View>
        )}
      </View>
      <Text style={styles.timeStamp}>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
    </View>
  );
}

// Convert WhatsApp *bold* markup into styled text (simple replace with unicode markers)
function formatWaText(s: string) { return s.replace(/\*(.+?)\*/g, "$1"); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.chatBg },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, backgroundColor: theme.color.chatHeader, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  avatar: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: theme.color.chatHeaderText, fontSize: theme.font.size.lg, fontWeight: "500" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: theme.font.size.sm },
  headerBtn: { padding: theme.spacing.sm, borderRadius: theme.radius.pill },
  chatArea: { flex: 1 },
  emptyState: { alignItems: "center", paddingTop: theme.spacing["2xl"], gap: theme.spacing.md },
  emptyBubble: { backgroundColor: "#FFF5CC", paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md },
  emptyBubbleText: { fontSize: theme.font.size.base, color: theme.color.onSurface },
  customerBox: { backgroundColor: theme.color.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, width: "90%", gap: theme.spacing.sm },
  customerLabel: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, fontWeight: "500" },
  customerInput: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, fontSize: theme.font.size.base, color: theme.color.onSurface },
  quickBtn: { backgroundColor: theme.color.chatHeader, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.pill },
  quickBtnText: { color: "#FFFFFF", fontSize: theme.font.size.lg, fontWeight: "500" },
  bubble: { maxWidth: "82%", padding: theme.spacing.md, borderRadius: theme.radius.md, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  bubbleIn: { backgroundColor: theme.color.chatBubbleIn, borderTopLeftRadius: 4 },
  bubbleOut: { backgroundColor: theme.color.chatBubbleOut, borderTopRightRadius: 4 },
  bubbleText: { fontSize: theme.font.size.base, color: theme.color.onSurface, lineHeight: 20 },
  timeStamp: { fontSize: 10, color: theme.color.info, marginTop: 2, marginHorizontal: theme.spacing.xs },
  interactiveBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.color.border, paddingTop: theme.spacing.sm, justifyContent: "center" },
  interactiveBtnText: { color: theme.color.chatHeader, fontSize: theme.font.size.base, fontWeight: "500" },
  quickRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexWrap: "wrap" },
  quickChip: { backgroundColor: theme.color.surfaceTertiary, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  quickChipText: { fontSize: theme.font.size.sm, color: theme.color.onSurface, fontWeight: "500" },
  receiptCard: { marginTop: theme.spacing.sm, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  receiptTitle: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  receiptId: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginBottom: theme.spacing.sm },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  receiptRowText: { fontSize: theme.font.size.base, color: theme.color.onSurface },
  receiptDivider: { height: 1, backgroundColor: theme.color.border, marginVertical: theme.spacing.sm },
  receiptTotal: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.brand },
  receiptFooter: { marginTop: theme.spacing.sm, fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, fontStyle: "italic" },
  inputBar: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.color.chatBg, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
  textInput: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, fontSize: theme.font.size.base, color: theme.color.onSurface },
  sendBtn: { width: 44, height: 44, borderRadius: theme.radius.pill, backgroundColor: theme.color.chatHeader, alignItems: "center", justifyContent: "center" },
  sheetRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.color.surface, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, maxHeight: "80%", padding: theme.spacing.lg },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, backgroundColor: theme.color.borderStrong, borderRadius: theme.radius.pill, marginBottom: theme.spacing.md },
  sheetTitle: { fontSize: theme.font.size.xl, fontWeight: "500", color: theme.color.onSurface },
  sheetSub: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginBottom: theme.spacing.md },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.md },
  sheetThumb: { width: 48, height: 48, borderRadius: theme.radius.sm },
  sheetItemName: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.onSurface },
  sheetItemDesc: { fontSize: theme.font.size.sm, color: theme.color.onSurfaceTertiary, marginTop: 2 },
  sheetItemPrice: { fontSize: theme.font.size.lg, fontWeight: "500", color: theme.color.brand },
});
