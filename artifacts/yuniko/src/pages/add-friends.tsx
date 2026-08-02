import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, UserCheck, UserPlus, X } from "lucide-react";
import { users, friendRequests, suggestedFriends } from "@/data/mockData";
import { t } from "@/lib/i18n";
import { formatCount } from "@/data/mockData";
import BottomNav from "@/components/BottomNav";

type Tab = "requests" | "suggested" | "search" | "sent";

export default function AddFriends() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("requests");
  const [query, setQuery] = useState("");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());

  const tabs = [
    { id: "requests" as Tab, label: t("friendRequests") },
    { id: "suggested" as Tab, label: t("suggested") },
    { id: "search" as Tab, label: t("search") },
    { id: "sent" as Tab, label: t("sent") },
  ];

  const filteredUsers = query
    ? users.filter(
        (u) =>
          u.displayName.toLowerCase().includes(query.toLowerCase()) ||
          u.username.toLowerCase().includes(query.toLowerCase())
      )
    : users;

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{
          background: "rgba(13,11,20,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="add-friends-header"
      >
        <button onClick={() => setLocation("/")} data-testid="btn-back-add-friends">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white flex-1">{t("addFriends")}</h1>
      </header>

      {/* Tabs */}
      <div
        className="flex px-4 py-2 gap-1 overflow-x-auto no-scrollbar"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              background: tab === tabItem.id ? "linear-gradient(135deg, #FF006E, #8B00FF)" : "rgba(255,255,255,0.07)",
              color: tab === tabItem.id ? "white" : "rgba(255,255,255,0.5)",
            }}
            data-testid={`friends-tab-${tabItem.id}`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Search tab */}
      {tab === "search" && (
        <div className="px-4 py-3">
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl mb-4"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Search size={16} className="text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchUsers")}
              className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30"
              autoFocus
              data-testid="input-search-friends"
            />
            {query && <button onClick={() => setQuery("")}><X size={14} className="text-white/40" /></button>}
          </div>
          {filteredUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSent={sentIds.has(user.id)}
              onNavigate={() => setLocation(`/user/${user.id}`)}
              onAction={() => {
                const next = new Set(sentIds);
                if (sentIds.has(user.id)) next.delete(user.id);
                else next.add(user.id);
                setSentIds(next);
              }}
            />
          ))}
        </div>
      )}

      {/* Friend requests tab */}
      {tab === "requests" && (
        <div className="px-4 py-3">
          {friendRequests.filter((r) => !declinedIds.has(r.user.id)).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <UserCheck size={40} className="text-white/20" />
              <p className="text-white/40 text-sm">No friend requests</p>
            </div>
          ) : (
            friendRequests
              .filter((r) => !declinedIds.has(r.user.id))
              .map(({ user, mutualFriends }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  data-testid={`friend-request-${user.id}`}
                >
                  <button onClick={() => setLocation(`/user/${user.id}`)}>
                    <img src={user.avatar} alt={user.displayName} className="w-12 h-12 rounded-full object-cover" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => setLocation(`/user/${user.id}`)}>
                      <p className="text-white font-semibold text-sm">{user.displayName}</p>
                    </button>
                    <p className="text-white/50 text-xs">@{user.username} · {mutualFriends} {t("mutualFriends")}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setAcceptedIds((prev) => { const n = new Set(prev); n.add(user.id); return n; })}
                        className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
                        style={{ background: acceptedIds.has(user.id) ? "rgba(134,239,172,0.2)" : "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: acceptedIds.has(user.id) ? "none" : "0 2px 8px rgba(255,0,110,0.3)" }}
                        data-testid={`btn-accept-${user.id}`}
                      >
                        {acceptedIds.has(user.id) ? "Accepted ✓" : t("accept")}
                      </button>
                      {!acceptedIds.has(user.id) && (
                        <button
                          onClick={() => setDeclinedIds((prev) => { const n = new Set(prev); n.add(user.id); return n; })}
                          className="px-4 py-1.5 rounded-full text-sm font-semibold text-white/70"
                          style={{ background: "rgba(255,255,255,0.1)" }}
                          data-testid={`btn-decline-${user.id}`}
                        >
                          {t("decline")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Suggested tab */}
      {tab === "suggested" && (
        <div className="px-4 py-3">
          {suggestedFriends.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSent={sentIds.has(user.id)}
              onNavigate={() => setLocation(`/user/${user.id}`)}
              onAction={() => {
                const next = new Set(sentIds);
                if (sentIds.has(user.id)) next.delete(user.id);
                else next.add(user.id);
                setSentIds(next);
              }}
            />
          ))}
        </div>
      )}

      {/* Sent tab */}
      {tab === "sent" && (
        <div className="px-4 py-3">
          {sentIds.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <UserPlus size={40} className="text-white/20" />
              <p className="text-white/40 text-sm">No sent requests</p>
            </div>
          ) : (
            users
              .filter((u) => sentIds.has(u.id))
              .map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSent={true}
                  label={t("requestSent")}
                  onNavigate={() => setLocation(`/user/${user.id}`)}
                  onAction={() => {
                    const next = new Set(sentIds);
                    next.delete(user.id);
                    setSentIds(next);
                  }}
                />
              ))
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function UserRow({
  user,
  isSent,
  label,
  onNavigate,
  onAction,
}: {
  user: { id: string; avatar: string; displayName: string; username: string; followers: number };
  isSent: boolean;
  label?: string;
  onNavigate: () => void;
  onAction: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      data-testid={`user-row-${user.id}`}
    >
      <button onClick={onNavigate}>
        <img src={user.avatar} alt={user.displayName} className="w-11 h-11 rounded-full object-cover" />
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={onNavigate}>
          <p className="text-white font-semibold text-sm">{user.displayName}</p>
        </button>
        <p className="text-white/50 text-xs">@{user.username} · {formatCount(user.followers)} followers</p>
      </div>
      <button
        onClick={onAction}
        className="px-4 py-1.5 rounded-full text-sm font-semibold text-white flex-shrink-0"
        style={{
          background: isSent ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #FF006E, #8B00FF)",
          border: isSent ? "1px solid rgba(255,255,255,0.15)" : "none",
          boxShadow: isSent ? "none" : "0 2px 8px rgba(255,0,110,0.3)",
        }}
        data-testid={`btn-add-${user.id}`}
      >
        {label || (isSent ? t("requestSent") : t("sendRequest"))}
      </button>
    </div>
  );
}
