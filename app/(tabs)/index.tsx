import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
  // DÜZELTME: href="/welcome" yerine href="/(tabs)/home" yapıldı.
  // Bu sayede giriş yaptıktan sonra welcome ekranına geri dönmezsin.
  return <Redirect href="/(tabs)/home" />;
}
