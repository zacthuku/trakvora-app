import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useAuthStore } from "@/store/authStore";

export default function AdminSettingsScreen() {
  const { user, clearAuth } = useAuthStore();
  return (
    <ScrollView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.label}>Logged in as</Text>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.meta}>Role: {user?.admin_role?.replace(/_/g, " ")}</Text>
      </View>
      <View style={styles.card}>
        <TouchableOpacity style={styles.logoutBtn} onPress={clearAuth}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: "#f8fafc" },
  card:      { backgroundColor: "#fff", margin: 16, borderRadius: 12, padding: 16 },
  label:     { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8 },
  name:      { fontSize: 16, fontWeight: "600", color: "#111827" },
  meta:      { fontSize: 13, color: "#6b7280", marginTop: 2 },
  logoutBtn: { padding: 12, alignItems: "center", backgroundColor: "#fef2f2", borderRadius: 8 },
  logoutText:{ color: "#dc2626", fontWeight: "700" },
});
