package kr.daos.driver;

import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.content.Intent;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public final class DriverActivity extends Activity {
    private static final String HOST = "daos-phone-driver.ryker6365.chatgpt.site";
    private static final String SITE = "https://" + HOST;
    private WebView web;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
            return WindowInsets.CONSUMED;
        });
        LinearLayout controls = new LinearLayout(this);
        Button login = new Button(this);
        login.setText("서버 로그인");
        login.setOnClickListener(view -> web.loadUrl(SITE + "/signin-with-chatgpt?return_to=%2Fdriver%2F"));
        Button home = new Button(this);
        home.setText("배송 작업");
        home.setOnClickListener(view -> openDriver());
        controls.addView(home);
        controls.addView(login);
        page.addView(controls);
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return bundledAsset(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme())) return false;
                if ("mailto".equals(url.getScheme())) startActivity(new Intent(Intent.ACTION_VIEW,url));
                return true;
            }
        });
        page.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(page);
        openDriver();
    }
    private void openDriver() {
        web.loadUrl(SITE + "/driver/");
    }
    private WebResourceResponse bundledAsset(Uri url) {
        if (!HOST.equals(url.getHost()) || !"https".equals(url.getScheme())) return null;
        String path = url.getPath();
        if (path == null || !path.startsWith("/driver/")) return null;
        String file = path.substring(8);
        if (file.isEmpty()) file = "index.html";
        if (!file.matches("[a-zA-Z0-9.-]+")) return null;
        String mime;
        if (file.endsWith(".html")) mime = "text/html";
        else if (file.endsWith(".mjs") || file.endsWith(".js")) mime = "text/javascript";
        else if (file.endsWith(".css")) mime = "text/css";
        else if (file.endsWith(".svg")) mime = "image/svg+xml";
        else if (file.endsWith(".webmanifest")) mime = "application/manifest+json";
        else return null;
        try {
            Map<String,String> headers = new HashMap<>();
            headers.put("Cache-Control","no-store");
            return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open("driver/" + file));
        } catch (IOException error) { return null; }
    }
}
