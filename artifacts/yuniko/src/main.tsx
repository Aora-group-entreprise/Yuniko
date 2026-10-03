import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

type RuntimeError = {
  name: string;
  message: string;
  stack: string;
  source: string;
};

function toRuntimeError(value: unknown, source: string): RuntimeError {
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: value.message || String(value),
      stack: value.stack || "",
      source,
    };
  }

  if (typeof value === "string") {
    return {
      name: "Error",
      message: value,
      stack: "",
      source,
    };
  }

  try {
    return {
      name: "Error",
      message: JSON.stringify(value),
      stack: "",
      source,
    };
  } catch {
    return {
      name: "Error",
      message: String(value),
      stack: "",
      source,
    };
  }
}

function RuntimeErrorScreen({ error, onReload }: { error: RuntimeError; onReload: () => void }) {
  const details = [
    `[YUNIKO RUNTIME ERROR]`,
    `Source: ${error.source}`,
    `Name: ${error.name}`,
    `Message: ${error.message}`,
    error.stack ? `Stack:\n${error.stack}` : "",
    `URL: ${window.location.href}`,
    `Time: ${new Date().toISOString()}`,
  ].filter(Boolean).join("\n\n");

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(details);
    } catch {
      // Clipboard access can be unavailable on older browsers.
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "24px",
        background: "#fff",
        color: "#111",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>YUNIKO • ERREUR RÉELLE</h1>
        <p style={{ margin: "0 0 20px", color: "#555" }}>
          Une erreur réelle s'est produite dans l'application. Les détails ci-dessous ne sont pas remplacés par un message générique.
        </p>

        <section
          style={{
            border: "1px solid #d33",
            borderRadius: 12,
            padding: 16,
            background: "#fff7f7",
            overflow: "auto",
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>{error.name}</strong>
          <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{error.message}</div>
        </section>

        {error.stack ? (
          <details open style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Stack trace complète</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                marginTop: 8,
                padding: 16,
                borderRadius: 12,
                background: "#f4f4f4",
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {error.stack}
            </pre>
          </details>
        ) : null}

        <p style={{ marginTop: 16, fontSize: 12, color: "#666", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          Source: {error.source}
          {"\n"}URL: {window.location.href}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <button type="button" onClick={copyDetails}>Copier les détails</button>
          <button type="button" onClick={onReload}>Recharger l'application</button>
        </div>
      </div>
    </main>
  );
}

class GlobalReactErrorBoundary extends Component<
  { children: ReactNode },
  { error: RuntimeError | null }
> {
  state = { error: null as RuntimeError | null };

  static getDerivedStateFromError(error: Error) {
    return { error: toRuntimeError(error, "React render/lifecycle") };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack = [error.stack, info.componentStack].filter(Boolean).join("\n\nReact component stack:\n");
    this.setState({
      error: {
        ...toRuntimeError(error, "React render/lifecycle"),
        stack,
      },
    });
  }

  render() {
    if (this.state.error) {
      return (
        <RuntimeErrorScreen
          error={this.state.error}
          onReload={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

async function setupPushNotifications() {\n  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;\n  try {\n    const registration = await navigator.serviceWorker.ready;\n    let permission = Notification.permission;\n    if (permission === "default") permission = await Notification.requestPermission();\n    if (permission !== "granted") return false;\n    const keyResponse = await fetch("/api/push/vapid-public-key", { credentials: "include" });\n    if (!keyResponse.ok) return false;\n    const { publicKey } = await keyResponse.json() as { publicKey: string };\n    const padded = publicKey + "=".repeat((4 - (publicKey.length % 4)) % 4);\n    const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));\n    const applicationServerKey = Uint8Array.from(raw, (char) => char.charCodeAt(0));\n    let subscription = await registration.pushManager.getSubscription();\n    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });\n    const keyToBase64Url = (name: "p256dh" | "auth") => {\n      const value = subscription!.getKey(name);\n      if (!value) throw new Error("Missing push key");\n      const bytes = new Uint8Array(value);\n      let binary = "";\n      for (const byte of bytes) binary += String.fromCharCode(byte);\n      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");\n    };\n    const response = await fetch("/api/push/subscribe", {\n      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ endpoint: subscription.endpoint, keys: { p256dh: keyToBase64Url("p256dh"), auth: keyToBase64Url("auth") } }),\n    });\n    return response.ok;\n  } catch { return false; }\n}\nfunction GlobalRuntimeErrors({ children }: { children: ReactNode }) {
  const [error, setError] = useState<RuntimeError | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(() => {
        if (Notification.permission === "granted") void setupPushNotifications();
      }).catch(() => {});
    }

    let pushPrompted = false;
    const activatePushAfterGesture = () => {
      if (pushPrompted) return;
      pushPrompted = true;
      void setupPushNotifications();
    };
    window.addEventListener("pointerdown", activatePushAfterGesture, { once: true, passive: true });
    window.addEventListener("touchstart", activatePushAfterGesture, { once: true, passive: true });

    const handleError = (event: ErrorEvent) => {
      setError(toRuntimeError(event.error ?? event.message, "window.error"));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(toRuntimeError(event.reason, "unhandled promise rejection"));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("pointerdown", activatePushAfterGesture);
      window.removeEventListener("touchstart", activatePushAfterGesture);
    };
  }, []);

  if (error) {
    return <RuntimeErrorScreen error={error} onReload={() => window.location.reload()} />;
  }

  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <GlobalReactErrorBoundary>
    <GlobalRuntimeErrors>
      <App />
    </GlobalRuntimeErrors>
  </GlobalReactErrorBoundary>,
);
