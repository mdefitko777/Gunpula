<template>
  <ion-modal :is-open="detailState.open" @did-dismiss="detailState.open = false">
    <kit-detail-modal v-if="detailState.kit" :kit="detailState.kit" @close="detailState.open = false" />
  </ion-modal>
</template>

<script setup>
import { IonModal } from "@ionic/vue";
import { detailState } from "../composables/useDetail";
import KitDetailModal from "./KitDetailModal.vue";
</script>
