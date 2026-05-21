import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

const ROLES = [
  { value: "shipper", label: "Shipper", desc: "Post loads & manage shipments" },
  { value: "owner",   label: "Fleet Owner", desc: "Manage trucks & bid on loads" },
  { value: "driver",  label: "Driver", desc: "Find jobs & earn money" },
];

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "shipper" as any, country: "KE" });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => authApi.register({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
      role: form.role,
      country: form.country,
    }),
    onSuccess: () => {
      navigation.navigate("Otp", { email: form.email.trim(), next: "register" });
    },
    onError: (err: any) => {
      Alert.alert("Registration Failed", err?.response?.data?.detail ?? "Please try again");
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Logo size="lg" style={styles.logo} showTagline />

      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>

        <Text style={styles.sectionLabel}>I am a…</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleBtn, form.role === r.value && styles.roleBtnActive]}
              onPress={() => setForm((f) => ({ ...f, role: r.value }))}
            >
              <Text style={[styles.roleBtnLabel, form.role === r.value && styles.roleBtnLabelActive]}>
                {r.label}
              </Text>
              <Text style={styles.roleBtnDesc}>{r.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input label="Full Name" value={form.name} onChangeText={set("name")} placeholder="John Doe" />
        <Input label="Email" value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" placeholder="you@company.com" />
        <Input label="Phone (optional)" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="+254 700 000 000" />
        <Input label="Password" value={form.password} onChangeText={set("password")} secureTextEntryToggle placeholder="Min. 8 characters" />

        <Button fullWidth loading={mut.isPending} onPress={() => mut.mutate()} style={styles.btn}>
          Create Account
        </Button>

        <Button fullWidth variant="ghost" onPress={() => navigation.navigate("Login")}>
          Already have an account? Sign In
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:         { flexGrow: 1, justifyContent: "center", backgroundColor: "#f8fafc", padding: 24 },
  logo:              { marginBottom: 24, alignSelf: "center" },
  card:              { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  title:             { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  sectionLabel:      { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  roleRow:           { gap: 8, marginBottom: 16 },
  roleBtn:           { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: "#e2e8f0" },
  roleBtnActive:     { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  roleBtnLabel:      { fontSize: 14, fontWeight: "700", color: "#374151" },
  roleBtnLabelActive:{ color: "#0f766e" },
  roleBtnDesc:       { fontSize: 12, color: "#6b7280", marginTop: 2 },
  btn:               { marginTop: 8, marginBottom: 12 },
});
