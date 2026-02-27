import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

export default function AdminLayout() {
    return (
        <Tabs screenOptions={{
            tabBarActiveTintColor: "#74CF62",
            headerShown: false,
            tabBarStyle: {
                backgroundColor: '#fff',
                borderTopWidth: 1,
                borderTopColor: '#f1f5f9',
                paddingBottom: Platform.OS === "android" ? 10 : 5,
                paddingTop: 5,
                height: Platform.OS === "android" ? 70 : 60
            }
        }}>
            <Tabs.Screen
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
                    tabBarShowLabel: false,
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

            {/* View-Only / Hidden from Tab Bar Screens */}
            <Tabs.Screen name="reports" options={{ href: null }} />
            <Tabs.Screen name="unit-price" options={{ href: null }} />
            <Tabs.Screen name="change-code" options={{ href: null }} />
        </Tabs>
    );
}
