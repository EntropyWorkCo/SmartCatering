import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { Button, FlatList, Text, View } from "react-native";

export default function Dashboard() {
  const { adisyonlar, createAdisyon } = useAdisyon();

  return (
    <View style={{ padding: 20 }}>
      <Button
        title="Yeni Adisyon Ekle"
        onPress={() =>
          createAdisyon({
            total_amount: 250,
          })
        }
      />

      <FlatList
        data={adisyonlar}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text>
            Tutar: {item.total_amount} | Durum: {item.status}
          </Text>
        )}
      />
    </View>
  );
}
