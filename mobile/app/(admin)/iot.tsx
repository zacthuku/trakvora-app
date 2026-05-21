import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminIoTScreen() {
  const [tab, setTab] = useState<"devices" | "alerts">("devices");
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: devices, isLoading: dLoading, refetch: rDevices } = useQuery({ queryKey: ["iot-devices"], queryFn: () => adminApi.getIoTDevices({}) });
  const { data: alerts,  isLoading: aLoading, refetch: rAlerts  } = useQuery({ queryKey: ["iot-alerts"],  queryFn: () => adminApi.getIoTAlerts({})  });

  const onRefresh = async () => {
    setRefreshing(true);
    await (tab === "devices" ? rDevices() : rAlerts());
    setRefreshing(false);
  };

  if (dLoading || aLoading) return <Spinner fullScreen />;
  const deviceList = devices?.devices ?? devices ?? [];
  const alertList  = alerts?.alerts  ?? alerts  ?? [];

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>IoT Management</Text>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "devices" && styles.tabActive]} onPress={() => setTab("devices")}>
          <Text style={[styles.tabText, tab === "devices" && styles.tabTextActive]}>Devices ({deviceList.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "alerts" && styles.tabActive]} onPress={() => setTab("alerts")}>
          <Text style={[styles.tabText, tab === "alerts" && styles.tabTextActive]}>Alerts ({alertList.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tab === "devices" ? deviceList : alertList}
        keyExtractor={(i: any) => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.primary}>{tab === "devices" ? (item.device_id ?? item.imei) : item.alert_type}</Text>
              <Badge
                label={tab === "devices" ? (item.is_active ? "Online" : "Offline") : (item.is_resolved ? "Resolved" : "Open")}
                color={tab === "devices"
                  ? (item.is_active ? { bg: "#f0fdf4", text: "#15803d" } : { bg: "#f1f5f9", text: "#6b7280" })
                  : (item.is_resolved ? { bg: "#f0fdf4", text: "#15803d" } : { bg: "#fef2f2", text: "#dc2626" })}
              />
            </View>
            <Text style={styles.meta}>{tab === "devices" ? `Truck: ${item.truck_reg ?? "—"}` : item.message}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No {tab}.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#f8fafc" },
  title:        { fontSize: 20, fontWeight: "700", color: "#111827", padding: 16, paddingBottom: 8 },
  tabs:         { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tab:          { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#d1d5db" },
  tabActive:    { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  tabText:      { fontSize: 13, color: "#6b7280" },
  tabTextActive:{ color: "#0f766e", fontWeight: "700" },
  card:         { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  primary:      { fontSize: 14, fontWeight: "600", color: "#111827" },
  meta:         { fontSize: 12, color: "#6b7280" },
  empty:        { textAlign: "center", color: "#6b7280", padding: 24 },
});
