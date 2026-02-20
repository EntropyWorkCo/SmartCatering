import { ActivityIndicator, Text, View } from "react-native";
import { useMenu } from "../../lib/hooks/useMenu";

export default function MenuScreen() {
  const { menu, loading } = useMenu();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "white" }}>
      {menu.length === 0 ? (
        <Text>Menü boş</Text>
      ) : (
        menu.map((item) => (
          <View
            key={item.id}
            style={{
              padding: 15,
              marginBottom: 10,
              backgroundColor: "#eee",
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              {item.name}
            </Text>

            <Text>{item.price} ₺</Text>
          </View>
        ))
      )}
    </View>
  );
}
