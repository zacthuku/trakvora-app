import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { adminApi } from "@/api/admin";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminFleetMapScreen() {
  const { data: positions, isLoading } = useQuery({
    queryKey: ["admin-fleet-positions"],
    queryFn: adminApi.getActiveFleetPositions,
    refetchInterval: 30_000,
  });
  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <Text style={styles.overlay}>{positions?.length ?? 0} active trucks</Text>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: -1.286389, longitude: 36.817223, latitudeDelta: 8, longitudeDelta: 8 }}
      >
        {(positions ?? []).map((pos: any) => (
          <Marker key={pos.truck_id} coordinate={{ latitude: pos.latitude, longitude: pos.longitude }} title={pos.registration_number} description={pos.driver_name} pinColor="#0f766e" />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  overlay: { position: "absolute", top: 16, left: 16, zIndex: 10, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, fontWeight: "700", color: "#111827" },
  map:     { flex: 1 },
});
