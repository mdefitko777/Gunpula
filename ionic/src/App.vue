<template>
  <ion-app>
    <ion-router-outlet />
    <detail-host />
  </ion-app>
</template>

<script setup>
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import DetailHost from "./components/DetailHost.vue";
</script>
