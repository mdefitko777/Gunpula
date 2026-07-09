# Android build

The web app is the source of truth. Capacitor wraps a staged `www/` folder
(`app/` + `data/` copied side by side by `scripts/prepare_android_www.mjs`) so
the app's relative `../data` fetches keep working inside the native shell.
When the shell is online it prefers live data from GitHub Pages and only falls
back to the bundled snapshot offline, so an installed APK stays current without
rebuilds.

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
