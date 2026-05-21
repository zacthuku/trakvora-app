import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { ownerApi } from "@/api/owner";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";
import { useAuthStore } from "@/store/authStore";

export default function OwnerDashboard() {
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();
  const { data: trucks, isLoading, refetch } = useQuery({ queryKey: ["owner-trucks"], queryFn: () => ownerApi.getMyTrucks() });
  const { data: bids } = useQuery({ queryKey: ["owner-bids"], queryFn: ownerApi.getMyBids });
  const { data: wallet } = useQuery({ queryKey: ["owner-wallet"], queryFn: ownerApi.getWallet });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  if (isLoading) return <Spinner fullScreen />;

  const activeBids = bids?.filter((b: any) => b.status === "pending")?.length ?? 0;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Fleet Overview</Text>
        <Text style={styles.sub}>Hello, {user?.name?.split(" ")[0]}</Text>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{trucks?.length ?? 0}</Text>
          <Text style={styles.kpiLabel}>Trucks</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{activeBids}</Text>
          <Text style={styles.kpiLabel}>Active Bids</Text>
        </View>
        <TouchableOpacity style={[styles.kpiCard, { backgroundColor: "#0f766e" }]} onPress={() => navigation.navigate("Wallet")}>
          <Text style={[styles.kpiValue, { color: "#fff" }]}>{formatKES(wallet?.balance ?? 0)}</Text>
          <Text style={[styles.kpiLabel, { color: "#ccfbf1" }]}>Wallet</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Fleet")}>
          <Text style={styles.actionBtnText}>🚛 Manage Fleet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Marketplace")}>
          <Text style={styles.actionBtnText}>📦 Browse Loads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("FleetMap")}>
          <Text style={styles.actionBtnText}>🗺 Fleet Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Drivers")}>
          <Text style={styles.actionBtnText}>👥 Drivers</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#f8fafc" },
  header:       { padding: 20, paddingTop: 56 },
  greeting:     { fontSize: 24, fontWeight: "700", color: "#111827" },
  sub:          { fontSize: 14, color: "#6b7280", marginTop: 4 },
  kpiRow:       { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  kpiCard:      { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  kpiValue:     { fontSize: 20, fontWeight: "700", color: "#111827" },
  kpiLabel:     { fontSize: 11, color: "#6b7280", marginTop: 4 },
  actions:      { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20 },
  actionBtn:    { width: "47%", backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  actionBtnText:{ fontSize: 14, fontWeight: "600", color: "#374151" },
});
