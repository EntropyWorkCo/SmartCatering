import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";

interface LogoProps {
  size?: "small" | "medium" | "large";
  style?: ViewStyle;
}

export default function Logo({ size = "medium", style }: LogoProps) {
  const theme = useResolvedTheme();
  const colors = Colors[theme];

  const iconSizes = {
    small: 30,
    medium: 80,
    large: 120,
  };

  const fontSizes = {
    small: 12,
    medium: 30,
    large: 44,
  };

  return (
    <View style={[styles.container, style]}>
      {/* Şık Logo Kartı (Beyaz kutu görüntüsünü tasarımın parçası haline getirir) */}
      <View style={[
        styles.logoCard,
        {
          width: iconSizes[size] * 1.3,
          height: iconSizes[size] * 1.3,
          borderRadius: size === "large" ? 32 : 16,
          marginBottom: size === "large" ? 20 : 10,
        }
      ]}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={{
            width: "80%",
            height: "80%",
            resizeMode: "contain",
          }}
        />
      </View>

      {/* Metin Branding */}
      <View style={{ alignItems: "center" }}>
        <Text style={[
          styles.meydan, 
          { 
            fontSize: fontSizes[size], 
            color: colors.text,
            letterSpacing: size === "large" ? 6 : 3
          }
        ]}>
          MEYDAN
        </Text>
        <Text style={[
          styles.lokanta, 
          { 
            fontSize: fontSizes[size] * 0.35, 
            color: "#E65100", 
            letterSpacing: size === "large" ? 6 : 3,
            fontWeight: "800"
          }
        ]}>
          LOKANTA ANKARA
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
  logoCard: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  meydan: {
    fontWeight: "900",
    textAlign: "center",
  },
  lokanta: {
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: -2,
  },
});
