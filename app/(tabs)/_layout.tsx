import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { useResolvedTheme } from "@/lib/store/themeStore";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { View } from "react-native";

export default function TabLayout() {
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const isCompanyOwner = !!profile?.corporate_info;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.surfaceBorder },
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerStyle: { backgroundColor: colors.background, shadowColor: 'transparent', elevation: 0 },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: 'bold' },
        headerRight: () => (
          <View style={{ marginRight: 16 }}>
            <ThemeSwitcher />
          </View>
        )
      }}
    >
      {/* Index (Yönlendirici) - Tab Bar'da görünmesin diye href: null yapıyoruz */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="order-rating"
        options={{
          href: null,
          headerShown: false
        }}
      />

      {/* Ana Sayfa (Home) */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="home" size={24} color={color} />
          ),
        }}
      />

      {/* Menü */}
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menü",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <FontAwesome name="list" size={24} color={color} />
          ),
        }}
      />

      {/* Sepet */}
      <Tabs.Screen
        name="cart"
        options={{
          title: "Sepet",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <FontAwesome name="shopping-cart" size={24} color={color} />
          ),
        }}
      />

      {/* Siparişlerim */}
      <Tabs.Screen
        name="past-orders"
        options={{
          title: "Siparişlerim",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <FontAwesome name="history" size={24} color={color} />
          ),
        }}
      />

      {/* Firma Ekranı */}
      <Tabs.Screen
        name="corporate-info"
        options={{
          title: "Firma Ekranı",
          headerShown: false,
          href: isCompanyOwner ? undefined : null,
          tabBarIcon: ({ color }) => (
            <FontAwesome name="briefcase" size={22} color={color} />
          ),
        }}
      />

      {/* Profil */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <FontAwesome name="user" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
