<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-buttons slot="end">
        <ion-button @click="$emit('close')">{{ t("close") }}</ion-button>
      </ion-buttons>
      <ion-title>{{ gradeLabel(kit.grade_code) }}</ion-title>
    </ion-toolbar>
  </ion-header>
  <ion-content class="ion-padding">
    <div class="detail-art" v-if="kit.images?.box_art_url">
      <img :src="kit.images.box_art_url" :alt="name(kit)" />
    </div>
    <h1 class="detail-name">{{ name(kit) }}</h1>
    <div class="detail-badges">
      <ion-badge color="medium">{{ franchiseLabel(kit.franchise) }}</ion-badge>
      <ion-badge color="medium">{{ gradeLabel(kit.grade_code) }}</ion-badge>
      <ion-badge v-if="kit.is_premium_bandai" color="warning">PB</ion-badge>
    </div>

    <ion-list :inset="true">
      <ion-item v-if="kit.number"><ion-label>No.</ion-label><ion-note slot="end">{{ kit.number }}</ion-note></ion-item>
      <ion-item v-if="kit.release_date"><ion-label>{{ t("releaseDateShort") }}</ion-label><ion-note slot="end">{{ kit.release_date }}</ion-note></ion-item>
      <ion-item v-if="kit.price_jpy"><ion-label>{{ t("priceLabel") }}</ion-label><ion-note slot="end">¥{{ kit.price_jpy.toLocaleString() }}</ion-note></ion-item>
      <ion-item v-if="kit.scale && kit.scale !== 'non-scale'"><ion-label>Scale</ion-label><ion-note slot="end">{{ kit.scale }}</ion-note></ion-item>
    </ion-list>

    <div class="detail-actions">
      <ion-button expand="block" :fill="status === 'owned' ? 'solid' : 'outline'" color="success" @click="toggle('owned')">
        <ion-icon :icon="checkmarkCircle" slot="start" />{{ t("ownedList") }}
      </ion-button>
      <ion-button expand="block" :fill="status === 'wanted' ? 'solid' : 'outline'" @click="toggle('wanted')">
        <ion-icon :icon="star" slot="start" />{{ t("wantedList") }}
      </ion-button>
    </div>
  </ion-content>
</template>

<script setup>
import { computed } from "vue";
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonList, IonItem, IonLabel, IonNote, IonBadge, IonIcon,
} from "@ionic/vue";
import { checkmarkCircle, star } from "ionicons/icons";
import { useStore } from "../store";

const props = defineProps({ kit: { type: Object, required: true } });
defineEmits(["close"]);
const { t, name, franchiseLabel, gradeLabel, collectionStatus, toggleCollectionStatus } = useStore();

const status = computed(() => collectionStatus(props.kit.kit_id));
function toggle(s) { toggleCollectionStatus(props.kit.kit_id, s); }
</script>

<style scoped>
.detail-art { text-align: center; margin-bottom: 12px; }
.detail-art img { max-width: 100%; max-height: 320px; border-radius: 14px; }
.detail-name { font-size: 20px; font-weight: 600; margin: 4px 0 10px; }
.detail-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.detail-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
</style>
