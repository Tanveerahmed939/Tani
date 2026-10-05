import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/src/auth-context";
import { theme } from "@/src/theme";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return (
    <View style={styles.center} testID="app-loading"><ActivityIndicator size="large" color={theme.color.brandPrimary} /></View>
  );
  return <Redirect href={session ? "/(tabs)/home" : "/login"} />;
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surface },
});
