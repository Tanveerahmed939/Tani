export const theme = {
  color: {
    surface: "#F9F8F6",
    onSurface: "#1C1B1A",
    surfaceSecondary: "#FFFFFF",
    onSurfaceSecondary: "#1C1B1A",
    surfaceTertiary: "#EAE7E1",
    onSurfaceTertiary: "#4A4846",
    surfaceInverse: "#1C1B1A",
    onSurfaceInverse: "#FFFFFF",
    brand: "#D35400",
    brandSecondary: "#E67E22",
    brandTertiary: "#FAD7A1",
    onBrand: "#FFFFFF",
    success: "#27AE60",
    onSuccess: "#FFFFFF",
    warning: "#F39C12",
    onWarning: "#FFFFFF",
    error: "#C0392B",
    onError: "#FFFFFF",
    info: "#7F8C8D",
    border: "#EAE7E1",
    borderStrong: "#D5D2CC",
    muted: "#8A8785",
    // WhatsApp-ish chat colors for simulator
    chatBg: "#ECE5DD",
    chatBubbleIn: "#FFFFFF",
    chatBubbleOut: "#DCF8C6",
    chatHeader: "#075E54",
    chatHeaderText: "#FFFFFF",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    // System font stack; strict weight 400/500 per guidelines
    regular: "400" as const,
    medium: "500" as const,
    size: { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30 },
  },
};

export type Theme = typeof theme;
