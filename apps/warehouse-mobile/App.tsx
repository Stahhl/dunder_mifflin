import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text } from "react-native";
import { fetchPendingShipments, dispatchShipment, submitMockScan } from "./src/api/warehouse-api";
import { decodeJwt } from "./src/auth/jwt";
import { completeAuthorizationCodeFlow, isAuthCallbackRoute, startLogin } from "./src/auth/oidc";
import { clearStoredAccessToken, readStoredAccessToken, storeAccessToken } from "./src/auth/session";
import { OperatorPanel } from "./src/components/OperatorPanel";
import { ScannerPanel } from "./src/components/ScannerPanel";
import { ShipmentsPanel } from "./src/components/ShipmentsPanel";
import { SignInPanel } from "./src/components/SignInPanel";
import { E2E_MOCK_SCANNER, getRuntimeConfig } from "./src/config/runtime";
import { styles } from "./src/styles";
import type { ShipmentSummary } from "./src/types/warehouse";

export default function App() {
  const config = useMemo(() => getRuntimeConfig(), []);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [scannerValue, setScannerValue] = useState("SKU:PPR-A4-WHT-500");
  const [scannerQuantity, setScannerQuantity] = useState("1");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccessToken(readStoredAccessToken());
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
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Unable to load shipments");
    } finally {
      setLoadingShipments(false);
    }
  }, [accessToken, config.gatewayBaseUrl]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void refreshShipments();
  }, [accessToken, refreshShipments]);

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
    setNotice("Signed out.");
    setError(null);
  }, []);

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

    try {
      await submitMockScan(
        config.gatewayBaseUrl,
        accessToken,
        selectedShipment.shipmentId,
        scannerValue.trim(),
        parsedQuantity
      );
      setNotice(`Scanned ${scannerValue.trim()} x${parsedQuantity}.`);
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Scan request failed");
    }
  }, [accessToken, config.gatewayBaseUrl, scannerQuantity, scannerValue, selectedShipment]);

  const onDispatchShipment = useCallback(async () => {
    if (!accessToken || !selectedShipment) {
      return;
    }

    setError(null);
    setNotice(null);

    try {
      const result = await dispatchShipment(config.gatewayBaseUrl, accessToken, selectedShipment.shipmentId, "truck_scr_03");
      setNotice(`Shipment ${result.shipmentId} dispatched. Order is now ${result.orderStatus}.`);
      setSelectedShipmentId(null);
      await refreshShipments();
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Dispatch request failed");
    }
  }, [accessToken, config.gatewayBaseUrl, refreshShipments, selectedShipment]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Warehouse Mobile MVP</Text>
        <Text style={styles.subtitle}>PR4 Demo (Expo Web)</Text>

        {!accessToken ? (
          <SignInPanel onSignIn={() => {
            void signIn();
          }} />
        ) : (
          <>
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
