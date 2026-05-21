import React from "react";
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ownerApi } from "@/api/owner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";

export default function OwnerBidsScreen() {
  const qc = useQueryClient();
  const { data: bids, isLoading, refetch } = useQuery({ queryKey: ["owner-bids"], queryFn: ownerApi.getMyBids });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const withdrawMut = useMutation({
    mutationFn: (bidId: number) => ownerApi.withdrawBid(bidId),
    onSuccess: () => { Alert.alert("Bid withdrawn."); qc.invalidateQueries({ queryKey: ["owner-bids"] }); },
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>My Bids</Text>
      <FlatList
        data={bids ?? []}
        keyExtractor={(b: any) => String(b.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: bid }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.route} numberOfLines={1}>{bid.pickup_location} → {bid.dropoff_location}</Text>
              <Badge status={bid.status} />
            </View>
            <Text style={styles.amount}>{formatKES(bid.amount)}</Text>
            <Text style={styles.date}>{new Date(bid.created_at).toLocaleDateString()}</Text>
            {bid.status === "pending" && (
              <Button variant="outline" size="sm" onPress={() => withdrawMut.mutate(bid.id)} loading={withdrawMut.isPending} style={{ marginTop: 8 }}>Withdraw Bid</Button>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No bids placed yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  title:  { fontSize: 22, fontWeight: "700", color: "#111827", padding: 20, paddingTop: 56 },
  card:   { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  route:  { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  amount: { fontSize: 18, fontWeight: "700", color: "#0f766e", marginBottom: 4 },
  date:   { fontSize: 12, color: "#6b7280" },
  empty:  { textAlign: "center", color: "#6b7280", padding: 24 },
});
