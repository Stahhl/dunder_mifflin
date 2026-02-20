import { StatusBar } from "expo-status-bar";
import { sha256 } from "js-sha256";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

type ShipmentItem = {
  sku: string;
  quantity: number;
};

type ShipmentSummary = {
  shipmentId: string;
  orderId: string;
  clientId: string;
  status: string;
  requestedShipDate: string;
  createdAt: string;
  items: ShipmentItem[];
};

type ShipmentListResponse = {
  items: ShipmentSummary[];
  total: number;
};

type JwtClaims = {
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
};

const E2E_MOCK_SCANNER = process.env.EXPO_PUBLIC_E2E_MOCK_SCANNER !== "false";

function getRuntimeConfig() {
  if (typeof window === "undefined") {
    return {
      gatewayBaseUrl: process.env.EXPO_PUBLIC_GATEWAY_BASE_URL ?? "http://localhost:8081",
      keycloakBaseUrl: process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL ?? "http://localhost:8080",
      realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? "scranton-branch",
      clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? "warehouse-mobile"
    };
  }

  const hostname = window.location.hostname || "localhost";

  return {
    gatewayBaseUrl: process.env.EXPO_PUBLIC_GATEWAY_BASE_URL ?? `http://${hostname}:8081`,
    keycloakBaseUrl: process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL ?? `http://${hostname}:8080`,
    realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? "scranton-branch",
    clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? "warehouse-mobile"
  };
}

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
    if (typeof window === "undefined") {
      return;
    }

    const token = window.localStorage.getItem("warehouse_mobile_access_token");
    if (token) {
      setAccessToken(token);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname !== "/auth/callback") {
      return;
    }

    completeAuthorizationCodeFlow(config)
      .then((token) => {
        window.localStorage.setItem("warehouse_mobile_access_token", token);
        setAccessToken(token);
        setNotice("Signed in successfully.");
        setError(null);
        window.history.replaceState({}, "", "/");
      })
      .catch((errorObject) => {
        setError(errorObject instanceof Error ? errorObject.message : "Login failed");
      });
  }, [config]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void loadPendingShipments(config.gatewayBaseUrl, accessToken, setShipments, setLoadingShipments, setError);
  }, [accessToken, config.gatewayBaseUrl]);

  const claims = decodeJwt(accessToken);
  const userName = claims?.preferred_username ?? "guest";
  const roles = claims?.realm_access?.roles ?? [];

  const selectedShipment = shipments.find((shipment) => shipment.shipmentId === selectedShipmentId) ?? null;

  async function signIn() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      setError(null);
      setNotice(null);
      const { state, verifier, challenge } = await buildPkcePair();
      window.sessionStorage.setItem("warehouse_pkce_state", state);
      window.sessionStorage.setItem("warehouse_pkce_verifier", verifier);

      const redirectUri = `${window.location.origin}/auth/callback`;
      const authUrl = new URL(`${config.keycloakBaseUrl}/realms/${config.realm}/protocol/openid-connect/auth`);
      authUrl.searchParams.set("client_id", config.clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      window.location.assign(authUrl.toString());
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Unable to start login");
    }
  }

  function signOut() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("warehouse_mobile_access_token");
    }
    setAccessToken(null);
    setShipments([]);
    setSelectedShipmentId(null);
    setNotice("Signed out.");
    setError(null);
  }

  async function refreshShipments() {
    if (!accessToken) {
      return;
    }

    await loadPendingShipments(config.gatewayBaseUrl, accessToken, setShipments, setLoadingShipments, setError);
  }

  async function submitMockScan() {
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

    const response = await fetch(`${config.gatewayBaseUrl}/api/v1/warehouse/shipments/${encodeURIComponent(selectedShipment.shipmentId)}/scan`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        barcode: scannerValue.trim(),
        quantity: parsedQuantity
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error?.message ?? "Scan request failed");
      return;
    }

    setNotice(`Scanned ${scannerValue.trim()} x${parsedQuantity}.`);
  }

  async function dispatchSelectedShipment() {
    if (!accessToken || !selectedShipment) {
      return;
    }

    setError(null);
    setNotice(null);

    const idempotencyKey = `wm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const response = await fetch(
      `${config.gatewayBaseUrl}/api/v1/warehouse/shipments/${encodeURIComponent(selectedShipment.shipmentId)}/dispatch`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          truckId: "truck_scr_03",
          dispatchedAt: new Date().toISOString()
        })
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error?.message ?? "Dispatch request failed");
      return;
    }

    setNotice(`Shipment ${payload.shipmentId} dispatched. Order is now ${payload.orderStatus}.`);
    setSelectedShipmentId(null);
    await refreshShipments();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Warehouse Mobile MVP</Text>
        <Text style={styles.subtitle}>PR4 Demo (Expo Web)</Text>

        {!accessToken ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Sign In</Text>
            <Text style={styles.bodyText}>Use warehouse credentials (`dphilbin` / `password`).</Text>
            <Pressable style={styles.primaryButton} onPress={signIn} testID="warehouse-sign-in-btn">
              <Text style={styles.primaryButtonText}>Sign in with Keycloak</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Operator</Text>
              <Text style={styles.bodyText} testID="warehouse-user-label">
                Signed in as {userName}
              </Text>
              <Text style={styles.bodyText}>Roles: {roles.join(", ") || "none"}</Text>
              <View style={styles.inlineRow}>
                <Pressable style={styles.secondaryButton} onPress={refreshShipments} testID="warehouse-refresh-btn">
                  <Text style={styles.secondaryButtonText}>Refresh pending</Text>
                </Pressable>
                <Pressable style={styles.ghostButton} onPress={signOut} testID="warehouse-sign-out-btn">
                  <Text style={styles.ghostButtonText}>Sign out</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Pending Shipments</Text>
              {loadingShipments ? <ActivityIndicator size="small" /> : null}
              <Text style={styles.bodyText} testID="warehouse-shipment-count">
                {shipments.length} pending shipment(s)
              </Text>
              <FlatList
                data={shipments}
                keyExtractor={(item) => item.shipmentId}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const selected = item.shipmentId === selectedShipmentId;
                  return (
                    <Pressable
                      style={[styles.shipmentCard, selected ? styles.shipmentCardSelected : null]}
                      onPress={() => setSelectedShipmentId(item.shipmentId)}
                      testID={`shipment-${item.shipmentId}`}
                      accessibilityLabel={`shipment-card-${item.orderId}`}
                    >
                      <Text style={styles.shipmentTitle}>{item.shipmentId} ({item.status})</Text>
                      <Text style={styles.bodyText}>Order: {item.orderId}</Text>
                      <Text style={styles.bodyText}>Client: {item.clientId}</Text>
                      <Text style={styles.bodyText}>Items: {item.items.map((entry) => `${entry.sku} x${entry.quantity}`).join(", ")}</Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={<Text style={styles.bodyText}>No pending shipments.</Text>}
              />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Scanner</Text>
              {!selectedShipment ? (
                <Text style={styles.bodyText}>Select a shipment to scan and dispatch.</Text>
              ) : (
                <>
                  <Text style={styles.bodyText}>Selected: {selectedShipment.shipmentId}</Text>
                  {E2E_MOCK_SCANNER ? (
                    <>
                      <TextInput
                        testID="warehouse-mock-barcode"
                        value={scannerValue}
                        onChangeText={setScannerValue}
                        style={styles.input}
                        placeholder="SKU:PPR-A4-WHT-500"
                      />
                      <TextInput
                        testID="warehouse-mock-qty"
                        value={scannerQuantity}
                        onChangeText={setScannerQuantity}
                        style={styles.input}
                        keyboardType="number-pad"
                        placeholder="1"
                      />
                      <Pressable style={styles.secondaryButton} onPress={submitMockScan} testID="warehouse-mock-scan-btn">
                        <Text style={styles.secondaryButtonText}>Submit mock scan</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.bodyText}>Camera scanner integration is the next PR4 step.</Text>
                  )}

                  <Pressable
                    style={styles.primaryButton}
                    onPress={dispatchSelectedShipment}
                    testID="warehouse-dispatch-btn"
                  >
                    <Text style={styles.primaryButtonText}>Dispatch Shipment</Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}

        {notice ? <Text style={styles.notice} testID="warehouse-notice">{notice}</Text> : null}
        {error ? <Text style={styles.error} testID="warehouse-error">{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

async function loadPendingShipments(
  gatewayBaseUrl: string,
  token: string,
  setShipments: (items: ShipmentSummary[]) => void,
  setLoading: (loading: boolean) => void,
  setError: (message: string | null) => void
): Promise<void> {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch(`${gatewayBaseUrl}/api/v1/warehouse/shipments?status=PENDING`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json"
      }
    });

    const payload: ShipmentListResponse | { error?: { message?: string } } = await response.json();
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to load shipments");
      return;
    }

    setShipments((payload as ShipmentListResponse).items ?? []);
  } catch (errorObject) {
    setError(errorObject instanceof Error ? errorObject.message : "Unable to load shipments");
  } finally {
    setLoading(false);
  }
}

async function completeAuthorizationCodeFlow(config: {
  keycloakBaseUrl: string;
  realm: string;
  clientId: string;
}): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Authorization callback is only supported in browser mode");
  }

  const query = new URLSearchParams(window.location.search);
  const state = query.get("state");
  const code = query.get("code");
  const error = query.get("error");

  if (error) {
    throw new Error(`Keycloak returned error: ${error}`);
  }

  if (!state || !code) {
    throw new Error("Missing callback parameters");
  }

  const expectedState = window.sessionStorage.getItem("warehouse_pkce_state");
  const verifier = window.sessionStorage.getItem("warehouse_pkce_verifier");

  if (!expectedState || !verifier || expectedState !== state) {
    throw new Error("PKCE state validation failed");
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const tokenUrl = `${config.keycloakBaseUrl}/realms/${config.realm}/protocol/openid-connect/token`;

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("client_id", config.clientId);
  form.set("code", code);
  form.set("redirect_uri", redirectUri);
  form.set("code_verifier", verifier);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description ?? payload?.error ?? "Token exchange failed");
  }

  const accessToken = payload?.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("Token exchange returned no access token");
  }

  return accessToken;
}

async function buildPkcePair(): Promise<{ state: string; verifier: string; challenge: string }> {
  const state = randomUrlSafeString(24);
  const verifier = randomUrlSafeString(64);
  const challenge = await sha256UrlSafe(verifier);

  return { state, verifier, challenge };
}

function randomUrlSafeString(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let value = "";
  for (let index = 0; index < bytes.length; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }

  return value;
}

async function sha256UrlSafe(value: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    const digest = Uint8Array.from(sha256.array(value));
    return bufferToBase64Url(digest);
  }

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bufferToBase64Url(new Uint8Array(digest));
}

function bufferToBase64Url(input: Uint8Array): string {
  let binary = "";
  input.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeJwt(token: string | null): JwtClaims | null {
  if (!token) {
    return null;
  }

  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) {
    return null;
  }

  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3efe7"
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b"
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b"
  },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderColor: "#d6d3d1",
    borderWidth: 1,
    padding: 12,
    gap: 8
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  bodyText: {
    fontSize: 14,
    color: "#1f2937"
  },
  primaryButton: {
    backgroundColor: "#0b5cab",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#dbeafe",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontWeight: "700"
  },
  ghostButton: {
    borderColor: "#94a3b8",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center"
  },
  ghostButtonText: {
    color: "#334155",
    fontWeight: "700"
  },
  inlineRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  shipmentCard: {
    borderColor: "#d6d3d1",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    backgroundColor: "#fafaf9",
    gap: 4
  },
  shipmentCardSelected: {
    borderColor: "#0b5cab",
    backgroundColor: "#eff6ff"
  },
  shipmentTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#ffffff"
  },
  notice: {
    borderRadius: 8,
    borderColor: "#86efac",
    borderWidth: 1,
    backgroundColor: "#f0fdf4",
    color: "#166534",
    padding: 10,
    fontSize: 14
  },
  error: {
    borderRadius: 8,
    borderColor: "#fca5a5",
    borderWidth: 1,
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    padding: 10,
    fontSize: 14
  }
});
