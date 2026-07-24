<template>
  <ion-app>
    <ion-router-outlet />
    <detail-host />
    <profile-host />
    <radial-menu />
  </ion-app>
</template>

<script setup>
import { onMounted } from "vue";
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import { useRoute } from "vue-router";
import DetailHost from "./components/DetailHost.vue";
import ProfileHost from "./components/ProfileHost.vue";
import RadialMenu from "./components/RadialMenu.vue";
import { installRadialGestures, setRadialProvider } from "./composables/useRadial";
import { useStore } from "./store";

const route = useRoute();
const {
  state, t, franchises, franchiseLabel, setFranchise, ensureFranchise,
  setRecentMode, setCollectionTab, recentModes, collectionTabs,
} = useStore();

// What the radial menu offers depends on where you are: worlds on the browsing
// screens, view modes on 最近 and 收藏.
function context() {
  const path = route.path;
  if (path.startsWith("/recent")) {
    const labels = { recent: t("recentDaysShort"), month: t("monthReleaseShort"), all: t("updatesAllShort") };
    return {
      items: recentModes.map((id) => ({ id, label: labels[id] })),
      current: state.recentMode,
      list: recentModes,
      onPick: setRecentMode,
    };
  }
  if (path.startsWith("/collection")) {
    const labels = { wanted: t("wantedList"), owned: t("ownedList") };
    return {
      items: collectionTabs.map((id) => ({ id, label: labels[id] })),
      current: state.collectionTab,
      list: collectionTabs,
      onPick: setCollectionTab,
    };
  }
  return {
    items: franchises.map((id) => ({ id, label: franchiseLabel(id) })),
    current: state.franchise,
    list: franchises,
    onPick: async (id) => { setFranchise(id); await ensureFranchise(id); },
  };
}

setRadialProvider(() => {
  const ctx = context();
  return {
    items: ctx.items,
    onPick: ctx.onPick,
    // Horizontal flick steps through the same list.
    onPage: (dir) => {
      const i = ctx.list.indexOf(ctx.current);
      const next = ctx.list[i + dir];
      if (next) ctx.onPick(next);
    },
  };
});

onMounted(installRadialGestures);
</script>
