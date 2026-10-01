package com.aora.yuniko;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(createContentView());
    }

    private View createContentView() {
        if (BuildConfig.YUNIKO_WEB_URL.isEmpty()) {
            return createSetupView();
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setWebViewClient(new WebViewClient());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " YunikoAndroid/0.1");

        webView.loadUrl(BuildConfig.YUNIKO_WEB_URL);
        return webView;
    }

    private View createSetupView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(android.view.Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundColor(Color.WHITE);

        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextColor(Color.rgb(20, 30, 45));
        title.setTextSize(28);
        title.setGravity(android.view.Gravity.CENTER);

        TextView message = new TextView(this);
        message.setText(R.string.android_foundation_ready);
        message.setTextColor(Color.rgb(90, 100, 115));
        message.setTextSize(15);
        message.setGravity(android.view.Gravity.CENTER);
        message.setPadding(0, 20, 0, 0);

        root.addView(title, new LinearLayout.LayoutParams(-1, -2));
        root.addView(message, new LinearLayout.LayoutParams(-1, -2));
        return root;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
