import { reactive } from "vue";

// Shared detail state driving a single declarative <ion-modal> in App.vue.
// Declarative is-open is the reliable way to render Vue content in an Ionic
// modal (modalController.create doesn't carry the app context cleanly here).
const RECENT_KEY = "gunpula-catalog-recent-viewed-v1";

export const detailState = reactive({ kit: null, open: false });

function recordRecent(kitId) {
  try {
    const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const next = [kitId, ...prev.filter((id) => id !== kitId)].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // recent list is a convenience; never let it break opening the detail
  }
}

export function useDetail() {
  function openDetail(kit) {
    if (!kit) return;
    recordRecent(kit.kit_id);
    detailState.kit = kit;
    detailState.open = true;
  }
  function closeDetail() {
    detailState.open = false;
  }
  return { openDetail, closeDetail, detailState };
}
