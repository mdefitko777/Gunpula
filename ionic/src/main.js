import { createApp } from "vue";
import { IonicVue } from "@ionic/vue";
import App from "./App.vue";
import router from "./router";

// Ionic core + the light/dark theme variables. These give the native-quality
// component styling; the app's own look layers on top via theme/variables.css.
import "@ionic/vue/css/core.css";
import "@ionic/vue/css/normalize.css";
import "@ionic/vue/css/structure.css";
import "@ionic/vue/css/typography.css";
import "@ionic/vue/css/padding.css";
import "@ionic/vue/css/flex-utils.css";
import "@ionic/vue/css/display.css";

// Dark mode via a class toggled on <html> (.ion-palette-dark), so the app can
// offer light / dark / auto rather than only following the system.
import "@ionic/vue/css/palettes/dark.class.css";
import "./theme/variables.css";

import { applyTheme, applyWorldTheme } from "./store";

applyTheme();
applyWorldTheme();

const app = createApp(App).use(IonicVue).use(router);

router.isReady().then(() => app.mount("#app"));

// PWA: register the service worker relative to the deploy path so it works both
// at the site root in dev and under /Gunpula/app/ in production.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // offline support is an enhancement; never block startup on it
    });
  });
}
