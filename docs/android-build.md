# Android build

The web app is the source of truth. The Capacitor shell points straight at the
live GitHub Pages deployment (`server.url` in capacitor.config.json), so an
installed APK picks up every app-code and data update automatically — no
reinstall needed. The service worker caches the app after first launch, so it
keeps working offline. The staged `www/` folder (built by
`scripts/prepare_android_www.mjs`) is only a fallback bundle required by the
Capacitor tooling.

Reinstalling from the release link is only needed when the native shell itself
changes (icon, splash screen, Capacitor version).

## Cloud build (no local setup)

Run the **Build Android APK** workflow from the GitHub Actions tab
(`.github/workflows/android-apk.yml`). It stages the web assets, generates the
Capacitor Android project, builds a debug APK, and uploads it both as a run
artifact and to the `android-latest` release, so the newest APK is always at:

https://github.com/mdefitko777/Gunpula/releases/tag/android-latest

Download `gunpula-debug.apk` on the phone and install it directly (allow
unknown sources).

## Local build

1. Install Android Studio and open it once so the Android SDK is installed.
2. Run `npm install` once to get the Capacitor CLI.
3. Run `npm run android:add` once to create the local `android/` project.
4. Run `npm run android:sync` after web app or data changes.
5. Run `npm run android:build` to build a debug APK at `android/app/build/outputs/apk/debug/`.

The generated `www/` and `android/` folders are build outputs and stay
untracked. Keep the PWA deploy as the daily shared version.
