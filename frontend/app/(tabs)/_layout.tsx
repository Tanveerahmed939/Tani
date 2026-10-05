import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth-context";

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [session, loading, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brandPrimary,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarStyle: {
          backgroundColor: "rgba(5,5,5,0.92)",
          borderTopColor: theme.color.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="live" options={{ title: "Live TV", tabBarIcon: ({ color, size }) => <Ionicons name="tv" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="movies" options={{ title: "Movies", tabBarIcon: ({ color, size }) => <Ionicons name="film" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="series" options={{ title: "Series", tabBarIcon: ({ color, size }) => <Ionicons name="videocam" size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size ?? 22} color={color} /> }} />
    </Tabs>
  );
}
