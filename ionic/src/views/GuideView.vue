<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ t("pictureBook") }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <world-switcher />
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="!groups.length" class="empty ion-padding">{{ t("guideNoUnits") }}</div>

      <template v-else>
        <div class="guide-summary ion-padding">{{ summary }}</div>
        <div class="guide-grid">
          <button
            v-for="group in groups"
            :key="group.id"
            type="button"
            class="guide-card"
            :class="{ 'is-lit': progress(group).lit > 0 }"
            @click="openGroup(group)"
          >
            <span class="guide-art">
              <img v-if="group.image" :src="group.image" :alt="atlasLabel(group.labels)" loading="lazy" />
            </span>
            <strong>{{ atlasLabel(group.labels) }}</strong>
            <span class="guide-meta">
              {{ progress(group).lit }}/{{ progress(group).total }}
              <template v-if="atlasLabel(group.subtitle)"> · {{ atlasLabel(group.subtitle) }}</template>
            </span>
          </button>
        </div>
      </template>
    </ion-content>

    <!-- Group detail: the kits inside, lit when already collected -->
    <ion-modal :is-open="!!openedGroup" @did-dismiss="openedGroup = null">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ atlasLabel(openedGroup?.labels) }}</ion-title>
          <ion-buttons slot="end"><ion-button @click="openedGroup = null">{{ t("close") }}</ion-button></ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list v-if="groupKits.length" lines="full">
          <ion-item v-for="kit in groupKits" :key="kit.kit_id" button @click="openDetail(kit)">
            <ion-thumbnail slot="start" v-if="kit.images?.box_art_url">
              <img :src="kit.images.box_art_url" loading="lazy" :class="{ dim: !statusOf(kit) }" />
            </ion-thumbnail>
            <ion-label>
              <h3>{{ name(kit) }}</h3>
              <p>{{ gradeLabel(kit.grade_code) }}</p>
            </ion-label>
            <ion-icon v-if="statusOf(kit) === 'owned'" :icon="checkmarkCircle" color="success" slot="end" />
            <ion-icon v-else-if="statusOf(kit) === 'wanted'" :icon="star" color="primary" slot="end" />
          </ion-item>
        </ion-list>

        <!-- gundam timeline groups list works rather than kits -->
        <ion-list v-else-if="openedGroup?.works?.length" lines="full">
          <ion-item v-for="work in openedGroup.works" :key="work.work_id">
            <ion-thumbnail slot="start" v-if="work.image"><img :src="work.image" loading="lazy" /></ion-thumbnail>
            <ion-label><h3>{{ work.name }}</h3></ion-label>
          </ion-item>
        </ion-list>

        <!-- Beyblade X groups carry their own items (beys / parts) -->
        <ion-list v-else-if="openedGroup?.items?.length" lines="full">
          <ion-item v-for="item in openedGroup.items.slice(0, 300)" :key="item.part_id || item.series_id">
            <ion-label><h3>{{ atlasLabel(item.names) }}</h3></ion-label>
          </ion-item>
        </ion-list>

        <div v-else class="empty ion-padding">{{ t("guideNoKits") }}</div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonModal, IonButtons, IonButton,
  IonList, IonItem, IonLabel, IonThumbnail, IonIcon,
} from "@ionic/vue";
import { checkmarkCircle, star } from "ionicons/icons";
import WorldSwitcher from "../components/WorldSwitcher.vue";
import { useStore } from "../store";
import { useDetail } from "../composables/useDetail";

const {
  state, t, name, gradeLabel, atlasLabel, ensureAtlasGroups, ensureBbx, ensureFranchise,
  guideGroups, guideGroupProgress, kitById, collectionStatus,
} = useStore();
const { openDetail } = useDetail();

const openedGroup = ref(null);
const groups = computed(() => guideGroups(state.franchise));
const progress = (g) => guideGroupProgress(g);
const statusOf = (kit) => collectionStatus(kit.kit_id);

const groupKits = computed(() =>
  (openedGroup.value?.kit_ids || []).map(kitById).filter(Boolean),
);

const summary = computed(() => {
  const lit = groups.value.reduce((n, g) => n + progress(g).lit, 0);
  const total = groups.value.reduce((n, g) => n + progress(g).total, 0);
  return `${lit}/${total}`;
});

function openGroup(group) { openedGroup.value = group; }

async function init() {
  await ensureAtlasGroups();
  if (state.franchise === "beyblade") await ensureBbx();
  await ensureFranchise();
}
onMounted(init);
watch(() => state.franchise, () => { openedGroup.value = null; init(); });
</script>

<style scoped>
.empty { color: var(--ion-color-medium); text-align: center; margin-top: 40px; }
.guide-summary { color: var(--ion-color-medium); font-size: 13px; padding-bottom: 0; }
.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 12px;
}
.guide-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 0;
  border-radius: 14px;
  background: var(--ion-color-step-50, #f5f5f5);
  color: var(--ion-text-color);
  text-align: left;
}
.guide-art {
  display: block;
  aspect-ratio: 16 / 10;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ion-color-step-100, #eee);
}
.guide-art img { width: 100%; height: 100%; object-fit: contain; }
/* Un-collected groups sit back; collected ones come forward. */
.guide-card:not(.is-lit) .guide-art img { filter: grayscale(1); opacity: 0.55; }
.guide-card strong { font-size: 14px; }
.guide-meta { color: var(--ion-color-medium); font-size: 12px; }
img.dim { filter: grayscale(1); opacity: 0.5; }
</style>
