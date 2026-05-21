import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { LOAD_STATUS_COLORS, LOAD_STATUS_LABELS } from "../../utils/constants";

interface BadgeProps {
  status?: string;
  label?: string;
  color?: { bg: string; text: string };
  style?: ViewStyle;
}

export function Badge({ status, label, color, style }: BadgeProps) {
  const c = color ?? (status ? LOAD_STATUS_COLORS[status] : null) ?? { bg: "#f1f5f9", text: "#475569" };
  const text = label ?? (status ? LOAD_STATUS_LABELS[status] : "") ?? "";

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[styles.text, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" },
  text:  { fontSize: 12, fontWeight: "600" },
});
