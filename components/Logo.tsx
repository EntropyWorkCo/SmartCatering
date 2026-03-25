import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface LogoProps {
  size?: "small" | "medium" | "large";
  style?: ViewStyle;
}

export default function Logo({ size = "medium", style }: LogoProps) {
  const theme = useResolvedTheme();
  const colors = Colors[theme];

  const iconSizes = {
    small: 20,
    medium: 40,
    large: 60,
  };

  const fontSizes = {
    small: 14,
    medium: 24,
    large: 36,
  };

  const letterSpacings = {
    small: 2,
    medium: 4,
    large: 6,
  };

  return (
    <View style={[styles.container, style]}>
      {/* Icon Emblem */}
      <View style={[
        styles.iconCircle, 
        { 
          width: iconSizes[size] * 1.8, 
          height: iconSizes[size] * 1.8, 
          borderRadius: (iconSizes[size] * 1.8) / 2.5, // Squircle look
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          borderWidth: size === "large" ? 3 : 2
        }
      ]}>
        <MaterialIcons 
          name="restaurant" 
          size={iconSizes[size]} 
          color={colors.primary} 
        />
      </View>

      {/* Text Branding */}
      <View style={styles.textContainer}>
        <Text style={[
          styles.meydan, 
          { 
            fontSize: fontSizes[size], 
            color: colors.text,
            letterSpacing: letterSpacings[size]
          }
        ]}>
          MEYDAN
        </Text>
        <Text style={[
          styles.lokanta, 
          { 
            fontSize: fontSizes[size] * 0.5, 
            color: colors.primary,
            letterSpacing: letterSpacings[size] * 1.5
          }
        ]}>
          LOKANTA
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    // Dynamic shadow based on theme could be added here
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  textContainer: {
    alignItems: "center",
  },
  meydan: {
    fontWeight: "900",
    textAlign: "center",
    fontFamily: "System",
  },
  lokanta: {
    fontWeight: "600",
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: -4,
  },
});
