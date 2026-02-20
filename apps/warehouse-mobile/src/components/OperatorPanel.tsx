import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

type OperatorPanelProps = {
  userName: string;
  roles: string[];
  onRefresh: () => void;
  onSignOut: () => void;
};

export function OperatorPanel({ userName, roles, onRefresh, onSignOut }: OperatorPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Operator</Text>
      <Text style={styles.bodyText} testID="warehouse-user-label">
        Signed in as {userName}
      </Text>
      <Text style={styles.bodyText}>Roles: {roles.join(", ") || "none"}</Text>
      <View style={styles.inlineRow}>
        <Pressable style={styles.secondaryButton} onPress={onRefresh} testID="warehouse-refresh-btn">
          <Text style={styles.secondaryButtonText}>Refresh pending</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={onSignOut} testID="warehouse-sign-out-btn">
          <Text style={styles.ghostButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}
