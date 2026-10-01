# Yuniko Android with Capacitor

Yuniko Android is generated from the existing React/Vite application with Capacitor.

- App ID: `com.aora.yuniko`
- Web build: `artifacts/yuniko/dist/public`
- Android generation and APK compilation: GitHub Actions
- Capacitor 8.5.2
- Android minimum supported API: 24 through the Capacitor 8 Android project

The Android project is intentionally generated during CI instead of being maintained as a separate hand-written Android application. This keeps the native shell tied to the Yuniko web application and lets the project be built without a local PC.

The workflow uploads the debug APK as a GitHub Actions artifact after a successful build.
