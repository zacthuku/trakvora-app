import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useDebounce } from "@/hooks/useDebounce";

export default function AdminUsersScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [refreshing, setRefreshing] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", debouncedSearch],
    queryFn: () => adminApi.getUsers(debouncedSearch ? { q: debouncedSearch } : {}),
  });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const suspendMut = useMutation({
    mutationFn: (id: number) => adminApi.suspendUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.detail ?? "Failed"),
  });
  const reviewKYCMut = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) => adminApi.reviewKYC(id, approved),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  if (isLoading) return <Spinner fullScreen />;

  const users = data?.users ?? data ?? [];

  return (
    <View style={styles.screen}>
      <Input containerStyle={styles.search} value={search} onChangeText={setSearch} placeholder="Search users…" />
      <FlatList
        data={users}
        keyExtractor={(u: any) => String(u.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: user }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{user.name}</Text>
              <Badge label={user.role} color={{ bg: "#eff6ff", text: "#1d4ed8" }} />
            </View>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.badges}>
              <Badge label={user.kyc_status ?? "no kyc"} />
              {user.is_suspended && <Badge label="Suspended" color={{ bg: "#fef2f2", text: "#dc2626" }} />}
            </View>
            <View style={styles.actions}>
              {user.kyc_status === "submitted" && (
                <>
                  <Button size="sm" onPress={() => reviewKYCMut.mutate({ id: user.id, approved: true })} style={{ flex: 1, marginRight: 6 }}>Approve KYC</Button>
                  <Button size="sm" variant="danger" onPress={() => reviewKYCMut.mutate({ id: user.id, approved: false })} style={{ flex: 1 }}>Reject</Button>
                </>
              )}
              {!user.is_suspended && (
                <Button size="sm" variant="outline" onPress={() => Alert.alert("Suspend?", undefined, [
                  { text: "Cancel" },
                  { text: "Suspend", onPress: () => suspendMut.mutate(user.id), style: "destructive" },
                ])} style={{ flex: 1 }}>Suspend</Button>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#f8fafc" },
  search:  { margin: 16, marginBottom: 8 },
  card:    { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  name:    { fontSize: 15, fontWeight: "600", color: "#111827" },
  email:   { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  badges:  { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  actions: { flexDirection: "row" },
  empty:   { textAlign: "center", color: "#6b7280", padding: 24 },
});
