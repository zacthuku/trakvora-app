import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ownerApi } from "@/api/owner";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

export default function OwnerDriversScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"team" | "seeking">("team");
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: team, isLoading: loadingTeam, refetch: refetchTeam } = useQuery({ queryKey: ["owner-team"], queryFn: ownerApi.getMyTeam });
  const { data: seeking, isLoading: loadingSeeking } = useQuery({ queryKey: ["seeking-drivers"], queryFn: ownerApi.getSeekingDrivers });

  const onRefresh = async () => { setRefreshing(true); await refetchTeam(); setRefreshing(false); };

  const inviteMut = useMutation({
    mutationFn: (driverId: number) => ownerApi.inviteDriver(driverId),
    onSuccess: () => { Alert.alert("Invitation sent!"); qc.invalidateQueries({ queryKey: ["seeking-drivers"] }); },
  });
  const dismissMut = useMutation({
    mutationFn: (driverId: number) => ownerApi.dismissDriver(driverId),
    onSuccess: () => { Alert.alert("Driver dismissed."); qc.invalidateQueries({ queryKey: ["owner-team"] }); },
  });

  const isLoading = loadingTeam || loadingSeeking;
  if (isLoading) return <Spinner fullScreen />;

  const data = tab === "team" ? team ?? [] : seeking ?? [];

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Drivers</Text>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "team" && styles.tabActive]} onPress={() => setTab("team")}>
          <Text style={[styles.tabText, tab === "team" && styles.tabTextActive]}>My Team ({team?.length ?? 0})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "seeking" && styles.tabActive]} onPress={() => setTab("seeking")}>
          <Text style={[styles.tabText, tab === "seeking" && styles.tabTextActive]}>Seeking ({seeking?.length ?? 0})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(d: any) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: driver }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.name}>{driver.user_name ?? driver.name}</Text>
              <Badge label={driver.verification_status ?? "pending"} color={driver.verification_status === "approved" ? { bg: "#f0fdf4", text: "#15803d" } : undefined} />
            </View>
            <Text style={styles.meta}>⭐ {driver.rating?.toFixed(1) ?? "N/A"} • {driver.total_trips ?? 0} trips</Text>
            {tab === "team" ? (
              <Button variant="danger" size="sm" onPress={() => dismissMut.mutate(driver.id)} loading={dismissMut.isPending} style={{ marginTop: 8 }}>Dismiss</Button>
            ) : (
              <Button size="sm" onPress={() => inviteMut.mutate(driver.id)} loading={inviteMut.isPending} style={{ marginTop: 8 }}>Invite to Team</Button>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{tab === "team" ? "No drivers in your team." : "No drivers seeking work."}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#f8fafc" },
  title:        { fontSize: 22, fontWeight: "700", color: "#111827", padding: 20, paddingTop: 56, paddingBottom: 8 },
  tabs:         { flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab:          { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#d1d5db" },
  tabActive:    { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  tabText:      { fontSize: 13, color: "#6b7280" },
  tabTextActive:{ color: "#0f766e", fontWeight: "700" },
  card:         { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  name:         { fontSize: 15, fontWeight: "600", color: "#111827" },
  meta:         { fontSize: 13, color: "#6b7280" },
  empty:        { textAlign: "center", color: "#6b7280", padding: 24 },
});
