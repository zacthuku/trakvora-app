import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";

export default function ShipperSettingsScreen() {
  const { user, clearAuth } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0] ?? "U"}</Text>
          </View>
          <View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch value={theme === "dark"} onValueChange={toggleTheme} trackColor={{ true: "#0f766e" }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={clearAuth}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#f8fafc" },
  title:        { fontSize: 22, fontWeight: "700", color: "#111827", padding: 20, paddingTop: 56 },
  section:      { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 12 },
  profileRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center" },
  avatarText:   { color: "#fff", fontSize: 20, fontWeight: "700" },
  name:         { fontSize: 16, fontWeight: "600", color: "#111827" },
  email:        { fontSize: 13, color: "#6b7280" },
  row:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel:     { fontSize: 15, color: "#374151" },
  logoutBtn:    { padding: 12, alignItems: "center", backgroundColor: "#fef2f2", borderRadius: 8 },
  logoutText:   { color: "#dc2626", fontWeight: "700" },
});
