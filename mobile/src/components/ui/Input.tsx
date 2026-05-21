import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightIcon?: React.ReactNode;
  secureTextEntryToggle?: boolean;
}

export function Input({
  label, error, containerStyle, rightIcon, secureTextEntryToggle = false,
  secureTextEntry, style, ...props
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const isSecure = secureTextEntryToggle ? !visible : (secureTextEntry ?? false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, error ? styles.inputError : styles.inputNormal]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor="#94a3b8"
          secureTextEntry={isSecure}
          {...props}
        />
        {secureTextEntryToggle && (
          <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.eye}>
            <Text style={styles.eyeText}>{visible ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        )}
        {!secureTextEntryToggle && rightIcon && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { marginBottom: 12 },
  label:       { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4 },
  inputRow:    { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, backgroundColor: "#fff" },
  inputNormal: { borderColor: "#d1d5db" },
  inputError:  { borderColor: "#dc2626" },
  input:       { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827" },
  eye:         { paddingHorizontal: 12 },
  eyeText:     { color: "#0f766e", fontSize: 13, fontWeight: "600" },
  rightIcon:   { paddingHorizontal: 12 },
  error:       { fontSize: 12, color: "#dc2626", marginTop: 4 },
});
