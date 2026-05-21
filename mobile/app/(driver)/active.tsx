import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView, Linking } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { driverApi } from "@/api/driver";
import { useTrackingSocket } from "@/hooks/useWebSocket";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";

const STATUS_FLOW = ["en_route_pickup", "loaded", "in_transit", "delivered"] as const;
const STATUS_LABELS: Record<string, string> = {
  en_route_pickup: "En Route to Pickup",
  loaded:          "Loaded — Ready to Depart",
  in_transit:      "In Transit",
  delivered:       "Delivered",
};

export default function ActiveJobScreen() {
  const qc = useQueryClient();
  const [trail, setTrail] = useState<{ latitude: number; longitude: number }[]>([]);
  const [deliveryCode, setDeliveryCode] = useState("");
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const { data: shipment, isLoading } = useQuery({
    queryKey: ["active-shipment"],
    queryFn: driverApi.getActiveShipment,
    refetchInterval: 30_000,
  });

  const { send: wsSend } = useTrackingSocket(shipment?.id, useCallback(() => {}, []));

  // Start GPS tracking when there's an active shipment
  useEffect(() => {
    if (!shipment?.id) return;

    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 50 },
        (loc) => {
          if (!active) return;
          const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setTrail((t) => [...t.slice(-99), pt]);
          wsSend({ type: "location_update", latitude: pt.latitude, longitude: pt.longitude, shipment_id: shipment.id });
          driverApi.updateLocation(shipment.id, pt).catch(() => {});
        }
      );
    })();

    return () => {
      active = false;
      locationSubRef.current?.remove();
    };
  }, [shipment?.id, wsSend]);

  const statusMut = useMutation({
    mutationFn: ({ status, delivery_code }: { status: string; delivery_code?: string }) =>
      driverApi.updateStatus(shipment!.id, { status, delivery_code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-shipment"] }),
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.detail ?? "Could not update status"),
  });

  const uploadPhotoMut = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await driverApi.uploadPhoto(asset.uri, `proof_${Date.now()}.jpg`);
      Alert.alert("Uploaded!", "Delivery proof photo saved.");
    },
    onError: () => Alert.alert("Upload failed", "Could not upload photo. Try again."),
  });

  const currentIdx  = shipment ? STATUS_FLOW.indexOf(shipment.status as any) : -1;
  const nextStatus  = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
  const isDelivered = shipment?.status === "delivered";

  const openMaps = (lat: number, lng: number, label: string) => {
    const url = `comgooglemaps://?q=${label}&center=${lat},${lng}&zoom=14`;
    const fallback = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.canOpenURL(url).then((ok) => Linking.openURL(ok ? url : fallback));
  };

  if (isLoading) return <Spinner fullScreen />;

  if (!shipment) {
    return (
      <View style={styles.noJob}>
        <Text style={styles.noJobTitle}>No Active Job</Text>
        <Text style={styles.noJobSub}>Accept a bid from the Job Feed to get started.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen}>
      {/* Status timeline */}
      <View style={styles.timeline}>
        {STATUS_FLOW.map((s, i) => (
          <View key={s} style={styles.timelineItem}>
            <View style={[styles.timelineDot, i <= currentIdx && styles.timelineDotDone]} />
            <Text style={[styles.timelineLabel, i <= currentIdx && styles.timelineLabelDone]}>
              {STATUS_LABELS[s]}
            </Text>
          </View>
        ))}
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: shipment.pickup_lat ?? -1.286389,
          longitude: shipment.pickup_lng ?? 36.817223,
          latitudeDelta: 3, longitudeDelta: 3,
        }}
      >
        {shipment.pickup_lat && (
          <Marker coordinate={{ latitude: shipment.pickup_lat, longitude: shipment.pickup_lng }} title="Pickup" pinColor="green" />
        )}
        {shipment.dropoff_lat && (
          <Marker coordinate={{ latitude: shipment.dropoff_lat, longitude: shipment.dropoff_lng }} title="Dropoff" pinColor="red" />
        )}
        {trail.length > 0 && (
          <Marker coordinate={trail[trail.length - 1]} title="You" pinColor="#0f766e" />
        )}
        {trail.length > 1 && (
          <Polyline coordinates={trail} strokeColor="#0f766e" strokeWidth={3} />
        )}
      </MapView>

      {/* Route info */}
      <View style={styles.info}>
        <Text style={styles.route}>{shipment.pickup_location} → {shipment.dropoff_location}</Text>
        <Badge status={shipment.status} />
      </View>

      {/* Navigation buttons */}
      <View style={styles.navBtns}>
        {shipment.pickup_lat && (
          <TouchableOpacity style={styles.navBtn} onPress={() => openMaps(shipment.pickup_lat, shipment.pickup_lng, "Pickup")}>
            <Text style={styles.navBtnText}>📍 Navigate to Pickup</Text>
          </TouchableOpacity>
        )}
        {shipment.dropoff_lat && (
          <TouchableOpacity style={styles.navBtn} onPress={() => openMaps(shipment.dropoff_lat, shipment.dropoff_lng, "Dropoff")}>
            <Text style={styles.navBtnText}>🏁 Navigate to Dropoff</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {nextStatus && !isDelivered && (
          <>
            {nextStatus === "delivered" ? (
              <>
                <Input
                  label="Delivery Code (from shipper)"
                  value={deliveryCode}
                  onChangeText={setDeliveryCode}
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Button
                  fullWidth
                  loading={statusMut.isPending}
                  disabled={deliveryCode.length < 6}
                  onPress={() => statusMut.mutate({ status: "delivered", delivery_code: deliveryCode })}
                  style={{ marginBottom: 10 }}
                >
                  Confirm Delivery
                </Button>
              </>
            ) : (
              <Button
                fullWidth
                loading={statusMut.isPending}
                onPress={() => statusMut.mutate({ status: nextStatus })}
                style={{ marginBottom: 10 }}
              >
                Mark: {STATUS_LABELS[nextStatus]}
              </Button>
            )}
          </>
        )}

        <Button
          fullWidth
          variant="outline"
          onPress={() => uploadPhotoMut.mutate()}
          loading={uploadPhotoMut.isPending}
        >
          📷 Upload Delivery Photo
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:             { flex: 1, backgroundColor: "#f8fafc" },
  noJob:              { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  noJobTitle:         { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
  noJobSub:           { fontSize: 14, color: "#6b7280", textAlign: "center" },
  timeline:           { backgroundColor: "#fff", padding: 16, paddingTop: 56 },
  timelineItem:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  timelineDot:        { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#d1d5db", backgroundColor: "#fff" },
  timelineDotDone:    { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  timelineLabel:      { fontSize: 13, color: "#9ca3af" },
  timelineLabelDone:  { color: "#0f766e", fontWeight: "600" },
  map:                { height: 220 },
  info:               { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff" },
  route:              { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  navBtns:            { flexDirection: "row", gap: 10, padding: 16, paddingTop: 10 },
  navBtn:             { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  navBtnText:         { fontSize: 13, fontWeight: "600", color: "#374151" },
  actions:            { padding: 16, paddingTop: 8 },
});
