import Colors from "@/constants/Colors"; //tema renklerini tutan dosya
import { useAuth } from "@/lib/hooks/useAuth";
import { useResolvedTheme } from "@/lib/store/themeStore"; // kullanıcının light-dark tamasını döndürür
import { supabase } from "@/lib/supabase"; //Cihazın işletim sistemini kontrol eder:ios,android,web
import { MaterialIcons } from '@expo/vector-icons'; // Google Material ikonlarını kullanmanı sağlar.
import { Tabs } from 'expo-router'; //Expo Router'ın Tab Navigation bileşeni.Yani alt menü oluşturur.
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export default function AdminLayout() { //Admin panelindeki tüm sayfaların layout'unu belirler.
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState<number>(0);

    useEffect(() => {
        if (!user?.id) return;

        const fetchUnreadCount = async () => {
            const { count, error } = await supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("is_read", false)
                .eq("is_from_admin", false); 
            
            if (!error) setUnreadCount(count || 0);
        };

        fetchUnreadCount();

        const channelName = 'admin-messages-unread-all';
        
        // Önce varsa eski kanalı temizle
        const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'messages' 
            }, (payload) => {
                console.log("Realtime message change detected for admin:", payload.eventType);
                fetchUnreadCount();
            });

        channel.subscribe((status) => {
            console.log("Admin message subscription status:", status);
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    return (
        <Tabs backBehavior="history"
        screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.tabIconDefault,
            headerShown: false,
            tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopWidth: 1,
                borderTopColor: colors.surfaceBorder,
                paddingBottom: Platform.OS === "android" ? 12 : 12,
                paddingTop: 8,
                height: Platform.OS === "android" ? 75 : 85,
            }
        }} >
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
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
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
            <Tabs.Screen name="ekstre-list" options={{ href: null }} />
            <Tabs.Screen name="month-close" options={{ href: null }} />
            <Tabs.Screen name="PreviewModalBody" options={{ href: null }} />
        </Tabs>
    );
}
