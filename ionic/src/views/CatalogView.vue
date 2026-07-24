<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ t("catalogNav") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="filtersOpen = true">
            <ion-icon :icon="options" slot="icon-only" />
            <ion-badge v-if="activeFilterCount()" color="primary" class="filter-badge">{{ activeFilterCount() }}</ion-badge>
          </ion-button>
        </ion-buttons>
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

    <!-- Filters -->
    <ion-modal :is-open="filtersOpen" @did-dismiss="filtersOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ t("filters") }}</ion-title>
          <ion-buttons slot="end"><ion-button @click="filtersOpen = false">{{ t("close") }}</ion-button></ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-list :inset="true">
          <ion-item>
            <ion-select :label="t('allWorks')" :value="state.filters.series" interface="action-sheet"
                        @ion-change="setFilter('series', $event.detail.value)">
              <ion-select-option value="">{{ t("allWorks") }}</ion-select-option>
              <ion-select-option v-for="o in opts.series" :key="o.value" :value="o.value">
                {{ o.label }} ({{ o.count }})
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select :label="t('allProductLines')" :value="state.filters.grade" interface="action-sheet"
                        @ion-change="setFilter('grade', $event.detail.value)">
              <ion-select-option value="">{{ t("allProductLines") }}</ion-select-option>
              <ion-select-option v-for="o in opts.grade" :key="o.value" :value="o.value">
                {{ o.label }} ({{ o.count }})
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select :label="t('releaseYear')" :value="state.filters.year" interface="action-sheet"
                        @ion-change="setFilter('year', $event.detail.value)">
              <ion-select-option value="">{{ t("allYears") }}</ion-select-option>
              <ion-select-option v-for="o in opts.year" :key="o.value" :value="o.value">
                {{ o.label }} ({{ o.count }})
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select :label="t('limitedStatus')" :value="state.filters.limited" interface="popover"
                        @ion-change="setFilter('limited', $event.detail.value)">
              <ion-select-option value="">—</ion-select-option>
              <ion-select-option v-for="o in opts.limited" :key="o.value" :value="o.value">
                {{ o.label }} ({{ o.count }})
              </ion-select-option>
            </ion-select>
          </ion-item>
        </ion-list>

        <ion-list :inset="true">
          <ion-item>
            <ion-label position="stacked">{{ t("priceRange") }}</ion-label>
            <div class="price-row">
              <ion-input type="number" inputmode="numeric" placeholder="min" :value="state.filters.priceMin"
                         @ion-input="setFilter('priceMin', numberOrNull($event.target.value))" />
              <span>—</span>
              <ion-input type="number" inputmode="numeric" placeholder="max" :value="state.filters.priceMax"
                         @ion-input="setFilter('priceMax', numberOrNull($event.target.value))" />
            </div>
          </ion-item>
        </ion-list>

        <ion-button expand="block" fill="clear" @click="clearFilters()">{{ t("clearFilters") }}</ion-button>
        <ion-button expand="block" @click="filtersOpen = false">{{ filtered.length }}</ion-button>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar,
  IonList, IonListHeader, IonItem, IonLabel, IonThumbnail, IonButtons, IonButton,
  IonIcon, IonBadge, IonModal, IonSelect, IonSelectOption, IonInput,
  IonInfiniteScroll, IonInfiniteScrollContent,
} from "@ionic/vue";
import { options } from "ionicons/icons";
import WorldSwitcher from "../components/WorldSwitcher.vue";
import { useStore } from "../store";
import { useDetail } from "../composables/useDetail";

const {
  state, t, name, franchiseLabel, gradeLabel, ensureFranchise, currentKits,
  setFilter, clearFilters, activeFilterCount, applyFilters, filterOptions,
} = useStore();
const { openDetail } = useDetail();

const query = ref("");
const filtersOpen = ref(false);
const pageSize = 30;
const shown = ref(pageSize);

const numberOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

// Search first, then the structured filters.
const searched = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return currentKits.value;
  return currentKits.value.filter((kit) => {
    const hay = [...Object.values(kit.names || {}), kit.grade_code, kit.number, kit.subline]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
});

const filtered = computed(() => applyFilters(searched.value));
const visible = computed(() => filtered.value.slice(0, shown.value));
// Option counts come from the world's full list, not the filtered view.
const opts = computed(() => filterOptions(currentKits.value));

function loadMore(ev) {
  shown.value += pageSize;
  ev.target.complete();
}

watch([query, () => state.franchise, () => state.filters], () => { shown.value = pageSize; }, { deep: true });
onMounted(() => ensureFranchise());
watch(() => state.franchise, () => { clearFilters(); ensureFranchise(); });
</script>

<style scoped>
.filter-badge { position: absolute; top: 2px; right: 0; font-size: 10px; }
.price-row { display: flex; align-items: center; gap: 8px; width: 100%; }
</style>
