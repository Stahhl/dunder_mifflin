import { Pressable, Text, TextInput, View } from "react-native";
import type { ShipmentSummary } from "../types/warehouse";
import { styles } from "../styles";

type ScannerPanelProps = {
  selectedShipment: ShipmentSummary | null;
  mockScannerEnabled: boolean;
  scannerValue: string;
  scannerQuantity: string;
  onScannerValueChange: (value: string) => void;
  onScannerQuantityChange: (value: string) => void;
  onSubmitMockScan: () => void;
  onDispatchShipment: () => void;
};

export function ScannerPanel({
  selectedShipment,
  mockScannerEnabled,
  scannerValue,
  scannerQuantity,
  onScannerValueChange,
  onScannerQuantityChange,
  onSubmitMockScan,
  onDispatchShipment
}: ScannerPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Scanner</Text>
      {!selectedShipment ? (
        <Text style={styles.bodyText}>Select a shipment to scan and dispatch.</Text>
      ) : (
        <>
          <Text style={styles.bodyText}>Selected: {selectedShipment.shipmentId}</Text>
          {mockScannerEnabled ? (
            <>
              <TextInput
                testID="warehouse-mock-barcode"
                value={scannerValue}
                onChangeText={onScannerValueChange}
                style={styles.input}
                placeholder="SKU:PPR-A4-WHT-500"
              />
              <TextInput
                testID="warehouse-mock-qty"
                value={scannerQuantity}
                onChangeText={onScannerQuantityChange}
                style={styles.input}
                keyboardType="number-pad"
                placeholder="1"
              />
              <Pressable style={styles.secondaryButton} onPress={onSubmitMockScan} testID="warehouse-mock-scan-btn">
                <Text style={styles.secondaryButtonText}>Submit mock scan</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.bodyText}>Camera scanner integration is the next PR4 step.</Text>
          )}

          <Pressable style={styles.primaryButton} onPress={onDispatchShipment} testID="warehouse-dispatch-btn">
            <Text style={styles.primaryButtonText}>Dispatch Shipment</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
