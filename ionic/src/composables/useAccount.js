import { reactive } from "vue";

export const accountState = reactive({ open: false });

export function useAccount() {
  return {
    accountState,
    openAccount: () => { accountState.open = true; },
    closeAccount: () => { accountState.open = false; },
  };
}
