import { useLocation, Link } from "wouter";
import { Home, Bell, Plus, MessageCircle, User } from "lucide-react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";

const ACTIVE_COLOR = "#FF3D9A";
const INACTIVE_COLOR = "rgba(255,255,255,0.45)";

export default function BottomNav() {
  const [location] = useLocation();
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 w-full z-50"
      style={{
        background: "rgba(10,8,18,0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,61,154,0.15)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-5 items-center w-full min-h-16 px-[clamp(4px,2vw,12px)]">
        <NavItem href="/" label={t("home")} active={isActive("/")}>
          <Home size="clamp(20px,5vw,23px)" style={{ color: isActive("/") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/") ? 2.3 : 1.7} />
        </NavItem>
        <NavItem href="/notifications" label={t("notifications")} active={isActive("/notifications")}>
          <Bell size="clamp(20px,5vw,23px)" style={{ color: isActive("/notifications") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/notifications") ? 2.3 : 1.7} />
        </NavItem>
        <div className="flex items-center justify-center min-w-0">
          <Link href="/create">
            <motion.button
              data-testid="nav-create"
              className="flex items-center justify-center rounded-full"
              style={{
                width: "clamp(48px,13vw,54px)",
                height: "clamp(48px,13vw,54px)",
                background: "linear-gradient(135deg, #FF006E, #8B00FF)",
                boxShadow: "0 0 24px rgba(255,0,110,0.5), 0 4px 16px rgba(0,0,0,0.3)",
              }}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
            >
              <Plus size="clamp(22px,6vw,26px)" className="text-white" strokeWidth={2.8} />
            </motion.button>
          </Link>
        </div>
        <NavItem href="/messages" label={t("messages")} active={isActive("/messages")}>
          <div className="relative">
            <MessageCircle size="clamp(20px,5vw,23px)" style={{ color: isActive("/messages") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/messages") ? 2.3 : 1.7} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)" }}>3</span>
          </div>
        </NavItem>
        <NavItem href="/profile" label={t("profile")} active={isActive("/profile")}>
          <User size="clamp(20px,5vw,23px)" style={{ color: isActive("/profile") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/profile") ? 2.3 : 1.7} />
        </NavItem>
      </div>
    </nav>
  );
}

function NavItem({ href, label, active, children }: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="min-w-0 w-full">
      <motion.button
        className="flex w-full min-w-0 flex-col items-center gap-0.5 py-1 relative"
        whileTap={{ scale: 0.88 }}
      >
        {children}
        <span className="max-w-full truncate px-1 text-[clamp(8px,2.3vw,10px)] font-medium" style={{ color: active ? ACTIVE_COLOR : "rgba(255,255,255,0.38)" }}>
          {label}
        </span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{
          background: ACTIVE_COLOR,
          opacity: active ? 1 : 0,
          transform: "translateX(-50%) scale(" + (active ? 1 : 0) + ")",
          transition: "opacity 0.15s ease, transform 0.15s ease",
        }} />
      </motion.button>
    </Link>
  );
}
