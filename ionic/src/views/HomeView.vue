<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Gunpula</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">首页</ion-title>
        </ion-toolbar>
      </ion-header>

      <div v-if="error" class="ion-padding">加载失败：{{ error }}</div>
      <ion-list v-else>
        <ion-item v-for="kit in kits" :key="kit.kit_id">
          <ion-thumbnail slot="start" v-if="kit.images?.box_art_url">
            <img :src="kit.images.box_art_url" :alt="name(kit)" />
          </ion-thumbnail>
          <ion-label>
            <h2>{{ name(kit) }}</h2>
            <p>{{ kit.grade_code }} · {{ kit.release_date || "—" }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonThumbnail,
} from "@ionic/vue";
import { loadFranchise } from "../services/catalog";

const kits = ref([]);
const error = ref(null);

// Proof-of-toolchain: load a small real franchise (armored_core, ~20 records)
// so the build exercises Ionic components + async data + list rendering.
const name = (kit) => kit.names?.zh || kit.names?.ja || kit.names?.en || kit.kit_id;

onMounted(async () => {
  try {
    kits.value = await loadFranchise("armored_core");
  } catch (e) {
    error.value = String(e.message || e);
  }
});
</script>
