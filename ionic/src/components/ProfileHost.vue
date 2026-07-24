<template>
  <ion-modal :is-open="profileState.open" @did-dismiss="profileState.open = false">
    <profile-modal @close="profileState.open = false" />
  </ion-modal>
</template>

<script setup>
import { IonModal } from "@ionic/vue";
import { profileState } from "../composables/useProfile";
import ProfileModal from "./ProfileModal.vue";
</script>
