<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ worldText(worldConfig().title) }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openProfile"><ion-icon :icon="personCircle" slot="icon-only" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <world-switcher />
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <p class="world-lead ion-padding">{{ worldText(worldConfig().lead) }}</p>

      <div v-if="state.error" class="ion-padding">加载失败：{{ state.error }}</div>
      <ion-list v-else lines="full">
        <ion-list-header>
          <ion-label>{{ franchiseLabel(state.franchise) }} · {{ kits.length }}</ion-label>
        </ion-list-header>
        <ion-item v-for="kit in preview" :key="kit.kit_id" button @click="openDetail(kit)">
          <ion-thumbnail slot="start" v-if="kit.images?.box_art_url">
            <img :src="kit.images.box_art_url" :alt="name(kit)" loading="lazy" />
          </ion-thumbnail>
          <ion-label>
            <h2>{{ name(kit) }}</h2>
            <p>{{ gradeLabel(kit.grade_code) }} · {{ kit.release_date || "—" }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { computed, watch, onMounted } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonListHeader, IonItem, IonLabel, IonThumbnail,
} from "@ionic/vue";
import { personCircle } from "ionicons/icons";
import WorldSwitcher from "../components/WorldSwitcher.vue";
import { useStore } from "../store";
import { useDetail } from "../composables/useDetail";
import { useProfile } from "../composables/useProfile";

const { state, name, franchiseLabel, gradeLabel, worldText, worldConfig, ensureFranchise, currentKits } = useStore();
const { openDetail } = useDetail();
const { openProfile } = useProfile();

const kits = currentKits;
const preview = computed(() => kits.value.slice(0, 40));

onMounted(() => ensureFranchise());
watch(() => state.franchise, () => ensureFranchise());
</script>

<style scoped>
.world-lead {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 14px;
}
</style>
