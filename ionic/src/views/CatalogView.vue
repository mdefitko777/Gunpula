<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ t("catalogNav") || "目录" }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <world-switcher />
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          :placeholder="t('searchPlaceholder')"
          :debounce="200"
          @ion-input="query = $event.target.value"
        />
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-list lines="full">
        <ion-list-header>
          <ion-label>{{ franchiseLabel(state.franchise) }} · {{ filtered.length }}</ion-label>
        </ion-list-header>
        <ion-item v-for="kit in visible" :key="kit.kit_id" button @click="openDetail(kit)">
          <ion-thumbnail slot="start" v-if="kit.images?.box_art_url">
            <img :src="kit.images.box_art_url" :alt="name(kit)" loading="lazy" />
          </ion-thumbnail>
          <ion-label>
            <h2>{{ name(kit) }}</h2>
            <p>{{ gradeLabel(kit.grade_code) }} · {{ kit.release_date || "—" }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
      <ion-infinite-scroll @ion-infinite="loadMore">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar,
  IonList, IonListHeader, IonItem, IonLabel, IonThumbnail,
  IonInfiniteScroll, IonInfiniteScrollContent,
} from "@ionic/vue";
import WorldSwitcher from "../components/WorldSwitcher.vue";
import { useStore } from "../store";
import { useDetail } from "../composables/useDetail";

const { state, t, name, franchiseLabel, gradeLabel, ensureFranchise, currentKits } = useStore();
const { openDetail } = useDetail();

const query = ref("");
const pageSize = 30;
const shown = ref(pageSize);

// Match across all localized names + grade + catalogue number, like the vanilla
// search does at a basic level; the weighted search index lands as a refinement.
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return currentKits.value;
  return currentKits.value.filter((kit) => {
    const hay = [
      ...Object.values(kit.names || {}),
      kit.grade_code, kit.number, kit.subline,
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
});

const visible = computed(() => filtered.value.slice(0, shown.value));

function loadMore(ev) {
  shown.value += pageSize;
  ev.target.complete();
}

watch([query, () => state.franchise], () => { shown.value = pageSize; });
onMounted(() => ensureFranchise());
watch(() => state.franchise, () => ensureFranchise());
</script>
