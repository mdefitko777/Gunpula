<template>
  <ion-modal :is-open="accountState.open" @did-dismiss="accountState.open = false">
    <account-modal v-if="accountState.open" @close="accountState.open = false" />
  </ion-modal>
</template>

<script setup>
import { IonModal } from "@ionic/vue";
import { accountState } from "../composables/useAccount";
import AccountModal from "./AccountModal.vue";
</script>
