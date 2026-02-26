import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
    // Uygulama ilk açıldığında Hoşgeldiniz sayfasına yönlendirir.
    return <Redirect href="/welcome" />;
}
