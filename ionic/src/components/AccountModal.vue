<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>{{ t("accountSync") }}</ion-title>
      <ion-buttons slot="end"><ion-button @click="$emit('close')">{{ t("close") }}</ion-button></ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <!-- Signed out: email → 6-digit code -->
    <template v-if="!signedIn">
      <ion-list :inset="true">
        <ion-item>
          <ion-input
            type="email" inputmode="email" autocomplete="email"
            :label="t('accountEmail')" label-placement="stacked"
            :value="email" @ion-input="email = $event.target.value"
          />
        </ion-item>
        <ion-item v-if="codeSent">
          <ion-input
            type="text" inputmode="numeric" maxlength="6"
            :label="t('accountCode')" label-placement="stacked"
            :value="code" @ion-input="code = $event.target.value"
          />
        </ion-item>
      </ion-list>

      <ion-button v-if="!codeSent" expand="block" :disabled="busy || !email" @click="sendCode">
        {{ t("accountSendCode") }}
      </ion-button>
      <template v-else>
        <ion-button expand="block" :disabled="busy || code.length < 6" @click="verify">
          {{ t("accountVerify") }}
        </ion-button>
        <ion-button expand="block" fill="clear" :disabled="busy" @click="sendCode">
          {{ t("accountSendCode") }}
        </ion-button>
      </template>
    </template>

    <!-- Signed in -->
    <template v-else>
      <ion-list :inset="true">
        <ion-item>
          <ion-label>{{ t("accountSignedInAs") }}</ion-label>
          <ion-note slot="end">{{ email }}</ion-note>
        </ion-item>
        <ion-item v-if="workspace?.inviteCode">
          <ion-label>{{ t("workspaceInviteCode") }}</ion-label>
          <ion-note slot="end">{{ workspace.inviteCode }}</ion-note>
        </ion-item>
      </ion-list>

      <ion-button expand="block" :disabled="busy" @click="syncNow">{{ t("syncNow") }}</ion-button>

      <ion-list :inset="true" v-if="!workspace">
        <ion-item>
          <ion-input :label="t('workspaceJoin')" label-placement="stacked"
                     :value="invite" @ion-input="invite = $event.target.value" />
        </ion-item>
      </ion-list>
      <ion-button v-if="!workspace" expand="block" fill="outline" :disabled="busy || !invite" @click="join">
        {{ t("workspaceJoin") }}
      </ion-button>
      <ion-button v-if="!workspace" expand="block" fill="clear" :disabled="busy" @click="create">
        {{ t("workspaceCreate") }}
      </ion-button>

      <ion-button expand="block" fill="clear" color="danger" :disabled="busy" @click="doSignOut">
        {{ t("accountSignOut") }}
      </ion-button>
    </template>

    <p v-if="message" class="msg">{{ message }}</p>
  </ion-content>
</template>

<script setup>
import { ref } from "vue";
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonList, IonItem, IonLabel, IonNote, IonInput,
} from "@ionic/vue";
import { useStore } from "../store";
import {
  isSignedIn, currentUserEmail, requestEmailCode, verifyEmailCode, signOut,
  pullState, pushState, createWorkspace, joinWorkspace,
} from "../services/sync";

defineEmits(["close"]);
const { t, syncPull, syncPush } = useStore();

const signedIn = ref(isSignedIn());
const email = ref(currentUserEmail() || "");
const code = ref("");
const invite = ref("");
const codeSent = ref(false);
const busy = ref(false);
const message = ref("");
const workspace = ref(null);

async function run(fn, okMsg = "") {
  busy.value = true;
  message.value = "";
  try {
    await fn();
    if (okMsg) message.value = okMsg;
  } catch (e) {
    message.value = String(e.message || e);
  } finally {
    busy.value = false;
  }
}

const sendCode = () => run(async () => {
  await requestEmailCode(email.value.trim());
  codeSent.value = true;
});

const verify = () => run(async () => {
  await verifyEmailCode(email.value.trim(), code.value.trim());
  signedIn.value = isSignedIn();
  email.value = currentUserEmail() || email.value;
  await refresh();
});

const syncNow = () => run(async () => {
  await syncPush();
  await refresh();
}, t("syncNow"));

const create = () => run(async () => {
  const res = await createWorkspace(email.value.split("@")[0]);
  workspace.value = res?.workspace || res;
  await refresh();
});

const join = () => run(async () => {
  const res = await joinWorkspace(invite.value.trim(), email.value.split("@")[0]);
  workspace.value = res?.workspace || res;
  await refresh();
});

const doSignOut = () => run(async () => {
  signOut();
  signedIn.value = false;
  workspace.value = null;
  code.value = "";
  codeSent.value = false;
});

// Pull remote state and merge it into the local collection.
async function refresh() {
  const remote = await pullState();
  workspace.value = remote?.workspace || workspace.value;
  syncPull(remote);
}

if (isSignedIn()) refresh().catch((e) => { message.value = String(e.message || e); });
</script>

<style scoped>
.msg { margin-top: 12px; color: var(--ion-color-medium); font-size: 13px; text-align: center; }
</style>
