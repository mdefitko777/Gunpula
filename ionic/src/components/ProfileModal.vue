<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>{{ t("userPageTitle") }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="$emit('close')">{{ t("close") }}</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
  <ion-content class="ion-padding">
    <div class="profile-head">
      <div class="avatar">{{ initial }}</div>
      <div>
        <h2>{{ displayName }}</h2>
        <p>{{ t("records", { count: ownedIds.length + wantedIds.length }) }}</p>
      </div>
    </div>

    <ion-list :inset="true">
      <ion-item button @click="goGuide">
        <ion-icon :icon="book" slot="start" />
        <ion-label>{{ t("pictureBook") }}</ion-label>
      </ion-item>
      <ion-item button @click="goCollection('owned')">
        <ion-icon :icon="checkmarkCircle" slot="start" />
        <ion-label>{{ t("ownedList") }}</ion-label>
        <ion-note slot="end">{{ ownedIds.length }}</ion-note>
      </ion-item>
      <ion-item button @click="goCollection('wanted')">
        <ion-icon :icon="star" slot="start" />
        <ion-label>{{ t("wantedList") }}</ion-label>
        <ion-note slot="end">{{ wantedIds.length }}</ion-note>
      </ion-item>
      <ion-item button :detail="true" @click="recentOpen = !recentOpen">
        <ion-icon :icon="time" slot="start" />
        <ion-label>{{ t("recentViewed") }}</ion-label>
        <ion-note slot="end">{{ recentKits.length }}</ion-note>
      </ion-item>
    </ion-list>

    <ion-list v-if="recentOpen && recentKits.length" :inset="true">
      <ion-item v-for="kit in recentKits" :key="kit.kit_id" button @click="openDetail(kit)">
        <ion-thumbnail slot="start" v-if="kit.images?.box_art_url"><img :src="kit.images.box_art_url" loading="lazy" /></ion-thumbnail>
        <ion-label><h3>{{ name(kit) }}</h3></ion-label>
      </ion-item>
    </ion-list>

    <ion-list-header><ion-label>{{ t("settings") }}</ion-label></ion-list-header>
    <ion-list :inset="true">
      <ion-item>
        <ion-select :label="t('language')" :value="state.language" interface="popover" @ion-change="setLanguage($event.detail.value)">
          <ion-select-option value="zh">简体中文</ion-select-option>
          <ion-select-option value="ko">한국어</ion-select-option>
          <ion-select-option value="en">English</ion-select-option>
          <ion-select-option value="ja">日本語</ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-select :label="t('theme')" :value="state.theme" interface="popover" @ion-change="setTheme($event.detail.value)">
          <ion-select-option value="auto">{{ t("themeAuto") }}</ion-select-option>
          <ion-select-option value="light">{{ t("themeLight") }}</ion-select-option>
          <ion-select-option value="dark">{{ t("themeDark") }}</ion-select-option>
        </ion-select>
      </ion-item>
    </ion-list>

    <ion-list :inset="true">
      <ion-item button @click="goAccount">
        <ion-icon :icon="cloudUpload" slot="start" />
        <ion-label>{{ t("accountSync") }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup>
import { ref, computed } from "vue";
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonList, IonListHeader, IonItem, IonLabel, IonNote, IonIcon, IonThumbnail,
  IonSelect, IonSelectOption,
} from "@ionic/vue";
import { book, checkmarkCircle, star, time, cloudUpload } from "ionicons/icons";
import { useRouter } from "vue-router";
import { useStore } from "../store";
import { useDetail } from "../composables/useDetail";
import { useProfile } from "../composables/useProfile";
import { useAccount } from "../composables/useAccount";

defineEmits(["close"]);
const { state, t, name, setLanguage, setTheme, ownedIds, wantedIds, kitById, ensureAllFranchises } = useStore();
const { openDetail } = useDetail();
const { closeProfile } = useProfile();
const { openAccount } = useAccount();
const router = useRouter();

// Local identity until account sync lands.
const displayName = computed(() => t("localMember"));
const initial = computed(() => "G");

const recentOpen = ref(false);
const RECENT_KEY = "gunpula-catalog-recent-viewed-v1";
const recentIds = ref(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
const recentKits = computed(() => recentIds.value.map(kitById).filter(Boolean));

ensureAllFranchises();

function goGuide() { closeProfile(); router.push("/guide"); }
function goCollection() { closeProfile(); router.push("/collection"); }
function goAccount() { closeProfile(); openAccount(); }
</script>

<style scoped>
.profile-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
.profile-head h2 { margin: 0; font-size: 20px; }
.profile-head p { margin: 2px 0 0; color: var(--ion-color-medium); font-size: 13px; }
.avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--ion-color-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 600; text-transform: uppercase;
}
</style>
