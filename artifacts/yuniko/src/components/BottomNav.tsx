import { useLocation, Link } from "wouter";
import { Home, Bell, Plus, MessageCircle, User } from "lucide-react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";

const ACTIVE_COLOR = "#FF3D9A";
const INACTIVE_COLOR = "rgba(255,255,255,0.45)";

export default function BottomNav() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50"
      style={{
        background: "rgba(10,8,18,0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,61,154,0.15)",
      }}
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16 px-2">
        <NavItem href="/" label={t("home")} active={isActive("/")}>
          <Home
            size={23}
            style={{ color: isActive("/") ? ACTIVE_COLOR : INACTIVE_COLOR }}
            strokeWidth={isActive("/") ? 2.3 : 1.7}
          />
        </NavItem>

        <NavItem href="/notifications" label={t("notifications")} active={isActive("/notifications")}>
          <Bell
            size={23}
            style={{ color: isActive("/notifications") ? ACTIVE_COLOR : INACTIVE_COLOR }}
            strokeWidth={isActive("/notifications") ? 2.3 : 1.7}
          />
        </NavItem>

        <Link href="/create">
          <motion.button
            data-testid="nav-create"
            className="flex items-center justify-center w-[54px] h-[54px] rounded-full"
            style={{
              background: "linear-gradient(135deg, #FF006E, #8B00FF)",
              boxShadow: "0 0 24px rgba(255,0,110,0.5), 0 4px 16px rgba(0,0,0,0.3)",
            }}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
          >
            <Plus size={26} className="text-white" strokeWidth={2.8} />
          </motion.button>
        </Link>

        <NavItem href="/messages" label={t("messages")} active={isActive("/messages")}>
          <div className="relative">
            <MessageCircle
              size={23}
              style={{ color: isActive("/messages") ? ACTIVE_COLOR : INACTIVE_COLOR }}
              strokeWidth={isActive("/messages") ? 2.3 : 1.7}
            />
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
              style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)" }}
            >
              3
            </span>
          </div>
        </NavItem>

        <NavItem href="/profile" label={t("profile")} active={isActive("/profile")}>
          <User
            size={23}
            style={{ color: isActive("/profile") ? ACTIVE_COLOR : INACTIVE_COLOR }}
            strokeWidth={isActive("/profile") ? 2.3 : 1.7}
          />
        </NavItem>
      </div>
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <motion.button
        className="flex flex-col items-center gap-0.5 min-w-[44px] py-1 relative"
        whileTap={{ scale: 0.88 }}
      >
        {children}
        <span
          className="text-[10px] font-medium"
          style={{ color: active ? ACTIVE_COLOR : "rgba(255,255,255,0.38)" }}
        >
          {label}
        </span>
        {/* Active indicator: CSS transition only — no layoutId to avoid AnimatePresence conflicts */}
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
          style={{
            background: ACTIVE_COLOR,
            opacity: active ? 1 : 0,
            transform: `translateX(-50%) scale(${active ? 1 : 0})`,
            transition: "opacity 0.15s ease, transform 0.15s ease",
          }}
        />
      </motion.button>
    </Link>
  );
}
