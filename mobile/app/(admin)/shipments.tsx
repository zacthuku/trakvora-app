import React from "react";
import { View, FlatList, Text, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminShipmentsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-shipments"], queryFn: () => adminApi.getShipments({}) });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  if (isLoading) return <Spinner fullScreen />;
  const shipments = data?.shipments ?? data ?? [];

  return (
    <View style={styles.screen}>
      <FlatList
        data={shipments}
        keyExtractor={(s: any) => String(s.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: s }) => (
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.route} numberOfLines={1}>{s.pickup_location} → {s.dropoff_location}</Text><Badge status={s.status} /></View>
            <Text style={styles.meta}>Driver: {s.driver_name ?? "—"} | Shipper: {s.shipper_name ?? "—"}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No shipments.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  card:   { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:  { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  meta:   { fontSize: 12, color: "#6b7280" },
  empty:  { textAlign: "center", color: "#6b7280", padding: 24 },
});
