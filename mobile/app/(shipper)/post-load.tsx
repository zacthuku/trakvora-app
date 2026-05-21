import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { shipperApi } from "@/api/shipper";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CARGO_TYPES, TRUCK_TYPES } from "@/utils/constants";
import { TouchableOpacity } from "react-native";

const BOOKING_MODES = [
  { value: "auction", label: "Auction (get best bid)" },
  { value: "direct",  label: "Direct (set fixed price)" },
];

export default function PostLoadScreen() {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState({
    pickup_location: "", dropoff_location: "", cargo_type: "general",
    truck_type: "dry_van", weight_kg: "", offered_price: "",
    booking_mode: "auction", description: "",
  });
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => shipperApi.createLoad({
      ...form,
      weight_kg: Number(form.weight_kg),
      offered_price: Number(form.offered_price),
    }),
    onSuccess: () => {
      Alert.alert("Load Posted!", "Carriers can now bid on your load.");
      navigation.navigate("Shipments");
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail ?? "Could not post load");
    },
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Post a Load</Text>

      <Input label="Pickup Location" value={form.pickup_location} onChangeText={set("pickup_location")} placeholder="e.g. Nairobi, Kenya" />
      <Input label="Dropoff Location" value={form.dropoff_location} onChangeText={set("dropoff_location")} placeholder="e.g. Mombasa, Kenya" />

      <Text style={styles.label}>Cargo Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.chipRow}>
          {CARGO_TYPES.map((t) => (
            <TouchableOpacity key={t.value} style={[styles.chip, form.cargo_type === t.value && styles.chipActive]} onPress={() => set("cargo_type")(t.value)}>
              <Text style={[styles.chipText, form.cargo_type === t.value && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.label}>Truck Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.chipRow}>
          {TRUCK_TYPES.map((t) => (
            <TouchableOpacity key={t.value} style={[styles.chip, form.truck_type === t.value && styles.chipActive]} onPress={() => set("truck_type")(t.value)}>
              <Text style={[styles.chipText, form.truck_type === t.value && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Input label="Weight (kg)" value={form.weight_kg} onChangeText={set("weight_kg")} keyboardType="numeric" placeholder="e.g. 5000" />
      <Input label="Offered Price (KES)" value={form.offered_price} onChangeText={set("offered_price")} keyboardType="numeric" placeholder="e.g. 45000" />

      <Text style={styles.label}>Booking Mode</Text>
      <View style={styles.modeRow}>
        {BOOKING_MODES.map((m) => (
          <TouchableOpacity key={m.value} style={[styles.modeBtn, form.booking_mode === m.value && styles.modeBtnActive]} onPress={() => set("booking_mode")(m.value)}>
            <Text style={[styles.modeBtnText, form.booking_mode === m.value && styles.modeBtnTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Input label="Description (optional)" value={form.description} onChangeText={set("description")} placeholder="Additional details about the cargo" multiline numberOfLines={3} />

      <Button fullWidth loading={mut.isPending} onPress={() => mut.mutate()} style={{ marginTop: 8 }}>
        Post Load
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: "#f8fafc" },
  title:         { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 20 },
  label:         { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  chipRow:       { flexDirection: "row", gap: 8, paddingBottom: 4 },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
  chipActive:    { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  chipText:      { fontSize: 13, color: "#374151" },
  chipTextActive:{ color: "#0f766e", fontWeight: "600" },
  modeRow:       { gap: 8, marginBottom: 16 },
  modeBtn:       { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  modeBtnActive: { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  modeBtnText:   { fontSize: 14, color: "#374151" },
  modeBtnTextActive: { color: "#0f766e", fontWeight: "600" },
});
