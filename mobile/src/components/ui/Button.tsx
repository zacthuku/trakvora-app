import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
  primary:   { container: { backgroundColor: "#0f766e" }, text: { color: "#fff" } },
  secondary: { container: { backgroundColor: "#f1f5f9" }, text: { color: "#0f172a" } },
  outline:   { container: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0f766e" }, text: { color: "#0f766e" } },
  danger:    { container: { backgroundColor: "#dc2626" }, text: { color: "#fff" } },
  ghost:     { container: { backgroundColor: "transparent" }, text: { color: "#0f766e" } },
};

const SIZE_STYLES: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: { container: { paddingVertical: 6,  paddingHorizontal: 12, borderRadius: 6  }, text: { fontSize: 13 } },
  md: { container: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8  }, text: { fontSize: 15 } },
  lg: { container: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10 }, text: { fontSize: 17 } },
};

export function Button({
  onPress, children, variant = "primary", size = "md",
  loading = false, disabled = false, style, textStyle, fullWidth = false,
}: ButtonProps) {
  const vs = VARIANT_STYLES[variant];
  const ss = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        vs.container,
        ss.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : "#0f766e"} size="small" />
      ) : (
        <Text style={[styles.text, vs.text, ss.text, textStyle]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base:      { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  fullWidth: { width: "100%" },
  disabled:  { opacity: 0.5 },
  text:      { fontWeight: "600" },
});
