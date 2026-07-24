<template>
  <div v-if="radialState.active" class="radial-overlay">
    <div class="radial-center" :style="centerStyle">
      <span class="radial-hub" />
      <button
        v-for="(item, i) in radialState.items"
        :key="item.id"
        type="button"
        class="radial-item"
        :class="{ 'is-selected': radialState.selected === i }"
        :style="itemStyle(i)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { radialState, radialItemPosition } from "../composables/useRadial";

const centerStyle = computed(() => ({ left: `${radialState.x}px`, top: `${radialState.y}px` }));

function itemStyle(i) {
  const { dx, dy } = radialItemPosition(i, radialState.items.length);
  return { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px)` };
}
</script>

<style scoped>
.radial-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(2px);
  touch-action: none;
}

.radial-center { position: absolute; }

.radial-hub {
  position: absolute;
  left: 0;
  top: 0;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.35);
}

.radial-item {
  position: absolute;
  left: 0;
  top: 0;
  min-width: 64px;
  padding: 9px 12px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-background-color, #fff);
  color: var(--ion-text-color, #000);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
}

.radial-item.is-selected {
  background: var(--ion-color-primary);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
}
</style>
