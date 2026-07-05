# Android build

The web app is the source of truth. Capacitor wraps the `app/` folder for Android.

1. Install Android Studio and open it once so the Android SDK is installed.
2. Run `npm run android:add` once to create the local `android/` project.
3. Run `npm run android:sync` after web app or data changes.
4. Run `npm run android:build` to build a debug APK at `android/app/build/outputs/apk/debug/`.

The generated `android/` folder is intentionally not committed yet. Keep the PWA deploy as the daily shared version, and create the Android project only on the build machine.
