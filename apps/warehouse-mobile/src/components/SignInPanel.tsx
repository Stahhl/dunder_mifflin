import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

type SignInPanelProps = {
  onSignIn: () => void;
};

export function SignInPanel({ onSignIn }: SignInPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Sign In</Text>
      <Text style={styles.bodyText}>Use warehouse credentials (`dphilbin` / `password`).</Text>
      <Pressable style={styles.primaryButton} onPress={onSignIn} testID="warehouse-sign-in-btn">
        <Text style={styles.primaryButtonText}>Sign in with Keycloak</Text>
      </Pressable>
    </View>
  );
}
