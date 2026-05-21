import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMut = useMutation({
    mutationFn: () => authApi.login({ email: email.trim(), password }),
    onSuccess: (data) => {
      if (data.requires_otp) {
        navigation.navigate("Otp", { email: email.trim(), next: "login" });
        return;
      }
      setAuth(data.user, data.access_token, data.refresh_token, true);
    },
    onError: (err: any) => {
      Alert.alert("Login Failed", err?.response?.data?.detail ?? "Invalid credentials");
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Logo size="lg" style={styles.logo} showTagline />

      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@company.com"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntryToggle
          placeholder="••••••••"
        />

        <Button
          fullWidth
          loading={loginMut.isPending}
          onPress={() => loginMut.mutate()}
          style={styles.btn}
        >
          Sign In
        </Button>

        <Button
          fullWidth
          variant="ghost"
          onPress={() => navigation.navigate("Register")}
        >
          Don't have an account? Register
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", backgroundColor: "#f8fafc", padding: 24 },
  logo:      { marginBottom: 32, alignSelf: "center" },
  card:      { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  title:     { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 20 },
  btn:       { marginTop: 8, marginBottom: 12 },
});
