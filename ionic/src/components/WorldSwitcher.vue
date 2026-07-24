<template>
  <!-- Keyed on the value: ion-segment doesn't refresh its buttons' checked
       state when value changes externally (e.g. from the radial gesture). -->
  <ion-segment
    :key="state.franchise"
    :value="state.franchise"
    scrollable
    class="world-switcher"
    @ion-change="onChange"
  >
    <ion-segment-button v-for="f in franchises" :key="f" :value="f">
      <ion-label>{{ franchiseLabel(f) }}</ion-label>
    </ion-segment-button>
  </ion-segment>
</template>

<script setup>
import { IonSegment, IonSegmentButton, IonLabel } from "@ionic/vue";
import { useStore } from "../store";

// World = global filter. Switching here changes state.franchise, which every
// view reads, so the whole app re-scopes to the chosen world.
const { state, franchises, franchiseLabel, setFranchise, ensureFranchise } = useStore();

async function onChange(ev) {
  const next = ev.detail.value;
  if (!next || next === state.franchise) return;
  setFranchise(next);
  await ensureFranchise(next);
}
</script>

<style scoped>
.world-switcher {
  --background: transparent;
}
</style>
