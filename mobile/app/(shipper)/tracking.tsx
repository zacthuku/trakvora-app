import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { shipperApi } from "@/api/shipper";
import { useTrackingSocket } from "@/hooks/useWebSocket";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface TrackPoint { latitude: number; longitude: number; }

export default function ShipperTrackingScreen() {
  const route = useRoute<any>();
  const { loadId } = route.params ?? {};
  const [truckPos, setTruckPos] = useState<TrackPoint | null>(null);
  const [trail, setTrail] = useState<TrackPoint[]>([]);

  const { data: shipment, isLoading } = useQuery({
    queryKey: ["shipment-by-load", loadId],
    queryFn: () => shipperApi.getShipmentByLoad(loadId),
    enabled: !!loadId,
  });

  const onWsMessage = useCallback((data: any) => {
    if (data.latitude && data.longitude) {
      const pt = { latitude: data.latitude, longitude: data.longitude };
      setTruckPos(pt);
      setTrail((t) => [...t.slice(-99), pt]);
    }
  }, []);

  useTrackingSocket(shipment?.id, onWsMessage);

  if (isLoading) return <Spinner fullScreen />;

  const pickup  = { latitude: shipment?.pickup_lat  ?? -1.286389, longitude: shipment?.pickup_lng  ?? 36.817223 };
  const dropoff = { latitude: shipment?.dropoff_lat ?? -4.043477, longitude: shipment?.dropoff_lng ?? 39.668206 };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.route}>{shipment?.pickup_location} → {shipment?.dropoff_location}</Text>
        <Badge status={shipment?.status} />
      </View>

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: (pickup.latitude + dropoff.latitude) / 2,
          longitude: (pickup.longitude + dropoff.longitude) / 2,
          latitudeDelta: 4,
          longitudeDelta: 4,
        }}
      >
        <Marker coordinate={pickup}  title="Pickup"  pinColor="green" />
        <Marker coordinate={dropoff} title="Dropoff" pinColor="red" />
        {truckPos && <Marker coordinate={truckPos} title="Driver" pinColor="#0f766e" />}
        {trail.length > 1 && (
          <Polyline coordinates={trail} strokeColor="#0f766e" strokeWidth={3} />
        )}
      </MapView>

      <View style={styles.info}>
        <Text style={styles.infoLabel}>Driver</Text>
        <Text style={styles.infoValue}>{shipment?.driver_name ?? "Assigned driver"}</Text>
        <Text style={styles.infoLabel}>Status</Text>
        <Text style={styles.infoValue}>{shipment?.status?.replace(/_/g, " ") ?? "—"}</Text>
        {!truckPos && <Text style={styles.noGps}>Waiting for GPS signal…</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: "#f8fafc" },
  header:   { padding: 16, paddingTop: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff" },
  route:    { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  map:      { flex: 1 },
  info:     { backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  infoLabel:{ fontSize: 12, color: "#6b7280", marginTop: 4 },
  infoValue:{ fontSize: 14, fontWeight: "600", color: "#111827" },
  noGps:    { fontSize: 12, color: "#f59e0b", marginTop: 8 },
});
