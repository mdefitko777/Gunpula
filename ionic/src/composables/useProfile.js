import { reactive } from "vue";

// Shared open-state for the profile drawer, driving one declarative <ion-modal>.
export const profileState = reactive({ open: false });

export function useProfile() {
  return {
    profileState,
    openProfile: () => { profileState.open = true; },
    closeProfile: () => { profileState.open = false; },
  };
}
