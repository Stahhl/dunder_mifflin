import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
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
  buttonDisabled: {
    opacity: 0.45
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
