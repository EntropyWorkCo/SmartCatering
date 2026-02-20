import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { useAdmin } from "../../lib/hooks/useAdmin";

export default function AdminLogin() {
  const router = useRouter();
  const { login } = useAdmin();

  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const handleLogin = async () => {
    const success = await login(email, accessCode);

    if (success) {
      router.push("/(admin)/dashboard");
    } else {
      alert("Hatalı giriş");
    }
  };

  return (
    <View>
      <Text>Admin Giriş</Text>

      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />

      <TextInput
        placeholder="Access Code"
        value={accessCode}
        onChangeText={setAccessCode}
      />

      <Button title="Giriş Yap" onPress={handleLogin} />
    </View>
  );
}
