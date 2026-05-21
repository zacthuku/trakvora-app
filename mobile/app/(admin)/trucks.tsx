import React from "react";
import { View, FlatList, Text, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminTrucksScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-trucks"], queryFn: () => adminApi.getTrucks({}) });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  if (isLoading) return <Spinner fullScreen />;
  const trucks = data?.trucks ?? data ?? [];

  return (
    <View style={styles.screen}>
      <FlatList
        data={trucks}
        keyExtractor={(t: any) => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: truck }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.reg}>{truck.registration_number}</Text>
              <Badge label={truck.is_active ? "Active" : "Inactive"} color={truck.is_active ? { bg: "#f0fdf4", text: "#15803d" } : { bg: "#f1f5f9", text: "#6b7280" }} />
            </View>
            <Text style={styles.meta}>{truck.truck_type} • {truck.capacity_tons} tons • Owner: {truck.owner_name ?? "—"}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No trucks.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  card:   { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reg:    { fontSize: 16, fontWeight: "700", color: "#111827" },
  meta:   { fontSize: 12, color: "#6b7280" },
  empty:  { textAlign: "center", color: "#6b7280", padding: 24 },
});
