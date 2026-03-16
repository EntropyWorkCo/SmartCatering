import Colors from "@/constants/Colors"; //tema renklerini tutan dosya
import { useResolvedTheme } from "@/lib/store/themeStore"; // kullanıcının light-dark tamasını döndürür
import { MaterialIcons } from '@expo/vector-icons'; // Google Material ikonlarını kullanmanı sağlar.
import { Tabs } from 'expo-router'; //Expo Router'ın Tab Navigation bileşeni.Yani alt menü oluşturur.
import React from 'react';
import { Platform } from 'react-native'; //Cihazın işletim sistemini kontrol eder:ios,android,web

export default function AdminLayout() { //Admin panelindeki tüm sayfaların layout'unu belirler.
    const theme = useResolvedTheme();
    const colors = Colors[theme];

    return (
        <Tabs backBehavior="history" //Android geri tuşunun davranışını belirler.
        screenOptions={{ //Tüm tablar için ortak ayarlar.
            tabBarActiveTintColor: colors.primary, //aktif ikon rengi
            tabBarInactiveTintColor: colors.tabIconDefault, // pasif ikon rengi
            headerShown: false, //Üst navigation header'ını kapatır.
            tabBarStyle: { //Alt menünün tasarımını belirler.
                backgroundColor: colors.surface, //Tab bar arka planı.
                borderTopWidth: 1, //Tab bar üst çizgisi.
                borderTopColor: colors.surfaceBorder,
                paddingBottom: Platform.OS === "android" ? 10 : 5,
                paddingTop: 5,  // bu ve üstündeki satır platform kontrolü android=10 , ios=5
                height: Platform.OS === "android" ? 70 : 60 // android tab bar 70px ; ios tab bar 69px. Android navigation bar farklı
            }
        }}>
            <Tabs.Screen //Her biri bir sayfayı temsil eder.
                name="dashboard"
                options={{
                    title: "Özet",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="dashboard" size={28} color={color} />
                    ),
                    tabBarShowLabel: false,
                }}
            />

            <Tabs.Screen
                name="customers"
                options={{
                    title: "Müşteriler",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="people-outline" size={28} color={color} />
                    ),
                    tabBarShowLabel: false, // icon  only. text yok
                }}
            />

            <Tabs.Screen
                name="menu"
                options={{
                    title: "Ekle",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="add-box" size={32} color={color} />
                    ),
                    tabBarShowLabel: false,
                }}
            />

            <Tabs.Screen
                name="messages"
                options={{
                    title: "Mesajlar",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="mail-outline" size={28} color={color} />
                    ),
                    tabBarShowLabel: false,
                }}
            />

            <Tabs.Screen
                name="settings"
                options={{
                    title: "Ayarlar",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="settings" size={28} color={color} />
                    ),
                    tabBarShowLabel: false,
                }}
            />


            <Tabs.Screen name="reports" options={{ href: null }} />
            <Tabs.Screen name="unit-price" options={{ href: null }} />
            <Tabs.Screen name="summary" options={{ href: null }} />
            <Tabs.Screen name="change-code" options={{ href: null }} />
        </Tabs>
    );
}
