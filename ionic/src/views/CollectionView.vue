<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ t("collectionNav") }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment :key="tab" :value="tab" @ion-change="setCollectionTab($event.detail.value)">
          <ion-segment-button value="wanted">
            <ion-label>{{ t("wantedList") }} ({{ wantedIds.length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="owned">
            <ion-label>{{ t("ownedList") }} ({{ ownedIds.length }})</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="!kits.length" class="empty ion-padding">{{ t("homeCollectionEmpty") }}</div>
      <ion-list v-else lines="full">
        <ion-item v-for="kit in kits" :key="kit.kit_id" button @click="openDetail(kit)">
          <ion-thumbnail slot="start" v-if="kit.images?.box_art_url">
            <img :src="kit.images.box_art_url" :alt="name(kit)" loading="lazy" />
          </ion-thumbnail>
          <ion-label>
            <h2>{{ name(kit) }}</h2>
            <p>{{ franchiseLabel(kit.franchise) }} · {{ gradeLabel(kit.grade_code) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSegment, IonSegmentButton,
  IonList, IonItem, IonLabel, IonThumbnail,
} from "@ionic/vue";
import { useStore } from "../store";
import { useDetail } from "../composables/useDetail";

const { state, t, name, franchiseLabel, gradeLabel, ownedIds, wantedIds, ensureAllFranchises, kitById, setCollectionTab } = useStore();
const { openDetail } = useDetail();

// Tab lives in the store so the radial/swipe gestures drive the same state.
const tab = computed(() => state.collectionTab);
// Collection spans all worlds, so resolve ids against every franchise.
const kits = computed(() =>
  (tab.value === "owned" ? ownedIds.value : wantedIds.value).map(kitById).filter(Boolean),
);

// Need every franchise loaded to resolve arbitrary collection ids to kits.
onMounted(ensureAllFranchises);
</script>

<style scoped>
.empty { color: var(--ion-color-medium); text-align: center; margin-top: 40px; }
</style>
