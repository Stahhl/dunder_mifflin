import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text } from "react-native";
import { dispatchShipment, fetchPendingShipments, submitMockScan } from "./src/api/warehouse-api";
import { decodeJwt } from "./src/auth/jwt";
import { completeAuthorizationCodeFlow, isAuthCallbackRoute, startLogin } from "./src/auth/oidc";
import { clearStoredAccessToken, readStoredAccessToken, storeAccessToken } from "./src/auth/session";
import { OperatorPanel } from "./src/components/OperatorPanel";
import { ScannerPanel } from "./src/components/ScannerPanel";
import { ShipmentsPanel } from "./src/components/ShipmentsPanel";
import { SignInPanel } from "./src/components/SignInPanel";
import { SyncStatusPanel } from "./src/components/SyncStatusPanel";
import { E2E_MOCK_SCANNER, getRuntimeConfig } from "./src/config/runtime";
import { readOfflineQueue, readShipmentCache, writeOfflineQueue, writeShipmentCache } from "./src/offline/storage";
import { styles } from "./src/styles";
import type { OfflineOperation, ShipmentSummary } from "./src/types/warehouse";

export default function App() {
  if (typeof window !== "undefined") {
    const forceError = new URLSearchParams(window.location.search).get("__e2e_force_error__");
    if (forceError === "1") {
      throw new Error("Forced Warehouse render failure for reliability test.");
    }
  }

  const config = useMemo(() => getRuntimeConfig(), []);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [scannerValue, setScannerValue] = useState("SKU:PPR-A4-WHT-500");
  const [scannerQuantity, setScannerQuantity] = useState("1");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") {
      return true;
    }

    return navigator.onLine;
  });

  useEffect(() => {
    setAccessToken(readStoredAccessToken());
    setOfflineQueue(readOfflineQueue());
    setShipments(readShipmentCache());
  }, []);

  useEffect(() => {
    writeOfflineQueue(offlineQueue);
  }, [offlineQueue]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isAuthCallbackRoute()) {
      return;
    }

    completeAuthorizationCodeFlow(config)
      .then((token) => {
        storeAccessToken(token);
        setAccessToken(token);
        setNotice("Signed in successfully.");
        setError(null);
      })
      .catch((errorObject) => {
        setError(errorObject instanceof Error ? errorObject.message : "Login failed");
      });
  }, [config]);

  const refreshShipments = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoadingShipments(true);
    setError(null);

    try {
      const response = await fetchPendingShipments(config.gatewayBaseUrl, accessToken);
      setShipments(response.items);
      writeShipmentCache(response.items);
    } catch (errorObject) {
      if (isLikelyNetworkError(errorObject)) {
        setError("Offline: showing cached shipment queue.");
      } else {
        setError(errorObject instanceof Error ? errorObject.message : "Unable to load shipments");
      }
    } finally {
      setLoadingShipments(false);
    }
  }, [accessToken, config.gatewayBaseUrl]);

  const flushOfflineQueue = useCallback(
    async (operationsOverride?: OfflineOperation[]) => {
      if (!accessToken || syncingQueue || !isOnline) {
        return;
      }

      const initialQueue = operationsOverride ?? offlineQueue;
      if (initialQueue.length === 0) {
        return;
      }

      setSyncingQueue(true);
      setError(null);

      let completed = 0;
      let remaining = [...initialQueue];

      for (const operation of initialQueue) {
        try {
          if (operation.kind === "scan") {
            await submitMockScan(
              config.gatewayBaseUrl,
              accessToken,
              operation.shipmentId,
              operation.payload.barcode,
              operation.payload.quantity,
              operation.idempotencyKey
            );
          } else {
            await dispatchShipment(
              config.gatewayBaseUrl,
              accessToken,
              operation.shipmentId,
              operation.payload.truckId,
              operation.idempotencyKey,
              operation.payload.dispatchedAt
            );
          }

          completed += 1;
          remaining = remaining.filter((entry) => entry.operationId !== operation.operationId);
        } catch (errorObject) {
          if (isLikelyNetworkError(errorObject)) {
            const failureText = errorObject instanceof Error ? errorObject.message : "Sync paused: still offline.";
            setError(failureText);
            break;
          }

          const failureText = errorObject instanceof Error ? errorObject.message : "Queued operation failed";
          setError(failureText);
          remaining = remaining.map((entry) => {
            if (entry.operationId !== operation.operationId) {
              return entry;
            }

            return {
              ...entry,
              attempts: entry.attempts + 1
            };
          });
        }
      }

      setOfflineQueue(remaining);

      if (completed > 0) {
        setNotice(`Synced ${completed} queued action(s).`);
        setLastSyncedAt(new Date().toISOString());
        await refreshShipments();
      }

      setSyncingQueue(false);
    },
    [accessToken, config.gatewayBaseUrl, isOnline, offlineQueue, refreshShipments, syncingQueue]
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void refreshShipments();
  }, [accessToken, refreshShipments]);

  useEffect(() => {
    if (!accessToken || !isOnline || syncingQueue || offlineQueue.length === 0) {
      return;
    }

    void flushOfflineQueue(offlineQueue);
  }, [accessToken, flushOfflineQueue, isOnline, offlineQueue, syncingQueue]);

  const claims = useMemo(() => decodeJwt(accessToken), [accessToken]);
  const userName = claims?.preferred_username ?? "guest";
  const roles = claims?.realm_access?.roles ?? [];

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => shipment.shipmentId === selectedShipmentId) ?? null,
    [selectedShipmentId, shipments]
  );

  const signIn = useCallback(async () => {
    try {
      setError(null);
      setNotice(null);
      await startLogin(config);
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Unable to start login");
    }
  }, [config]);

  const signOut = useCallback(() => {
    clearStoredAccessToken();
    setAccessToken(null);
    setShipments([]);
    setSelectedShipmentId(null);
    setOfflineQueue([]);
    writeOfflineQueue([]);
    writeShipmentCache([]);
    setNotice("Signed out.");
    setError(null);
  }, []);

  const enqueueOperation = useCallback(
    (operation: OfflineOperation): boolean => {
      if (
        operation.kind === "dispatch" &&
        offlineQueue.some((queued) => queued.kind === "dispatch" && queued.shipmentId === operation.shipmentId)
      ) {
        setNotice(`Dispatch for ${operation.shipmentId} is already queued.`);
        return false;
      }

      setOfflineQueue((previous) => [...previous, operation]);
      return true;
    },
    [offlineQueue]
  );

  const onSubmitMockScan = useCallback(async () => {
    if (!accessToken || !selectedShipment) {
      return;
    }

    setError(null);
    setNotice(null);

    const parsedQuantity = Number.parseInt(scannerQuantity, 10);
    if (!scannerValue.trim() || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError("Barcode and quantity must be valid.");
      return;
    }

    const operation: OfflineOperation = {
      operationId: `scan_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      kind: "scan",
      shipmentId: selectedShipment.shipmentId,
      idempotencyKey: `wm_scan_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: {
        barcode: scannerValue.trim(),
        quantity: parsedQuantity,
        scannedAt: new Date().toISOString()
      }
    };

    if (!isOnline) {
      if (enqueueOperation(operation)) {
        setNotice(`Queued scan ${operation.payload.barcode} x${operation.payload.quantity} while offline.`);
      }
      return;
    }

    try {
      await submitMockScan(
        config.gatewayBaseUrl,
        accessToken,
        selectedShipment.shipmentId,
        operation.payload.barcode,
        operation.payload.quantity,
        operation.idempotencyKey
      );
      setNotice(`Scanned ${operation.payload.barcode} x${operation.payload.quantity}.`);
      await refreshShipments();
    } catch (errorObject) {
      if (isLikelyNetworkError(errorObject)) {
        if (enqueueOperation(operation)) {
          setNotice(`Queued scan ${operation.payload.barcode} x${operation.payload.quantity} (network unavailable).`);
        }
        return;
      }

      setError(errorObject instanceof Error ? errorObject.message : "Scan request failed");
    }
  }, [
    accessToken,
    config.gatewayBaseUrl,
    enqueueOperation,
    isOnline,
    refreshShipments,
    scannerQuantity,
    scannerValue,
    selectedShipment
  ]);

  const onDispatchShipment = useCallback(async () => {
    if (!accessToken || !selectedShipment) {
      return;
    }

    setError(null);
    setNotice(null);

    const operation: OfflineOperation = {
      operationId: `dispatch_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      kind: "dispatch",
      shipmentId: selectedShipment.shipmentId,
      idempotencyKey: `wm_dispatch_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: {
        truckId: "truck_scr_03",
        dispatchedAt: new Date().toISOString()
      }
    };

    if (!isOnline) {
      if (enqueueOperation(operation)) {
        setNotice(`Queued dispatch for ${selectedShipment.shipmentId} while offline.`);
      }
      return;
    }

    try {
      const result = await dispatchShipment(
        config.gatewayBaseUrl,
        accessToken,
        selectedShipment.shipmentId,
        operation.payload.truckId,
        operation.idempotencyKey,
        operation.payload.dispatchedAt
      );
      setNotice(`Shipment ${result.shipmentId} dispatched. Order is now ${result.orderStatus}.`);
      setSelectedShipmentId(null);
      await refreshShipments();
    } catch (errorObject) {
      if (isLikelyNetworkError(errorObject)) {
        if (enqueueOperation(operation)) {
          setNotice(`Queued dispatch for ${selectedShipment.shipmentId} (network unavailable).`);
        }
        return;
      }

      setError(errorObject instanceof Error ? errorObject.message : "Dispatch request failed");
    }
  }, [accessToken, config.gatewayBaseUrl, enqueueOperation, isOnline, refreshShipments, selectedShipment]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Warehouse Mobile MVP</Text>
        <Text style={styles.subtitle}>PR8 Demo (Expo Web)</Text>

        {!accessToken ? (
          <SignInPanel
            onSignIn={() => {
              void signIn();
            }}
          />
        ) : (
          <>
            <SyncStatusPanel
              isOnline={isOnline}
              queueCount={offlineQueue.length}
              syncing={syncingQueue}
              lastSyncedAt={lastSyncedAt}
              onSyncNow={() => {
                void flushOfflineQueue();
              }}
            />

            <OperatorPanel
              userName={userName}
              roles={roles}
              onRefresh={() => {
                void refreshShipments();
              }}
              onSignOut={signOut}
            />

            <ShipmentsPanel
              shipments={shipments}
              loadingShipments={loadingShipments}
              selectedShipmentId={selectedShipmentId}
              onSelectShipment={setSelectedShipmentId}
            />

            <ScannerPanel
              selectedShipment={selectedShipment}
              mockScannerEnabled={E2E_MOCK_SCANNER}
              scannerValue={scannerValue}
              scannerQuantity={scannerQuantity}
              onScannerValueChange={setScannerValue}
              onScannerQuantityChange={setScannerQuantity}
              onSubmitMockScan={() => {
                void onSubmitMockScan();
              }}
              onDispatchShipment={() => {
                void onDispatchShipment();
              }}
            />
          </>
        )}

        {notice ? (
          <Text style={styles.notice} testID="warehouse-notice">
            {notice}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.error} testID="warehouse-error">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function isLikelyNetworkError(errorObject: unknown): boolean {
  const text = errorObject instanceof Error ? errorObject.message : String(errorObject);
  return (
    text.includes("Failed to fetch") ||
    text.includes("Network request failed") ||
    text.includes("Load failed") ||
    text.includes("offline")
  );
}
