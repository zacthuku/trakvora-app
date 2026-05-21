import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { driverApi } from "@/api/driver";
import { useAuthStore } from "@/store/authStore";

export const BACKGROUND_LOCATION_TASK = "trakvora-background-location";

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  if (!data?.locations?.length) return;

  const loc = data.locations[0];
  const authState = useAuthStore.getState();

  if (!authState.user || authState.user.role !== "driver") return;

  try {
    // Get active shipment ID from local state or re-fetch
    const activeShipment = await driverApi.getActiveShipment().catch(() => null);
    if (activeShipment?.id) {
      await driverApi.updateLocation(activeShipment.id, {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    }
  } catch {
    // ignore background errors silently
  }
});

export async function startBackgroundLocationTracking() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") return false;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) return true;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15_000,
    distanceInterval: 100,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Trakvora",
      notificationBody: "GPS tracking active — shipment in progress",
      notificationColor: "#0f766e",
    },
  });
  return true;
}

export async function stopBackgroundLocationTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
