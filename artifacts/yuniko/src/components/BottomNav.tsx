import { useLocation, Link } from "wouter";
import { Home, Search, Plus, MessageCircle, User } from "lucide-react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import ScreenPortal from "@/components/ScreenPortal";

const ACTIVE_COLOR = "#FF2FA4";
const INACTIVE_COLOR = "rgba(255,255,255,0.48)";

export default function BottomNav() {
  const [location] = useLocation();
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);

  return (
    <ScreenPortal>
      <nav
      className="fixed inset-x-0 z-50 w-full"
      style={{
        bottom: "calc(var(--yuniko-keyboard-offset, 0px) + env(safe-area-inset-bottom, 0px))",
        background: "rgba(5,5,9,0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,20,147,0.30)",
        boxShadow: "0 -6px 28px rgba(0,0,0,.38)",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-5 items-center w-full h-[68px] px-2">
        <NavItem href="/" label={t("home")} active={isActive("/")} compact>
          <Home size={25} style={{ color: isActive("/") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/") ? 2.25 : 1.7} />
        </NavItem>
        <NavItem href="/search" label="Search" active={isActive("/search")} compact>
          <Search size={25} style={{ color: isActive("/search") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={1.8} />
        </NavItem>
        <div className="flex items-center justify-center min-w-0">
          <Link href="/create">
            <motion.button
              data-testid="nav-create"
              className="flex items-center justify-center rounded-full -mt-3"
              style={{
                width: "58px",
                height: "58px",
                background: "linear-gradient(135deg, #FF1493 0%, #008CFF 100%)",
                boxShadow: "0 0 25px rgba(255,20,147,.45), 0 0 34px rgba(0,140,255,.28), 0 4px 16px rgba(0,0,0,.3)",
              }}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
            >
              <Plus size={31} className="text-white" strokeWidth={2.7} />
            </motion.button>
          </Link>
        </div>
        <NavItem href="/messages" label={t("messages")} active={isActive("/messages")} compact>
          <div className="relative">
            <MessageCircle size={25} style={{ color: isActive("/messages") ? ACTIVE_COLOR : INACTIVE_COLOR }} strokeWidth={isActive("/messages") ? 2.2 : 1.7} />
            <span className="absolute -right-1.5 -top-1.5 h-4 min-w-4 rounded-full px-1 text-[9px] font-bold text-white flex items-center justify-center" style={{ background: "linear-gradient(135deg,#FF1493,#008CFF)", boxShadow: "0 0 8px rgba(255,20,147,.35)" }}>3</span>
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

function NavItem({ href, label, active, children, compact = false }: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="min-w-0 w-full">
      <motion.button
        className={`flex w-full min-w-0 flex-col items-center justify-center relative ${compact ? "h-14" : "gap-0.5 py-1"}`}
        whileTap={{ scale: 0.88 }}
      >
        {children}
        {!compact && (
          <span className="max-w-full truncate px-1 text-[clamp(8px,2.3vw,10px)] font-medium" style={{ color: active ? ACTIVE_COLOR : "rgba(255,255,255,0.38)" }}>
            {label}
          </span>
        )}
        {!compact && (
          <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: ACTIVE_COLOR, opacity: active ? 1 : 0, transform: "translateX(-50%) scale(" + (active ? 1 : 0) + ")", transition: "opacity 0.15s ease, transform 0.15s ease" }} />
        )}
      </motion.button>
    </Link>
  );
}
