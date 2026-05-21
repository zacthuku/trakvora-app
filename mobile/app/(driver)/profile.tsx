import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert, Image } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { driverApi } from "@/api/driver";
import { usersApi } from "@/api/users";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

export default function DriverProfileScreen() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ["driver-profile"], queryFn: driverApi.getProfile });
  const [bio, setBio] = useState(profile?.bio ?? "");

  const updateMut = useMutation({
    mutationFn: () => driverApi.updateProfile({ bio }),
    onSuccess: () => { Alert.alert("Saved!"); qc.invalidateQueries({ queryKey: ["driver-profile"] }); },
  });

  const photoMut = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uploaded = await usersApi.uploadProfilePhoto(asset.uri, `profile_${Date.now()}.jpg`);
      await usersApi.updateMe({ profile_photo_url: uploaded.url });
      qc.invalidateQueries({ queryKey: ["driver-profile"] });
      Alert.alert("Photo updated!");
    },
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.header}>
        {profile?.passport_photo_url ? (
          <Image source={{ uri: profile.passport_photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>{profile?.user_name?.[0] ?? "D"}</Text>
          </View>
        )}
        <Button variant="outline" size="sm" onPress={() => photoMut.mutate()} loading={photoMut.isPending} style={{ marginTop: 8 }}>
          Change Photo
        </Button>
        <Text style={styles.name}>{profile?.user_name ?? "Driver"}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>⭐ {profile?.rating?.toFixed(1) ?? "N/A"}</Text>
          <Text style={styles.trips}>{profile?.total_trips ?? 0} trips</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KYC Status</Text>
        <Badge
          label={profile?.verification_status ?? "pending"}
          color={profile?.verification_status === "approved"
            ? { bg: "#f0fdf4", text: "#15803d" }
            : { bg: "#fffbeb", text: "#b45309" }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bio</Text>
        <Input value={bio || profile?.bio || ""} onChangeText={setBio} multiline numberOfLines={3} placeholder="Tell shippers about yourself…" />
        <Button onPress={() => updateMut.mutate()} loading={updateMut.isPending} size="sm">Save</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:               { flex: 1, backgroundColor: "#f8fafc" },
  header:               { alignItems: "center", padding: 24, paddingTop: 56, backgroundColor: "#fff", marginBottom: 12 },
  photo:                { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder:     { width: 80, height: 80, borderRadius: 40, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center" },
  photoPlaceholderText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  name:                 { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 12 },
  ratingRow:            { flexDirection: "row", gap: 12, marginTop: 4 },
  rating:               { fontSize: 14, color: "#374151" },
  trips:                { fontSize: 14, color: "#6b7280" },
  section:              { backgroundColor: "#fff", margin: 16, marginBottom: 0, borderRadius: 12, padding: 16 },
  sectionTitle:         { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 10 },
});
