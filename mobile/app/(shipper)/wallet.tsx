import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { paymentsApi } from "@/api/payments";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";

export default function ShipperWalletScreen() {
  const [topUpAmount, setTopUpAmount] = useState("");
  const { data: wallet, isLoading } = useQuery({ queryKey: ["wallet"], queryFn: paymentsApi.getWallet });
  const { data: txns } = useQuery({ queryKey: ["transactions"], queryFn: () => paymentsApi.getTransactions({}) });

  const topUpMut = useMutation({
    mutationFn: () => paymentsApi.initiateTopUp(Number(topUpAmount)),
    onSuccess: async (data) => {
      if (data.payment_url) {
        await WebBrowser.openBrowserAsync(data.payment_url);
      }
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.detail ?? "Top-up failed"),
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Wallet Balance</Text>
        <Text style={styles.balance}>{formatKES(wallet?.balance ?? 0)}</Text>
      </View>

      <View style={styles.topUp}>
        <Text style={styles.sectionTitle}>Top Up</Text>
        <View style={styles.topUpRow}>
          <Input
            containerStyle={{ flex: 1, marginBottom: 0 }}
            value={topUpAmount}
            onChangeText={setTopUpAmount}
            keyboardType="numeric"
            placeholder="Amount (KES)"
          />
          <Button
            style={{ marginLeft: 10 }}
            onPress={() => topUpMut.mutate()}
            loading={topUpMut.isPending}
            disabled={!topUpAmount}
          >
            Top Up
          </Button>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Transactions</Text>
      <FlatList
        data={txns ?? []}
        keyExtractor={(t: any) => String(t.id)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item: tx }) => (
          <View style={styles.txCard}>
            <View style={styles.txRow}>
              <Text style={styles.txDesc}>{tx.description ?? tx.tx_type}</Text>
              <Text style={[styles.txAmount, tx.amount > 0 ? styles.credit : styles.debit]}>
                {tx.amount > 0 ? "+" : ""}{formatKES(tx.amount)}
              </Text>
            </View>
            <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#f8fafc" },
  balanceCard:  { backgroundColor: "#0f766e", margin: 16, marginTop: 56, borderRadius: 16, padding: 24 },
  balanceLabel: { color: "#ccfbf1", fontSize: 14, marginBottom: 4 },
  balance:      { color: "#fff", fontSize: 32, fontWeight: "800" },
  topUp:        { backgroundColor: "#fff", margin: 16, borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", paddingHorizontal: 16, marginBottom: 10 },
  topUpRow:     { flexDirection: "row", alignItems: "center" },
  txCard:       { backgroundColor: "#fff", borderRadius: 10, padding: 12 },
  txRow:        { flexDirection: "row", justifyContent: "space-between" },
  txDesc:       { fontSize: 14, color: "#111827", flex: 1 },
  txAmount:     { fontSize: 14, fontWeight: "700" },
  credit:       { color: "#15803d" },
  debit:        { color: "#dc2626" },
  txDate:       { fontSize: 12, color: "#6b7280", marginTop: 2 },
  empty:        { textAlign: "center", color: "#6b7280", padding: 24 },
});
