import React from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

const TASK_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:     { bg: "#fffbeb", text: "#b45309" },
  in_progress: { bg: "#eff6ff", text: "#1d4ed8" },
  completed:   { bg: "#f0fdf4", text: "#15803d" },
};

export default function AdminFieldOpsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["field-ops-tasks"], queryFn: () => adminApi.getTasks({}) });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  if (isLoading) return <Spinner fullScreen />;
  const tasks = data?.tasks ?? data ?? [];

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Field Ops Tasks</Text>
      <FlatList
        data={tasks}
        keyExtractor={(t: any) => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: task }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
              <Badge label={task.status} color={TASK_STATUS_COLORS[task.status]} />
            </View>
            <Text style={styles.meta}>Type: {task.task_type} • Assigned: {task.assigned_to_name ?? "Unassigned"}</Text>
            <Text style={styles.meta}>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No field ops tasks.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: "#f8fafc" },
  title:     { fontSize: 20, fontWeight: "700", color: "#111827", padding: 16 },
  card:      { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  taskTitle: { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  meta:      { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  empty:     { textAlign: "center", color: "#6b7280", padding: 24 },
});
