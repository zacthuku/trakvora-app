import React from "react";
import { View, Text, ScrollView, StyleSheet, Switch, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driverApi } from "@/api/driver";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";
import { useAuthStore } from "@/store/authStore";

const AVAILABILITY_OPTS = [
  { value: "available", label: "Available", color: "#15803d" },
  { value: "on_job",    label: "On Job",    color: "#0f766e" },
  { value: "offline",   label: "Offline",   color: "#6b7280" },
];

export default function DriverDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["driver-profile"],
    queryFn: driverApi.getProfile,
  });
  const { data: wallet } = useQuery({ queryKey: ["driver-wallet"], queryFn: driverApi.getWallet });
  const { data: activeShipment } = useQuery({ queryKey: ["active-shipment"], queryFn: driverApi.getActiveShipment });
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const availMut = useMutation({
    mutationFn: (status: string) => driverApi.updateAvailability({ availability_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-profile"] }),
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0]}</Text>
        <Badge
          label={profile?.availability_status ?? "offline"}
          color={AVAILABILITY_OPTS.find(o => o.value === profile?.availability_status)
            ? { bg: "#f0fdf4", text: AVAILABILITY_OPTS.find(o => o.value === profile?.availability_status)!.color }
            : undefined}
        />
      </View>

      {/* Availability toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Availability</Text>
        <View style={styles.availRow}>
          {AVAILABILITY_OPTS.map((opt) => (
            <View key={opt.value} style={styles.availItem}>
              <Switch
                value={profile?.availability_status === opt.value}
                onValueChange={() => availMut.mutate(opt.value)}
                trackColor={{ true: opt.color }}
              />
              <Text style={styles.availLabel}>{opt.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{formatKES(wallet?.balance ?? 0)}</Text>
          <Text style={styles.kpiLabel}>Balance</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{profile?.total_trips ?? 0}</Text>
          <Text style={styles.kpiLabel}>Total Trips</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{profile?.rating ? `${profile.rating.toFixed(1)}⭐` : "N/A"}</Text>
          <Text style={styles.kpiLabel}>Rating</Text>
        </View>
      </View>

      {activeShipment && (
        <View style={[styles.section, styles.activeCard]}>
          <Text style={styles.sectionTitle}>Active Shipment</Text>
          <Text style={styles.activeRoute}>{activeShipment.pickup_location} → {activeShipment.dropoff_location}</Text>
          <Badge status={activeShipment.status} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#f8fafc" },
  header:       { padding: 20, paddingTop: 56, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting:     { fontSize: 22, fontWeight: "700", color: "#111827" },
  section:      { backgroundColor: "#fff", margin: 16, marginBottom: 0, borderRadius: 12, padding: 16 },
  activeCard:   { borderLeftWidth: 3, borderLeftColor: "#0f766e" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 12 },
  availRow:     { flexDirection: "row", justifyContent: "space-around" },
  availItem:    { alignItems: "center", gap: 4 },
  availLabel:   { fontSize: 12, color: "#374151" },
  kpiRow:       { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 0 },
  kpiCard:      { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, alignItems: "center" },
  kpiValue:     { fontSize: 16, fontWeight: "700", color: "#111827" },
  kpiLabel:     { fontSize: 11, color: "#6b7280", marginTop: 2 },
  activeRoute:  { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 8 },
});
