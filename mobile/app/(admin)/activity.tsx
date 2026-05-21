import React from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminActivityScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["activity-log"], queryFn: () => adminApi.getActivityLog({}) });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  if (isLoading) return <Spinner fullScreen />;
  const logs = data?.logs ?? data ?? [];

  return (
    <View style={styles.screen}>
      <FlatList
        data={logs}
        keyExtractor={(l: any) => String(l.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: log }) => (
          <View style={styles.card}>
            <Text style={styles.action}>{log.action}</Text>
            <Text style={styles.meta}>By: {log.actor_name ?? "System"} • {new Date(log.created_at).toLocaleString()}</Text>
            {log.details && <Text style={styles.details} numberOfLines={2}>{typeof log.details === "string" ? log.details : JSON.stringify(log.details)}</Text>}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No activity logs.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#f8fafc" },
  card:    { backgroundColor: "#fff", borderRadius: 10, padding: 12 },
  action:  { fontSize: 14, fontWeight: "600", color: "#111827" },
  meta:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  details: { fontSize: 12, color: "#374151", marginTop: 4, fontFamily: "monospace" },
  empty:   { textAlign: "center", color: "#6b7280", padding: 24 },
});
