import React from "react";
import { ActivityIndicator, View, StyleSheet, ViewStyle } from "react-native";

interface SpinnerProps {
  size?: "small" | "large";
  color?: string;
  style?: ViewStyle;
  fullScreen?: boolean;
}

export function Spinner({ size = "large", color = "#0f766e", style, fullScreen = false }: SpinnerProps) {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator size={size} color={color} />
      </View>
    );
  }
  return <ActivityIndicator size={size} color={color} style={style} />;
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
});
