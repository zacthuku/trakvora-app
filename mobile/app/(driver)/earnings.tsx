import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { driverApi } from "@/api/driver";
import { paymentsApi } from "@/api/payments";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { formatKES } from "@/utils/currency";

export default function DriverEarningsScreen() {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const { data: wallet, isLoading } = useQuery({ queryKey: ["driver-wallet"], queryFn: driverApi.getWallet });
  const { data: txns } = useQuery({ queryKey: ["driver-txns"], queryFn: () => driverApi.getTransactions({}) });

  const withdrawMut = useMutation({
    mutationFn: () => paymentsApi.requestWithdrawal(Number(withdrawAmount), { method: "mpesa" }),
    onSuccess: () => { Alert.alert("Withdrawal Requested!", "Funds will be sent to your M-Pesa shortly."); setWithdrawAmount(""); },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.detail ?? "Withdrawal failed"),
  });

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={styles.screen}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Earnings</Text>
        <Text style={styles.balance}>{formatKES(wallet?.balance ?? 0)}</Text>
        <Text style={styles.pending}>Pending: {formatKES(wallet?.escrow_balance ?? 0)}</Text>
      </View>

      <View style={styles.withdrawSection}>
        <Text style={styles.sectionTitle}>Withdraw via M-Pesa</Text>
        <View style={styles.row}>
          <Input containerStyle={{ flex: 1, marginBottom: 0, marginRight: 10 }} value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="numeric" placeholder="Amount (KES)" />
          <Button onPress={() => withdrawMut.mutate()} loading={withdrawMut.isPending} disabled={!withdrawAmount}>Withdraw</Button>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Transaction History</Text>
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
  screen:          { flex: 1, backgroundColor: "#f8fafc" },
  balanceCard:     { backgroundColor: "#0f766e", margin: 16, marginTop: 56, borderRadius: 16, padding: 24 },
  balanceLabel:    { color: "#ccfbf1", fontSize: 14 },
  balance:         { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 4 },
  pending:         { color: "#99f6e4", fontSize: 13, marginTop: 4 },
  withdrawSection: { backgroundColor: "#fff", margin: 16, borderRadius: 12, padding: 16 },
  sectionTitle:    { fontSize: 16, fontWeight: "700", color: "#111827", paddingHorizontal: 16, marginBottom: 10 },
  row:             { flexDirection: "row", alignItems: "center" },
  txCard:          { backgroundColor: "#fff", borderRadius: 10, padding: 12 },
  txRow:           { flexDirection: "row", justifyContent: "space-between" },
  txDesc:          { fontSize: 14, color: "#111827", flex: 1 },
  txAmount:        { fontSize: 14, fontWeight: "700" },
  credit:          { color: "#15803d" },
  debit:           { color: "#dc2626" },
  txDate:          { fontSize: 12, color: "#6b7280", marginTop: 2 },
  empty:           { textAlign: "center", color: "#6b7280", padding: 24 },
});
