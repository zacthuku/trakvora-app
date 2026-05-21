import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

import { useAuthStore } from "@/store/authStore";
import { injectAuthStore } from "@/api/client";
import { notificationsApi } from "@/api/notifications";
import { Spinner } from "@/components/ui/Spinner";

// Auth screens
import LoginScreen from "./app/(auth)/login";
import RegisterScreen from "./app/(auth)/register";
import OtpScreen from "./app/(auth)/otp";

// Shipper screens
import ShipperDashboard from "./app/(shipper)/index";
import PostLoadScreen from "./app/(shipper)/post-load";
import ShipperShipmentsScreen from "./app/(shipper)/shipments";
import ShipperTrackingScreen from "./app/(shipper)/tracking";
import ShipperWalletScreen from "./app/(shipper)/wallet";
import ShipperInboxScreen from "./app/(shipper)/inbox";
import ShipperSettingsScreen from "./app/(shipper)/settings";

// Driver screens
import DriverDashboard from "./app/(driver)/index";
import JobFeedScreen from "./app/(driver)/jobs";
import ActiveJobScreen from "./app/(driver)/active";
import DriverEarningsScreen from "./app/(driver)/earnings";
import DriverProfileScreen from "./app/(driver)/profile";
import DriverInboxScreen from "./app/(driver)/inbox";

// Owner screens
import OwnerDashboard from "./app/(owner)/index";
import FleetScreen from "./app/(owner)/fleet";
import FleetMapScreen from "./app/(owner)/fleet-map";
import OwnerDriversScreen from "./app/(owner)/drivers";
import MarketplaceScreen from "./app/(owner)/marketplace";
import OwnerBidsScreen from "./app/(owner)/bids";
import OwnerWalletScreen from "./app/(owner)/wallet";
import OwnerInboxScreen from "./app/(owner)/inbox";
import OwnerSettingsScreen from "./app/(owner)/settings";

// Admin screens
import AdminDashboard from "./app/(admin)/index";
import AdminUsersScreen from "./app/(admin)/users";
import AdminLoadsScreen from "./app/(admin)/loads";
import AdminShipmentsScreen from "./app/(admin)/shipments";
import AdminTrucksScreen from "./app/(admin)/trucks";
import AdminComplianceScreen from "./app/(admin)/compliance";
import AdminFleetMapScreen from "./app/(admin)/fleet-map";
import AdminFieldOpsScreen from "./app/(admin)/field-ops";
import AdminIoTScreen from "./app/(admin)/iot";
import AdminActivityScreen from "./app/(admin)/activity";
import AdminSettingsScreen from "./app/(admin)/settings";
import DrawerContent from "@/components/layout/DrawerContent";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const AuthStack = createNativeStackNavigator();
const ShipperTab = createBottomTabNavigator();
const DriverTab = createBottomTabNavigator();
const OwnerTab = createBottomTabNavigator();
const AdminDrawer = createDrawerNavigator();
const RootStack = createNativeStackNavigator();

function ShipperNavigator() {
  return (
    <ShipperTab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0f766e" }}>
      <ShipperTab.Screen name="Dashboard"  component={ShipperDashboard}        options={{ title: "Home" }} />
      <ShipperTab.Screen name="PostLoad"   component={PostLoadScreen}          options={{ title: "New Load" }} />
      <ShipperTab.Screen name="Shipments"  component={ShipperShipmentsScreen}  options={{ title: "Shipments" }} />
      <ShipperTab.Screen name="Tracking"   component={ShipperTrackingScreen}   options={{ title: "Track" }} />
      <ShipperTab.Screen name="Wallet"     component={ShipperWalletScreen}     options={{ title: "Wallet" }} />
      <ShipperTab.Screen name="Inbox"      component={ShipperInboxScreen}      options={{ title: "Inbox" }} />
      <ShipperTab.Screen name="Settings"   component={ShipperSettingsScreen}   options={{ title: "Settings" }} />
    </ShipperTab.Navigator>
  );
}

function DriverNavigator() {
  return (
    <DriverTab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0f766e" }}>
      <DriverTab.Screen name="Dashboard" component={DriverDashboard}       options={{ title: "Home" }} />
      <DriverTab.Screen name="Jobs"      component={JobFeedScreen}         options={{ title: "Jobs" }} />
      <DriverTab.Screen name="ActiveJob" component={ActiveJobScreen}       options={{ title: "Active Job" }} />
      <DriverTab.Screen name="Earnings"  component={DriverEarningsScreen}  options={{ title: "Earnings" }} />
      <DriverTab.Screen name="Profile"   component={DriverProfileScreen}   options={{ title: "Profile" }} />
      <DriverTab.Screen name="Inbox"     component={DriverInboxScreen}     options={{ title: "Inbox" }} />
    </DriverTab.Navigator>
  );
}

function OwnerNavigator() {
  return (
    <OwnerTab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0f766e" }}>
      <OwnerTab.Screen name="Dashboard"   component={OwnerDashboard}     options={{ title: "Home" }} />
      <OwnerTab.Screen name="Fleet"       component={FleetScreen}        options={{ title: "Fleet" }} />
      <OwnerTab.Screen name="FleetMap"    component={FleetMapScreen}     options={{ title: "Map" }} />
      <OwnerTab.Screen name="Drivers"     component={OwnerDriversScreen} options={{ title: "Drivers" }} />
      <OwnerTab.Screen name="Marketplace" component={MarketplaceScreen}  options={{ title: "Loads" }} />
      <OwnerTab.Screen name="Bids"        component={OwnerBidsScreen}    options={{ title: "Bids" }} />
      <OwnerTab.Screen name="Wallet"      component={OwnerWalletScreen}  options={{ title: "Wallet" }} />
      <OwnerTab.Screen name="Inbox"       component={OwnerInboxScreen}   options={{ title: "Inbox" }} />
      <OwnerTab.Screen name="Settings"    component={OwnerSettingsScreen} options={{ title: "Settings" }} />
    </OwnerTab.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminDrawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ drawerActiveTintColor: "#0f766e" }}
    >
      <AdminDrawer.Screen name="AdminDashboard" component={AdminDashboard}       options={{ title: "Dashboard" }} />
      <AdminDrawer.Screen name="Users"          component={AdminUsersScreen}     options={{ title: "Users" }} />
      <AdminDrawer.Screen name="Loads"          component={AdminLoadsScreen}     options={{ title: "Loads" }} />
      <AdminDrawer.Screen name="Shipments"      component={AdminShipmentsScreen} options={{ title: "Shipments" }} />
      <AdminDrawer.Screen name="Trucks"         component={AdminTrucksScreen}    options={{ title: "Trucks" }} />
      <AdminDrawer.Screen name="Compliance"     component={AdminComplianceScreen} options={{ title: "Compliance" }} />
      <AdminDrawer.Screen name="AdminFleetMap"  component={AdminFleetMapScreen}  options={{ title: "Fleet Map" }} />
      <AdminDrawer.Screen name="FieldOps"       component={AdminFieldOpsScreen}  options={{ title: "Field Ops" }} />
      <AdminDrawer.Screen name="IoT"            component={AdminIoTScreen}       options={{ title: "IoT Devices" }} />
      <AdminDrawer.Screen name="ActivityLog"    component={AdminActivityScreen}  options={{ title: "Activity Log" }} />
      <AdminDrawer.Screen name="AdminSettings"  component={AdminSettingsScreen}  options={{ title: "Settings" }} />
    </AdminDrawer.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"    component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="Otp"      component={OtpScreen} />
    </AuthStack.Navigator>
  );
}

function RoleNavigator({ role }: { role: string }) {
  if (role === "shipper") return <ShipperNavigator />;
  if (role === "driver")  return <DriverNavigator />;
  if (role === "owner")   return <OwnerNavigator />;
  if (role === "admin")   return <AdminNavigator />;
  return <AuthNavigator />;
}

function AppContent() {
  const { user } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    Notifications.getExpoPushTokenAsync()
      .then(({ data }) => notificationsApi.registerPushToken(data))
      .catch(() => {});
  }, [user?.id]);

  if (!hydrated) return <Spinner fullScreen />;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <RootStack.Screen name="App">
          {() => <RoleNavigator role={user.role} />}
        </RootStack.Screen>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    injectAuthStore(useAuthStore as any);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
