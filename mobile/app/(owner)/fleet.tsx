import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, Modal, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ownerApi } from "@/api/owner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { TRUCK_TYPES } from "@/utils/constants";
import { TouchableOpacity } from "react-native";

export default function FleetScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ registration_number: "", truck_type: "dry_van", capacity_tons: "", year: "" });
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: trucks, isLoading, refetch } = useQuery({ queryKey: ["owner-trucks"], queryFn: () => ownerApi.getMyTrucks() });
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const createMut = useMutation({
    mutationFn: () => ownerApi.createTruck({ ...form, capacity_tons: Number(form.capacity_tons), year: Number(form.year) }),
    onSuccess: () => { Alert.alert("Truck added!"); qc.invalidateQueries({ queryKey: ["owner-trucks"] }); setShowModal(false); },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.detail ?? "Could not add truck"),
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Fleet</Text>
        <Button size="sm" onPress={() => setShowModal(true)}>+ Add Truck</Button>
      </View>

      <FlatList
        data={trucks ?? []}
        keyExtractor={(t: any) => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item: truck }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.reg}>{truck.registration_number}</Text>
              <Badge
                label={truck.is_active ? "Active" : "Inactive"}
                color={truck.is_active ? { bg: "#f0fdf4", text: "#15803d" } : { bg: "#f1f5f9", text: "#6b7280" }}
              />
            </View>
            <Text style={styles.meta}>{truck.truck_type} • {truck.capacity_tons} tons • {truck.year}</Text>
            {truck.assigned_driver_name && (
              <Text style={styles.driver}>Driver: {truck.assigned_driver_name}</Text>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No trucks yet. Add your first truck!</Text>}
      />

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Truck</Text>
            <Input label="Registration Number" value={form.registration_number} onChangeText={set("registration_number")} placeholder="e.g. KCB 123A" />
            <Input label="Capacity (tons)" value={form.capacity_tons} onChangeText={set("capacity_tons")} keyboardType="numeric" placeholder="e.g. 30" />
            <Input label="Year" value={form.year} onChangeText={set("year")} keyboardType="numeric" placeholder="e.g. 2019" />
            <View style={styles.modalBtns}>
              <Button variant="outline" onPress={() => setShowModal(false)} style={{ flex: 1, marginRight: 8 }}>Cancel</Button>
              <Button onPress={() => createMut.mutate()} loading={createMut.isPending} style={{ flex: 1 }}>Add</Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#f8fafc" },
  headerRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: "700", color: "#111827" },
  card:         { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reg:          { fontSize: 16, fontWeight: "700", color: "#111827" },
  meta:         { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  driver:       { fontSize: 13, color: "#0f766e" },
  empty:        { textAlign: "center", color: "#6b7280", padding: 24 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:   { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16 },
  modalBtns:    { flexDirection: "row", marginTop: 8 },
});
