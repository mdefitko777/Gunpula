<template>
  <ion-tabs>
    <ion-router-outlet />
    <ion-tab-bar slot="bottom">
      <ion-tab-button tab="home" href="/home">
        <ion-icon :icon="home" />
        <ion-label>首页</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="catalog" href="/catalog">
        <ion-icon :icon="albums" />
        <ion-label>目录</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="recent" href="/recent">
        <ion-icon :icon="time" />
        <ion-label>最近</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="collection" href="/collection">
        <ion-icon :icon="heart" />
        <ion-label>收藏</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="guide" href="/guide">
        <ion-icon :icon="book" />
        <ion-label>图鉴</ion-label>
      </ion-tab-button>
    </ion-tab-bar>
  </ion-tabs>
</template>

<script setup>
import { IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonIcon, IonLabel } from "@ionic/vue";
import { home, albums, time, heart, book } from "ionicons/icons";
</script>
