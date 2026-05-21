import React from "react";
import { View, Text, FlatList, StyleSheet, Alert } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shipperApi } from "@/api/shipper";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";
import { Badge } from "@/components/ui/Badge";

export default function BidComparisonScreen() {
  const route = useRoute<any>();
  const { loadId } = route.params ?? {};
  const qc = useQueryClient();

  const { data: bids, isLoading } = useQuery({
    queryKey: ["bids", loadId],
    queryFn: () => shipperApi.getBids(loadId),
    enabled: !!loadId,
  });

  const acceptMut = useMutation({
    mutationFn: (bidId: number) => shipperApi.acceptBid(bidId),
    onSuccess: () => {
      Alert.alert("Bid Accepted!", "A shipment has been created.");
      qc.invalidateQueries({ queryKey: ["shipper-loads"] });
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.detail ?? "Could not accept bid"),
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Bids on Load #{loadId}</Text>
      <FlatList
        data={bids ?? []}
        keyExtractor={(b: any) => String(b.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: bid }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.carrier}>{bid.carrier_name ?? "Carrier"}</Text>
              <Badge status={bid.status} />
            </View>
            <Text style={styles.price}>{formatKES(bid.amount)}</Text>
            {bid.note && <Text style={styles.note}>{bid.note}</Text>}
            <Text style={styles.meta}>Rating: {bid.carrier_rating ?? "N/A"} ⭐</Text>
            {bid.status === "pending" && (
              <Button size="sm" onPress={() => acceptMut.mutate(bid.id)} loading={acceptMut.isPending} style={{ marginTop: 10 }}>
                Accept Bid
              </Button>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bids yet. Carriers will bid shortly.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  title:  { fontSize: 22, fontWeight: "700", color: "#111827", padding: 20, paddingTop: 56 },
  card:   { backgroundColor: "#fff", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  carrier:{ fontSize: 15, fontWeight: "600", color: "#111827" },
  price:  { fontSize: 20, fontWeight: "700", color: "#0f766e", marginBottom: 4 },
  note:   { fontSize: 13, color: "#374151", marginBottom: 4 },
  meta:   { fontSize: 12, color: "#6b7280" },
  empty:  { paddingTop: 48, alignItems: "center" },
  emptyText: { color: "#6b7280" },
});
