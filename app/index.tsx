import { useAuth } from "@/lib/hooks/useAuth";
import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (user) {
        // Kullanıcı giriş yapmışsa ve admin ise admin paneline yönlendir
        if (isAdmin) {
            return <Redirect href="/(admin)/dashboard" />;
        }

        // Kullanıcı normal müşteri ise ana sayfalara yönlendir
        return <Redirect href="/(tabs)" />;
    }

    // Kullanıcı giriş yapmamışsa Hoşgeldiniz sayfasına yönlendir.
    return <Redirect href="/welcome" />;
}
