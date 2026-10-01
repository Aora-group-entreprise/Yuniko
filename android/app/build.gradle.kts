plugins {
    id("com.android.application")
}

android {
    namespace = "com.aora.yuniko"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.aora.yuniko"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        val webUrl = providers.gradleProperty("yunikoWebUrl").orElse("").get()
        buildConfigField("String", "YUNIKO_WEB_URL", "\"" + webUrl + "\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
