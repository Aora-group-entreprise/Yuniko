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

function GlobalRuntimeErrors({ children }: { children: ReactNode }) {
  const [error, setError] = useState<RuntimeError | null>(null);

  useEffect(() => {
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
