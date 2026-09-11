import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Home, Bell, Plus, MessageCircle, User } from "lucide-react";
import { motion } from "framer-motion";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";

const ACTIVE_COLOR = "#FF3D9A";
const INACTIVE_COLOR = "rgba(255,255,255,0.45)";

export default function BottomNav() {
  const [location] = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [newFeedPosts, setNewFeedPosts] = useState(0);
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);

  useEffect(() => {
    const onNewPosts = (event: Event) => { const count = Number((event as CustomEvent).detail ?? 0); if (Number.isFinite(count) && count > 0) setNewFeedPosts(prev => Math.min(99, prev + Math.floor(count))); };
    const onCleared = () => setNewFeedPosts(0);
    window.addEventListener("yuniko-feed-new-posts", onNewPosts); window.addEventListener("yuniko-feed-new-posts-cleared", onCleared);
    return () => { window.removeEventListener("yuniko-feed-new-posts", onNewPosts); window.removeEventListener("yuniko-feed-new-posts-cleared", onCleared); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => { try { const [messages, notifications] = await Promise.all([apiJson<{count?:number}>("/conversations/unread-count"), apiJson<{count?:number}>("/notifications/unread-count")]); if (!cancelled) { setUnreadMessages(Math.max(0, Math.floor(Number(messages?.count ?? 0)))); setUnreadNotifications(Math.max(0, Math.floor(Number(notifications?.count ?? 0)))); } } catch { if (!cancelled) { setUnreadMessages(0); setUnreadNotifications(0); } } };
    void refresh(); const timer = window.setInterval(refresh, 10000); const onVisible = () => { if (document.visibilityState === "visible") void refresh(); }; document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [location]);
  useEffect(() => { if (location.startsWith("/notifications")) { setUnreadNotifications(0); void apiJson("/notifications/read-all", {method:"PATCH"}).catch(()=>{}); } }, [location]);
  useEffect(() => { if (location.startsWith("/messages")) { setUnreadMessages(0); void apiJson("/conversations/read-all", {method:"PATCH"}).catch(()=>{}); } }, [location]);

  const handleFeedClick = () => { setNewFeedPosts(0); window.dispatchEvent(new CustomEvent("yuniko-feed-refresh")); };
  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-50 yuniko-bottom-nav yuniko-safe-bottom" style={{background:"rgba(10,8,18,0.95)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderTop:"1px solid rgba(255,61,154,0.15)"}} data-testid="bottom-nav">
      <div className="flex items-center justify-around w-full h-16 px-1 min-[360px]:px-2 sm:px-4 md:px-8">
        <NavItem href="/" label={t("home")} active={isActive("/")} onClick={handleFeedClick}><div className="relative"><Home size={22} className="max-[359px]:w-5 max-[359px]:h-5" style={{color:isActive("/")?ACTIVE_COLOR:INACTIVE_COLOR}} strokeWidth={isActive("/")?2.3:1.7}/>{newFeedPosts>0&&<Badge count={newFeedPosts} label={t("home")}/>}</div></NavItem>
        <NavItem href="/notifications" label={t("notifications")} active={isActive("/notifications")}><div className="relative"><Bell size={22} className="max-[359px]:w-5 max-[359px]:h-5" style={{color:isActive("/notifications")?ACTIVE_COLOR:INACTIVE_COLOR}} strokeWidth={isActive("/notifications")?2.3:1.7}/>{unreadNotifications>0&&<Badge count={unreadNotifications} label={t("notifications")}/>}</div></NavItem>
        <Link href="/create"><motion.button aria-label={t("create")} data-testid="nav-create" className="flex items-center justify-center w-12 h-12 min-[360px]:w-[54px] min-[360px]:h-[54px] rounded-full shrink-0" style={{background:"linear-gradient(135deg,#FF006E,#8B00FF)",boxShadow:"0 0 24px rgba(255,0,110,0.5),0 4px 16px rgba(0,0,0,0.3)"}} whileTap={{scale:.88}} whileHover={{scale:1.05}}><Plus size={24} className="text-white" strokeWidth={2.8}/></motion.button></Link>
        <NavItem href="/messages" label={t("messages")} active={isActive("/messages")}><div className="relative"><MessageCircle size={22} className="max-[359px]:w-5 max-[359px]:h-5" style={{color:isActive("/messages")?ACTIVE_COLOR:INACTIVE_COLOR}} strokeWidth={isActive("/messages")?2.3:1.7}/>{unreadMessages>0&&<Badge count={unreadMessages} label={t("unreadMessages")}/>}</div></NavItem>
        <NavItem href="/profile" label={t("profile")} active={isActive("/profile")}><User size={22} className="max-[359px]:w-5 max-[359px]:h-5" style={{color:isActive("/profile")?ACTIVE_COLOR:INACTIVE_COLOR}} strokeWidth={isActive("/profile")?2.3:1.7}/></NavItem>
      </div>
    </nav>
  );
}
function Badge({count,label}:{count:number;label:string}){return <span aria-label={`${count} ${label}`} className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full text-white text-[9px] flex items-center justify-center font-bold" style={{background:"linear-gradient(135deg,#FF006E,#8B00FF)",boxShadow:"0 2px 8px rgba(0,0,0,.35)"}}>{count>99?"99+":count}</span>}
function NavItem({href,label,active,children,onClick}:{href:string;label:string;active:boolean;children:React.ReactNode;onClick?:()=>void}){return <Link href={href}><motion.button onClick={onClick} aria-label={label} className="flex flex-col items-center justify-center gap-0 min-w-0 w-[48px] min-[360px]:w-[56px] py-1 relative shrink" whileTap={{scale:.88}}>{children}<span className="text-[9px] min-[360px]:text-[10px] font-medium max-w-full truncate" style={{color:active?ACTIVE_COLOR:"rgba(255,255,255,0.38)"}}>{label}</span><span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{background:ACTIVE_COLOR,opacity:active?1:0,transform:`translateX(-50%) scale(${active?1:0})`,transition:"opacity .15s ease,transform .15s ease"}}/></motion.button></Link>}
