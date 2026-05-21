import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
  showTagline?: boolean;
}

const SIZE_MAP = { sm: 20, md: 28, lg: 36 };

export function Logo({ size = "md", style, showTagline = false }: LogoProps) {
  const fontSize = SIZE_MAP[size];
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.logo, { fontSize }]}>
        <Text style={styles.trak}>trak</Text>
        <Text style={styles.vora}>vora</Text>
      </Text>
      {showTagline && (
        <Text style={styles.tagline}>East Africa's Freight Exchange</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  logo:      { fontWeight: "800", letterSpacing: -0.5 },
  trak:      { color: "#0f766e" },
  vora:      { color: "#1e293b" },
  tagline:   { fontSize: 12, color: "#64748b", marginTop: 2 },
});
