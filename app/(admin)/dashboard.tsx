import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { Button, FlatList, Text, View } from "react-native";

export default function Dashboard() {
  const { adisyonlar, createAdisyon } = useAdisyon();

  return (
    <View>
      <Button
        title="Yeni Adisyon Ekle"
        onPress={() =>
          createAdisyon({
            masa_no: 3,
            toplam_tutar: 250,
          })
        }
      />

      <FlatList
        data={adisyonlar}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Text>
            Masa: {item.masa_no} - Tutar: {item.toplam_tutar}
          </Text>
        )}
      />
    </View>
  );
}
