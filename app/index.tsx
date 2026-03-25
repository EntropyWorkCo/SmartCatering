import React from "react";
import { ActivityIndicator, View } from "react-native";

/**
 * app/index.tsx artık sadece bir geçiş noktasıdır.
 * Tüm yönlendirme mantığı app/_layout.tsx içerisine taşınmıştır.
 * Bu sayede "flickering" (ekran çakışması) önlenir.
 */
export default function Index() {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: 'transparent' }}>
            <ActivityIndicator size="large" />
        </View>
    );
}
