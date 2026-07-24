<template>
  <ion-app>
    <ion-router-outlet />
    <detail-host />
    <profile-host />
  </ion-app>
</template>

<script setup>
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import DetailHost from "./components/DetailHost.vue";
import ProfileHost from "./components/ProfileHost.vue";
</script>
