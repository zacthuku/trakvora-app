import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { shipperApi } from "@/api/shipper";
import { paymentsApi } from "@/api/payments";
import { useAuthStore } from "@/store/authStore";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";

export default function ShipperDashboard() {
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();

  const { data: loads, isLoading: loadsLoading, refetch } = useQuery({
    queryKey: ["shipper-loads"],
    queryFn: shipperApi.myLoads,
  });
  const { data: wallet } = useQuery({
    queryKey: ["shipper-wallet"],
    queryFn: paymentsApi.getWallet,
  });

  const active = loads?.filter((l: any) => !["delivered", "cancelled"].includes(l.status)) ?? [];
  const balance = wallet?.balance ?? 0;
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
        <Text style={styles.sub}>Manage your freight from here</Text>
      </View>

      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{active.length}</Text>
          <Text style={styles.kpiLabel}>Active Loads</Text>
        </View>
        <TouchableOpacity style={[styles.kpiCard, styles.kpiCardAccent]} onPress={() => navigation.navigate("Wallet")}>
          <Text style={[styles.kpiValue, { color: "#fff" }]}>{formatKES(balance)}</Text>
          <Text style={[styles.kpiLabel, { color: "#ccfbf1" }]}>Wallet Balance</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("PostLoad")}>
          <Text style={styles.actionBtnText}>+ Post a Load</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => navigation.navigate("Shipments")}>
          <Text style={[styles.actionBtnText, { color: "#0f766e" }]}>View Shipments</Text>
        </TouchableOpacity>
      </View>

      {/* Recent loads */}
      <Text style={styles.sectionTitle}>Recent Loads</Text>
      {loadsLoading ? (
        <Spinner style={{ marginVertical: 24 }} />
      ) : active.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active loads. Post your first load!</Text>
        </View>
      ) : (
        active.slice(0, 5).map((load: any) => (
          <TouchableOpacity
            key={load.id}
            style={styles.loadCard}
            onPress={() => navigation.navigate("Shipments", { loadId: load.id })}
          >
            <View style={styles.loadCardHeader}>
              <Text style={styles.loadRoute}>{load.pickup_location} → {load.dropoff_location}</Text>
              <Badge status={load.status} />
            </View>
            <Text style={styles.loadMeta}>{load.cargo_type} • {load.weight_kg} kg • {formatKES(load.offered_price)}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: "#f8fafc" },
  header:          { padding: 20, paddingTop: 56 },
  greeting:        { fontSize: 24, fontWeight: "700", color: "#111827" },
  sub:             { fontSize: 14, color: "#6b7280", marginTop: 4 },
  kpiRow:          { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 20 },
  kpiCard:         { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  kpiCardAccent:   { backgroundColor: "#0f766e" },
  kpiValue:        { fontSize: 22, fontWeight: "700", color: "#111827" },
  kpiLabel:        { fontSize: 12, color: "#6b7280", marginTop: 4 },
  actions:         { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  actionBtn:       { flex: 1, backgroundColor: "#0f766e", padding: 13, borderRadius: 10, alignItems: "center" },
  actionBtnOutline:{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#0f766e" },
  actionBtnText:   { fontWeight: "700", color: "#fff", fontSize: 14 },
  sectionTitle:    { fontSize: 16, fontWeight: "700", color: "#111827", paddingHorizontal: 20, marginBottom: 12 },
  loadCard:        { backgroundColor: "#fff", marginHorizontal: 20, marginBottom: 10, borderRadius: 12, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  loadCardHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  loadRoute:       { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  loadMeta:        { fontSize: 12, color: "#6b7280" },
  empty:           { padding: 24, alignItems: "center" },
  emptyText:       { color: "#6b7280", fontSize: 14 },
});
