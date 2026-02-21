import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

type SyncStatusPanelProps = {
  isOnline: boolean;
  queueCount: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  onSyncNow: () => void;
};

export function SyncStatusPanel({ isOnline, queueCount, syncing, lastSyncedAt, onSyncNow }: SyncStatusPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Sync</Text>
      <Text style={styles.bodyText} testID="warehouse-sync-status">
        {isOnline ? "Online" : "Offline"}
      </Text>
      <Text style={styles.bodyText} testID="warehouse-queue-count">
        {queueCount} queued action(s)
      </Text>
      <Text style={styles.bodyText} testID="warehouse-last-synced">
        Last synced: {lastSyncedAt ?? "never"}
      </Text>
      <Pressable
        style={[styles.secondaryButton, (!isOnline || syncing || queueCount === 0) ? styles.buttonDisabled : null]}
        onPress={onSyncNow}
        disabled={!isOnline || syncing || queueCount === 0}
        testID="warehouse-sync-now-btn"
      >
        <Text style={styles.secondaryButtonText}>{syncing ? "Syncing..." : "Sync now"}</Text>
      </Pressable>
    </View>
  );
}
