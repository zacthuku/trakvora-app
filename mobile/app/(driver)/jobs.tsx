import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driverApi } from "@/api/driver";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { formatKES } from "@/utils/currency";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/utils/distance";
import { CARGO_TYPES } from "@/utils/constants";

export default function JobFeedScreen() {
  const qc = useQueryClient();
  const { coords } = useGeolocation();
  const [selectedCargo, setSelectedCargo] = useState("");
  const [bidAmounts, setBidAmounts] = useState<Record<number, string>>({});
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: loads, isLoading, refetch } = useQuery({
    queryKey: ["marketplace", selectedCargo],
    queryFn: () => driverApi.getMarketplace(selectedCargo ? { cargo_type: selectedCargo } : {}),
  });

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const bidMut = useMutation({
    mutationFn: ({ loadId, amount }: { loadId: number; amount: number }) =>
      driverApi.placeBid({ load_id: loadId, amount }),
    onSuccess: () => { Alert.alert("Bid Placed!"); qc.invalidateQueries({ queryKey: ["marketplace"] }); },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.detail ?? "Bid failed"),
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Job Feed</Text>

      {/* Cargo filter */}
      <FlatList
        horizontal
        data={[{ value: "", label: "All" }, ...CARGO_TYPES]}
        keyExtractor={(t) => t.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, selectedCargo === item.value && styles.chipActive]}
            onPress={() => setSelectedCargo(item.value)}
          >
            <Text style={[styles.chipText, selectedCargo === item.value && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
        style={styles.filterList}
      />

      <FlatList
        data={loads ?? []}
        keyExtractor={(l: any) => String(l.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item: load }) => {
          const dist = coords && load.pickup_lat && load.pickup_lng
            ? haversineKm(coords.latitude, coords.longitude, load.pickup_lat, load.pickup_lng)
            : null;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.route} numberOfLines={1}>{load.pickup_location} → {load.dropoff_location}</Text>
                <Badge status={load.status} />
              </View>
              <Text style={styles.meta}>{load.cargo_type} • {load.weight_kg} kg • {load.truck_type}</Text>
              {dist && <Text style={styles.dist}>{dist.toFixed(0)} km from you</Text>}
              <Text style={styles.price}>{formatKES(load.offered_price)}</Text>

              <View style={styles.bidRow}>
                <Input
                  containerStyle={{ flex: 1, marginBottom: 0, marginRight: 8 }}
                  value={bidAmounts[load.id] ?? ""}
                  onChangeText={(v) => setBidAmounts((b) => ({ ...b, [load.id]: v }))}
                  keyboardType="numeric"
                  placeholder="Your bid (KES)"
                />
                <Button
                  size="sm"
                  onPress={() => bidMut.mutate({ loadId: load.id, amount: Number(bidAmounts[load.id]) })}
                  loading={bidMut.isPending}
                  disabled={!bidAmounts[load.id]}
                >
                  Bid
                </Button>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No loads available right now.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: "#f8fafc" },
  title:         { fontSize: 22, fontWeight: "700", color: "#111827", padding: 20, paddingTop: 56, paddingBottom: 8 },
  filterList:    { maxHeight: 44 },
  filterRow:     { paddingHorizontal: 16, gap: 8 },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
  chipActive:    { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  chipText:      { fontSize: 13, color: "#374151" },
  chipTextActive:{ color: "#0f766e", fontWeight: "600" },
  card:          { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:         { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  meta:          { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  dist:          { fontSize: 12, color: "#0f766e", marginBottom: 4 },
  price:         { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 10 },
  bidRow:        { flexDirection: "row", alignItems: "center" },
  empty:         { textAlign: "center", color: "#6b7280", padding: 24 },
});
