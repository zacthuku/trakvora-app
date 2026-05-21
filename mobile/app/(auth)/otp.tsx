import React, { useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function OtpScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, next } = route.params ?? {};
  const { setAuth } = useAuthStore();
  const [code, setCode] = useState("");
  const inputs = useRef<TextInput[]>([]);

  const verifyMut = useMutation({
    mutationFn: () => authApi.verifyOtp({ email, otp_code: code }),
    onSuccess: (data) => {
      if (next === "login" || next === "register") {
        setAuth(data.user, data.access_token, data.refresh_token, true);
      }
    },
    onError: (err: any) => {
      Alert.alert("Invalid Code", err?.response?.data?.detail ?? "Please try again");
    },
  });

  const resendMut = useMutation({
    mutationFn: () => authApi.sendOtp(email),
    onSuccess: () => Alert.alert("Code sent", `A new code has been sent to ${email}`),
  });

  const handleDigit = (val: string, idx: number) => {
    const digits = code.split("");
    digits[idx] = val;
    const newCode = digits.join("").slice(0, 6);
    setCode(newCode);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  return (
    <View style={styles.container}>
      <Logo size="md" style={styles.logo} />
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.sub}>Enter the 6-digit code sent to {email}</Text>

      <View style={styles.codeRow}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TextInput
            key={i}
            ref={(el) => { if (el) inputs.current[i] = el; }}
            style={styles.digitInput}
            maxLength={1}
            keyboardType="number-pad"
            value={code[i] ?? ""}
            onChangeText={(v) => handleDigit(v, i)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace" && !code[i] && i > 0) {
                inputs.current[i - 1]?.focus();
              }
            }}
          />
        ))}
      </View>

      <Button fullWidth loading={verifyMut.isPending} onPress={() => verifyMut.mutate()} disabled={code.length < 6} style={styles.btn}>
        Verify
      </Button>

      <TouchableOpacity onPress={() => resendMut.mutate()} disabled={resendMut.isPending}>
        <Text style={styles.resend}>Didn't receive it? Resend code</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f8fafc", padding: 24, justifyContent: "center" },
  logo:       { alignSelf: "center", marginBottom: 32 },
  title:      { fontSize: 22, fontWeight: "700", color: "#111827", textAlign: "center" },
  sub:        { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 8, marginBottom: 32 },
  codeRow:    { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 32 },
  digitInput: { width: 44, height: 52, borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 10, textAlign: "center", fontSize: 22, fontWeight: "700", backgroundColor: "#fff" },
  btn:        { marginBottom: 16 },
  resend:     { textAlign: "center", color: "#0f766e", fontWeight: "600", fontSize: 14, marginBottom: 12 },
  back:       { textAlign: "center", color: "#6b7280", fontSize: 14 },
});
