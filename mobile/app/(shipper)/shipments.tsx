import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { shipperApi } from "@/api/shipper";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";

export default function ShipperShipmentsScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { data: loads, isLoading, refetch } = useQuery({
    queryKey: ["shipper-loads"],
    queryFn: shipperApi.myLoads,
  });
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>My Loads</Text>
      <FlatList
        data={loads ?? []}
        keyExtractor={(l: any) => String(l.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10 }}
        renderItem={({ item: load }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              if (["booked", "en_route_pickup", "loaded", "in_transit"].includes(load.status)) {
                navigation.navigate("Tracking", { loadId: load.id });
              } else if (load.status === "bidding") {
                navigation.navigate("Bids", { loadId: load.id });
              }
            }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.route} numberOfLines={1}>{load.pickup_location} → {load.dropoff_location}</Text>
              <Badge status={load.status} />
            </View>
            <Text style={styles.meta}>{load.cargo_type} • {load.weight_kg} kg</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.price}>{formatKES(load.offered_price)}</Text>
              {load.status === "bidding" && (
                <TouchableOpacity style={styles.bidBtn} onPress={() => navigation.navigate("Bids", { loadId: load.id })}>
                  <Text style={styles.bidBtnText}>View Bids</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No loads yet. Post your first load!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: "#f8fafc" },
  title:      { fontSize: 22, fontWeight: "700", color: "#111827", padding: 20, paddingTop: 56 },
  card:       { backgroundColor: "#fff", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:      { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  meta:       { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price:      { fontSize: 15, fontWeight: "700", color: "#0f766e" },
  bidBtn:     { backgroundColor: "#0f766e", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bidBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  empty:      { paddingTop: 48, alignItems: "center" },
  emptyText:  { color: "#6b7280", fontSize: 14 },
});
