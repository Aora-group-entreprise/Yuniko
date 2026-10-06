import { useLocation, Link } from "wouter";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import ScreenPortal from "@/components/ScreenPortal";
import { useEffect, useState } from "react";

const ACTIVE_COLOR = "#FF2FA4";
const INACTIVE_COLOR = "rgba(255,255,255,0.48)";

export default function BottomNav({
  newPostsCount = 0,
  onHomePress,
}: {
  newPostsCount?: number;
  onHomePress?: () => void;
}) {
  const [location] = useLocation();
  const [globalNewPostsCount, setGlobalNewPostsCount] = useState(newPostsCount);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messagesBadgeCleared, setMessagesBadgeCleared] = useState(false);
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);

  useEffect(() => {
    if (location === "/") {
      setGlobalNewPostsCount(newPostsCount);
      return;
    }

    let cancelled = false;
    const getSnapshot = () => {
      try {
        const stored = sessionStorage.getItem("yuniko_feed_snapshot_at");
        if (stored) return stored;
        const now = new Date().toISOString();
        sessionStorage.setItem("yuniko_feed_snapshot_at", now);
        return now;
      } catch {
        return new Date().toISOString();
      }
    };

    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const since = getSnapshot();
        const data = await apiJson<{ newPostsCount?: number }>(
          `/posts/feed/updates?since=${encodeURIComponent(since)}`,
        );
        if (!cancelled) setGlobalNewPostsCount(Math.max(0, Number(data.newPostsCount) || 0));
      } catch {}
    };

    void check();
    const interval = window.setInterval(check, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [location, newPostsCount]);

  const displayedNewPostsCount = location === "/" ? newPostsCount : globalNewPostsCount;

  useEffect(() => {
    try { setMessagesBadgeCleared(sessionStorage.getItem("yuniko_messages_badge_cleared") === "1"); } catch {}
    if (location.startsWith("/messages")) {
      setUnreadMessages(0);
      setMessagesBadgeCleared(true);
      try { sessionStorage.setItem("yuniko_messages_badge_cleared", "1"); } catch {}
      return;
    }
    let cancelled = false;
    const checkUnreadMessages = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const data = await apiJson<{ conversations?: Array<{ unread?: number }> }>("/messages/conversations");
        if (!cancelled) {
          const total = (data.conversations ?? []).reduce((sum, conversation) => sum + Math.max(0, Number(conversation.unread) || 0), 0);
          if (total > 0) {
            setUnreadMessages(total);
            setMessagesBadgeCleared(false);
            try { sessionStorage.removeItem("yuniko_messages_badge_cleared"); } catch {}
          }
        }
      } catch {}
    };
    void checkUnreadMessages();
    const interval = window.setInterval(checkUnreadMessages, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [location]);


  return (
    <ScreenPortal>
      <nav
      className="fixed inset-x-0 z-40 w-full"
      style={{
        bottom: "calc(var(--yuniko-keyboard-offset, 0px) + env(safe-area-inset-bottom, 0px))",
        background: "rgba(5,5,9,0.97)",
        borderTop: "1px solid rgba(255,20,147,0.30)",
        boxShadow: "0 -6px 28px rgba(0,0,0,.38)",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-5 items-center w-full h-[68px] px-2">
        <NavItem
          href="/"
          label={t("home")}
          active={isActive("/")}
          compact
          onClick={location === "/" ? onHomePress : undefined}
          preventNavigation={location === "/"}
        >
          <div className="relative">
            <Home size={25} style={{ color: isActive("/") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/") ? 2.25 : 1.7} />
            {displayedNewPostsCount > 0 && (
              <span
                className="absolute -right-3 -top-2.5 min-w-4 h-4 rounded-full px-1 text-[9px] font-bold text-white flex items-center justify-center"
                style={{ background: "#FF1493", boxShadow: "0 0 8px rgba(255,20,147,.45)" }}
                aria-label={`${displayedNewPostsCount} new posts`}
              >
                1+
              </span>
            )}
          </div>
        </NavItem>
        <NavItem href="/search" label="Search" active={isActive("/search")} compact>
          <Search size={25} style={{ color: isActive("/search") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={1.8} />
        </NavItem>
        <div className="flex items-center justify-center min-w-0">
          <Link href="/create">
            <button
              data-testid="nav-create"
              style={{
                width: "58px",
                height: "58px",
                background: "linear-gradient(135deg, #FF1493 0%, #008CFF 100%)",
                boxShadow: "0 0 25px rgba(255,20,147,.45), 0 0 34px rgba(0,140,255,.28), 0 4px 16px rgba(0,0,0,.3)",
              }}
              className="flex items-center justify-center rounded-full -mt-3 active:scale-95 transition-transform duration-75"
            >
              <Plus size={31} className="text-white" strokeWidth={2.7} />
            </button>
          </Link>
        </div>
        <NavItem href="/messages" label={t("messages")} active={isActive("/messages")} compact onClick={() => {
          setUnreadMessages(0); setMessagesBadgeCleared(true);
          try { sessionStorage.setItem("yuniko_messages_badge_cleared", "1"); } catch {}
        }}>
          <div className="relative">
            <MessageCircle size={25} style={{ color: isActive("/messages") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/messages") ? 2.2 : 1.7} />
            {!messagesBadgeCleared && unreadMessages > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 h-4 min-w-4 rounded-full px-1 text-[9px] font-bold text-white flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#FF1493,#008CFF)", boxShadow: "0 0 8px rgba(255,20,147,.35)" }}
                aria-label="Nouveaux messages"
              >
                1+
              </span>
            )}
          </div>
        </NavItem>
        <NavItem href="/profile" label={t("profile")} active={isActive("/profile")} compact>
          <User size={25} style={{ color: isActive("/profile") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/profile") ? 2.1 : 1.7} />
        </NavItem>
      </div>
      </nav>
    </ScreenPortal>
  );
}

function NavItem({ href, label, active, children, compact = false, onClick, preventNavigation = false }: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
  compact?: boolean;
  onClick?: () => void;
  preventNavigation?: boolean;
}) {
  const content = (
    <>
      {children}
      {!compact && (
        <span className="max-w-full truncate px-1 text-[clamp(8px,2.3vw,10px)] font-medium" style={{ color: active ? ACTIVE_COLOR : "rgba(255,255,255,0.38)" }}>
          {label}
        </span>
      )}
      {!compact && (
        <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: ACTIVE_COLOR, opacity: active ? 1 : 0, transform: "translateX(-50%) scale(" + (active ? 1 : 0) + ")", transition: "opacity 0.15s ease, transform 0.15s ease" }} />
      )}
    </>
  );

  const className = `flex w-full min-w-0 flex-col items-center justify-center relative active:scale-[0.96] transition-transform duration-75 ${compact ? "h-14" : "gap-0.5 py-1"}`;

  if (preventNavigation) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onClick?.()}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className="min-w-0 w-full" onClick={() => onClick?.()}>
      <span className={className}>
        {content}
      </span>
    </Link>
  );
}
