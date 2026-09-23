import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

let overlayRoot: HTMLDivElement | null = null;
let overlayUsers = 0;

function getOverlayRoot() {
  if (typeof document === "undefined") return null;

  if (!overlayRoot || !document.body.contains(overlayRoot)) {
    overlayRoot = document.createElement("div");
    overlayRoot.id = "yuniko-overlay-root";
    overlayRoot.setAttribute("data-yuniko-overlay-root", "true");
    document.body.appendChild(overlayRoot);
  }

  return overlayRoot;
}

export default function ScreenPortal({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = getOverlayRoot();
    if (!host) return;

    overlayUsers += 1;
    setRoot(host);

    return () => {
      overlayUsers = Math.max(0, overlayUsers - 1);

      // Keep one stable host during navigation. Removing it on every page
      // change can make fixed overlays inherit a different positioning context.
      // It is intentionally reused for the lifetime of the document.
    };
  }, []);

  if (!root) return null;

  return createPortal(
    <div className="yuniko-overlay-layer">{children}</div>,
    root,
  );
}
