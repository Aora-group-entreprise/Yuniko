# Yuniko Android foundation

This directory is the first native Android layer for Yuniko. It is intentionally isolated from the existing React/Vite web application and Cloudflare API.

## Step 1 scope

- Native Android application project.
- Package ID: com.aora.yuniko.
- Minimum Android version: API 23 (Android 6.0).
- Native launcher activity and basic lifecycle handling.
- WebView foundation, ready to load the Yuniko web application when a production URL is supplied.
- No native media picker, camera, microphone, push notifications, deep links, or JavaScript bridge yet. Those are separate later steps.

## Build

Provide the deployed Yuniko web origin at build time. This project targets current Android Studio/Gradle 9.1:

```text
gradle assembleDebug -PyunikoWebUrl=https://your-yuniko-web-origin.example
```

If no URL is supplied, the app opens a native readiness screen instead of loading an unknown website.

## Security boundary

The WebView enables JavaScript for Yuniko, disables mixed HTTP/HTTPS content and local file/content access, and deliberately adds no native JavaScript bridge in this step.
