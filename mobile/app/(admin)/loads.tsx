import React from "react";
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";

export default function AdminLoadsScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-loads"], queryFn: () => adminApi.getLoads({}) });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  const cancelMut = useMutation({ mutationFn: (id: number) => adminApi.cancelLoad(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-loads"] }) });

  if (isLoading) return <Spinner fullScreen />;
  const loads = data?.loads ?? data ?? [];

  return (
    <View style={styles.screen}>
      <FlatList
        data={loads}
        keyExtractor={(l: any) => String(l.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: load }) => (
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.route} numberOfLines={1}>{load.pickup_location} → {load.dropoff_location}</Text><Badge status={load.status} /></View>
            <Text style={styles.meta}>{load.cargo_type} • {load.weight_kg} kg • {formatKES(load.offered_price)}</Text>
            <Text style={styles.meta}>Shipper: {load.shipper_name ?? "—"}</Text>
            {!["delivered", "cancelled"].includes(load.status) && (
              <Button size="sm" variant="danger" style={{ marginTop: 8 }} onPress={() => Alert.alert("Cancel Load?", undefined, [{ text: "No" }, { text: "Cancel Load", style: "destructive", onPress: () => cancelMut.mutate(load.id) }])}>Cancel Load</Button>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No loads.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  card:   { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:  { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  meta:   { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  empty:  { textAlign: "center", color: "#6b7280", padding: 24 },
});
