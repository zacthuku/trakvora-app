import React from "react";
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

export default function AdminComplianceScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["compliance-pending"], queryFn: () => adminApi.getPendingReviews({}) });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const reviewMut = useMutation({
    mutationFn: ({ id, approved, notes }: { id: number; approved: boolean; notes?: string }) =>
      adminApi.submitReview(id, { approved, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance-pending"] }),
  });

  if (isLoading) return <Spinner fullScreen />;
  const reviews = data?.reviews ?? data ?? [];

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Compliance Queue ({reviews.length})</Text>
      <FlatList
        data={reviews}
        keyExtractor={(r: any) => String(r.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item: review }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{review.entity_name ?? review.truck_reg ?? "Unknown"}</Text>
              <Badge label={review.review_type ?? "kyc"} color={{ bg: "#eff6ff", text: "#1d4ed8" }} />
            </View>
            <Text style={styles.meta}>Submitted: {new Date(review.created_at).toLocaleDateString()}</Text>
            <View style={styles.btns}>
              <Button size="sm" style={{ flex: 1, marginRight: 6 }} onPress={() => reviewMut.mutate({ id: review.id, approved: true })}>Approve</Button>
              <Button size="sm" variant="danger" style={{ flex: 1 }} onPress={() => Alert.alert("Reason?", undefined, [
                { text: "Cancel" },
                { text: "Reject", style: "destructive", onPress: () => reviewMut.mutate({ id: review.id, approved: false }) },
              ])}>Reject</Button>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No pending reviews. 🎉</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  title:  { fontSize: 20, fontWeight: "700", color: "#111827", padding: 16 },
  card:   { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  name:   { fontSize: 15, fontWeight: "600", color: "#111827" },
  meta:   { fontSize: 12, color: "#6b7280", marginBottom: 10 },
  btns:   { flexDirection: "row" },
  empty:  { textAlign: "center", color: "#6b7280", padding: 24 },
});
