import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";

const ROLE_KPI_KEYS: Record<string, string[]> = {
  super_admin:        ["total_users", "total_loads", "total_shipments", "total_revenue"],
  operations_admin:   ["total_loads", "active_shipments", "total_trucks"],
  finance_admin:      ["total_revenue", "pending_withdrawals", "wallet_balance"],
  field_inspector:    ["pending_tasks", "completed_tasks"],
  iot_technician:     ["active_devices", "open_alerts"],
  compliance_officer: ["pending_kyc", "approved_today"],
  support_agent:      ["open_tickets"],
};

const KPI_LABELS: Record<string, string> = {
  total_users: "Total Users", total_loads: "Total Loads", total_shipments: "Shipments",
  total_revenue: "Revenue (KES)", pending_withdrawals: "Pending Withdrawals",
  total_trucks: "Trucks", active_shipments: "Active Shipments", pending_tasks: "Pending Tasks",
  completed_tasks: "Completed Tasks", active_devices: "Active Devices", open_alerts: "Open Alerts",
  pending_kyc: "Pending KYC", approved_today: "Approved Today", open_tickets: "Open Tickets",
  wallet_balance: "Platform Balance",
};

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const adminRole = user?.admin_role ?? "support_agent";
  const [refreshing, setRefreshing] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: adminApi.getDashboard,
  });

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  const kpiKeys = ROLE_KPI_KEYS[adminRole] ?? ROLE_KPI_KEYS.support_agent;

  if (isLoading) return <Spinner fullScreen />;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.role}>{adminRole.replace(/_/g, " ")}</Text>
      </View>

      <View style={styles.grid}>
        {kpiKeys.map((key) => (
          <View key={key} style={styles.kpiCard}>
            <Text style={styles.kpiValue}>
              {key.includes("revenue") || key.includes("balance")
                ? formatKES(data?.[key] ?? 0)
                : data?.[key] ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>{KPI_LABELS[key] ?? key}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: "#f8fafc" },
  header:   { padding: 20 },
  title:    { fontSize: 22, fontWeight: "700", color: "#111827" },
  role:     { fontSize: 13, color: "#6b7280", marginTop: 2, textTransform: "capitalize" },
  grid:     { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 20 },
  kpiCard:  { width: "47%", backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  kpiValue: { fontSize: 20, fontWeight: "700", color: "#0f766e" },
  kpiLabel: { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
