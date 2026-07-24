<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ t("recentNav") }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <world-switcher />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment :key="mode" :value="mode" @ion-change="setRecentMode($event.detail.value)">
          <ion-segment-button value="recent"><ion-label>{{ t("recentDaysShort") }}</ion-label></ion-segment-button>
          <ion-segment-button value="month"><ion-label>{{ t("monthReleaseShort") }}</ion-label></ion-segment-button>
          <ion-segment-button value="all"><ion-label>{{ t("updatesAllShort") }}</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
      <ion-toolbar v-if="mode !== 'recent'">
        <ion-select
          :value="month"
          interface="popover"
          :label="t('monthReleaseShort')"
          @ion-change="onMonth"
        >
          <ion-select-option v-for="m in months" :key="m" :value="m">{{ m }}</ion-select-option>
        </ion-select>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="!items.length" class="empty ion-padding">{{ t("noReleaseItems") }}</div>
      <ion-list v-else lines="full">
        <ion-list-header><ion-label>{{ subtitle }}</ion-label></ion-list-header>
        <ion-item v-for="kit in items" :key="kit.kit_id" button @click="openDetail(kit)">
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
import { ref, computed, watch, onMounted } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSegment, IonSegmentButton,
  IonSelect, IonSelectOption, IonList, IonListHeader, IonItem, IonLabel, IonThumbnail,
} from "@ionic/vue";
import WorldSwitcher from "../components/WorldSwitcher.vue";
import { useStore } from "../store";
import { useDetail } from "../composables/useDetail";

const {
  state, t, name, gradeLabel, ensureFranchise, ensureUpdateFeed,
  recentAddedKits, releaseMonthKits, defaultMonth, setReleaseMonth, setRecentMode,
} = useStore();
const { openDetail } = useDetail();

// Mode lives in the store so the radial/swipe gestures drive the same state.
const mode = computed(() => state.recentMode);
const month = ref("");

const months = computed(() => {
  const kits = state.catalogByFranchise[state.franchise] || [];
  return [...new Set(kits.map((k) => String(k.release_date || "").slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
});

const recent = computed(() => recentAddedKits(3));
const monthly = computed(() => releaseMonthKits(month.value));

const items = computed(() => {
  if (mode.value === "recent") return recent.value;
  if (mode.value === "month") return monthly.value;
  const seen = new Set();
  return [...recent.value, ...monthly.value].filter((k) => (seen.has(k.kit_id) ? false : seen.add(k.kit_id)));
});

const subtitle = computed(() => {
  if (mode.value === "recent") return t("recentDaysSummary", { days: 3, count: items.value.length });
  if (mode.value === "month") return t("releaseMonthSummary", { month: month.value, count: items.value.length });
  return t("updatesAllSummary", { count: items.value.length });
});

function onMonth(ev) {
  month.value = ev.detail.value;
  setReleaseMonth(month.value);
}

async function init() {
  await ensureFranchise();
  await ensureUpdateFeed();
  if (!month.value) { month.value = defaultMonth(); setReleaseMonth(month.value); }
}
onMounted(init);
watch(() => state.franchise, async () => { await ensureFranchise(); month.value = defaultMonth(); setReleaseMonth(month.value); });
</script>

<style scoped>
.empty { color: var(--ion-color-medium); text-align: center; margin-top: 40px; }
</style>
