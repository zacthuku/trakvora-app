import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { ownerApi } from "@/api/owner";
import { Spinner } from "@/components/ui/Spinner";

export default function FleetMapScreen() {
  const { data: positions, isLoading } = useQuery({
    queryKey: ["fleet-positions"],
    queryFn: ownerApi.getActiveFleetPositions,
    refetchInterval: 30_000,
  });

  if (isLoading) return <Spinner fullScreen />;

  const center = positions?.[0]
    ? { latitude: positions[0].latitude, longitude: positions[0].longitude }
    : { latitude: -1.286389, longitude: 36.817223 };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Fleet Map ({positions?.length ?? 0} active)</Text>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...center, latitudeDelta: 5, longitudeDelta: 5 }}
      >
        {(positions ?? []).map((pos: any) => (
          <Marker
            key={pos.truck_id}
            coordinate={{ latitude: pos.latitude, longitude: pos.longitude }}
            title={pos.registration_number ?? `Truck ${pos.truck_id}`}
            description={pos.driver_name}
            pinColor="#0f766e"
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title:  { position: "absolute", top: 56, left: 16, zIndex: 10, fontSize: 16, fontWeight: "700", color: "#111827", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  map:    { flex: 1 },
});
