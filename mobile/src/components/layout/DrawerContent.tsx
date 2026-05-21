import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import { useAuthStore } from "@/store/authStore";

const ADMIN_ROLE_SECTIONS: Record<string, string[]> = {
  super_admin:         ["AdminDashboard", "Users", "Loads", "Shipments", "Trucks", "Compliance", "AdminFleetMap", "FieldOps", "IoT", "ActivityLog", "AdminSettings"],
  operations_admin:    ["AdminDashboard", "Loads", "Shipments", "Trucks", "AdminFleetMap"],
  finance_admin:       ["AdminDashboard", "Shipments"],
  field_inspector:     ["AdminDashboard", "FieldOps", "AdminFleetMap"],
  iot_technician:      ["AdminDashboard", "IoT", "AdminFleetMap"],
  compliance_officer:  ["AdminDashboard", "Compliance", "Users"],
  support_agent:       ["AdminDashboard", "Users"],
};

export default function DrawerContent(props: any) {
  const { user, clearAuth } = useAuthStore();
  const adminRole = user?.admin_role ?? "support_agent";
  const allowed = ADMIN_ROLE_SECTIONS[adminRole] ?? ADMIN_ROLE_SECTIONS.support_agent;

  // Filter routes to only those allowed for this admin role
  const filteredState = {
    ...props.state,
    routes: props.state.routes.filter((r: any) => allowed.includes(r.name)),
  };

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.header}>
        <Text style={styles.name}>{user?.name ?? "Admin"}</Text>
        <Text style={styles.role}>{adminRole.replace(/_/g, " ")}</Text>
      </View>

      <DrawerItemList {...props} state={filteredState} />

      <View style={styles.footer}>
        <TouchableOpacity onPress={clearAuth} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  header:      { padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginBottom: 8 },
  name:        { fontSize: 16, fontWeight: "700", color: "#111827" },
  role:        { fontSize: 13, color: "#6b7280", marginTop: 2, textTransform: "capitalize" },
  footer:      { padding: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  logoutBtn:   { padding: 10, alignItems: "center", backgroundColor: "#fef2f2", borderRadius: 8 },
  logoutText:  { color: "#dc2626", fontWeight: "600" },
});
