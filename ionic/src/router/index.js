import { createRouter, createWebHistory } from "@ionic/vue-router";
import TabsShell from "../views/TabsShell.vue";

// The five bottom-nav destinations mirror the current app: 首页 / 目录 / 最近 /
// 收藏 / 图鉴. 我的 (profile) opens as a modal from the header, not a tab.
const routes = [
  { path: "/", redirect: "/home" },
  {
    path: "/",
    component: TabsShell,
    children: [
      { path: "home", component: () => import("../views/HomeView.vue") },
      { path: "catalog", component: () => import("../views/CatalogView.vue") },
      { path: "recent", component: () => import("../views/RecentView.vue") },
      { path: "collection", component: () => import("../views/CollectionView.vue") },
      { path: "guide", component: () => import("../views/GuideView.vue") },
    ],
  },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
