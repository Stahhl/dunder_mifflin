import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import type { ShipmentSummary } from "../types/warehouse";
import { styles } from "../styles";

type ShipmentsPanelProps = {
  shipments: ShipmentSummary[];
  loadingShipments: boolean;
  selectedShipmentId: string | null;
  onSelectShipment: (shipmentId: string) => void;
};

export function ShipmentsPanel({
  shipments,
  loadingShipments,
  selectedShipmentId,
  onSelectShipment
}: ShipmentsPanelProps) {
  return (
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
              onPress={() => onSelectShipment(item.shipmentId)}
              testID={`shipment-${item.shipmentId}`}
              accessibilityLabel={`shipment-card-${item.orderId}`}
            >
              <Text style={styles.shipmentTitle}>
                {item.shipmentId} ({item.status})
              </Text>
              <Text style={styles.bodyText}>Order: {item.orderId}</Text>
              <Text style={styles.bodyText}>Client: {item.clientId}</Text>
              <Text style={styles.bodyText}>
                Items: {item.items.map((entry) => `${entry.sku} x${entry.quantity}`).join(", ")}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.bodyText}>No pending shipments.</Text>}
      />
    </View>
  );
}
