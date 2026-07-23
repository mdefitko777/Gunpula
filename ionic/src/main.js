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
import "./theme/variables.css";

const app = createApp(App).use(IonicVue).use(router);

router.isReady().then(() => app.mount("#app"));
