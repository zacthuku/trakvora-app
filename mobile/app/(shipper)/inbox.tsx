import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inboxApi } from "@/api/inbox";
import { Spinner } from "@/components/ui/Spinner";

export default function ShipperInboxScreen() {
  const qc = useQueryClient();
  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => inboxApi.getMessages({}),
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const markReadMut = useMutation({
    mutationFn: (id: number) => inboxApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Inbox</Text>
      <FlatList
        data={messages ?? []}
        keyExtractor={(m: any) => String(m.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: msg }) => (
          <TouchableOpacity
            style={[styles.card, !msg.is_read && styles.cardUnread]}
            onPress={() => !msg.is_read && markReadMut.mutate(msg.id)}
          >
            <View style={styles.row}>
              <Text style={styles.subject} numberOfLines={1}>{msg.subject}</Text>
              {!msg.is_read && <View style={styles.dot} />}
            </View>
            <Text style={styles.body} numberOfLines={2}>{msg.body}</Text>
            <Text style={styles.date}>{new Date(msg.created_at).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#f8fafc" },
  title:       { fontSize: 22, fontWeight: "700", color: "#111827", padding: 20, paddingTop: 56 },
  card:        { backgroundColor: "#fff", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardUnread:  { borderLeftWidth: 3, borderLeftColor: "#0f766e" },
  row:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  subject:     { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0f766e" },
  body:        { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  date:        { fontSize: 12, color: "#9ca3af" },
  empty:       { textAlign: "center", color: "#6b7280", padding: 24 },
});
