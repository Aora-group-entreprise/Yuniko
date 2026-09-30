import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, UserCheck, UserPlus, X } from "lucide-react";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

type Tab = "requests" | "suggested" | "search" | "sent";

type FriendUser = {
  id: number;
  avatar: string;
  displayName: string;
  username: string;
  followers: number;
  mutualFriends?: number;
};

type FriendRequest = {
  user: FriendUser;
  mutualFriends: number;
};

export default function AddFriends() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("requests");
  const [query, setQuery] = useState("");
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<FriendUser[]>([]);
  const [sent, setSent] = useState<FriendUser[]>([]);
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { id: "requests" as Tab, label: t("friendRequests") },
    { id: "suggested" as Tab, label: t("suggested") },
    { id: "search" as Tab, label: t("search") },
    { id: "sent" as Tab, label: t("sent") },
  ];

  const setBusy = (id: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestData, suggestionData, sentData] = await Promise.all([
        apiJson<{ requests: FriendRequest[] }>("/friend-requests"),
        apiJson<{ users: FriendUser[] }>("/friends/suggestions"),
        apiJson<{ users: FriendUser[] }>("/friend-requests/sent"),
      ]);
      setRequests(requestData.requests ?? []);
      setSuggestions(suggestionData.users ?? []);
      setSent(sentData.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load friends");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (tab !== "search") return;
    const value = query.trim();
    if (value.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      apiJson<{ users: FriendUser[] }>(`/users/search?q=${encodeURIComponent(value)}`)
        .then((data) => {
          if (!cancelled) setSearchResults(data.users ?? []);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, tab]);

  const sendRequest = async (user: FriendUser) => {
    setBusy(user.id, true);
    try {
      await apiJson(`/friend-requests/${user.id}`, { method: "POST" });
      setSent((prev) => [...prev, user]);
      setSuggestions((prev) => prev.filter((item) => item.id !== user.id));
      setSearchResults((prev) => prev.map((item) => item.id === user.id ? { ...item } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send request");
    } finally {
      setBusy(user.id, false);
    }
  };

  const cancelRequest = async (user: FriendUser) => {
    setBusy(user.id, true);
    try {
      await apiJson(`/friend-requests/${user.id}`, { method: "DELETE" });
      setSent((prev) => prev.filter((item) => item.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel request");
    } finally {
      setBusy(user.id, false);
    }
  };

  const acceptRequest = async (request: FriendRequest) => {
    setBusy(request.user.id, true);
    try {
      await apiJson(`/friend-requests/${request.user.id}/accept`, { method: "POST" });
      setRequests((prev) => prev.filter((item) => item.user.id !== request.user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to accept request");
    } finally {
      setBusy(request.user.id, false);
    }
  };

  const declineRequest = async (request: FriendRequest) => {
    setBusy(request.user.id, true);
    try {
      await apiJson(`/friend-requests/${request.user.id}`, { method: "DELETE" });
      setRequests((prev) => prev.filter((item) => item.user.id !== request.user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to decline request");
    } finally {
      setBusy(request.user.id, false);
    }
  };

  const activeSearchResults = useMemo(() => searchResults, [searchResults]);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="add-friends-header"
      >
        <button onClick={() => setLocation("/")} data-testid="btn-back-add-friends">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white flex-1">{t("addFriends")}</h1>
      </header>

      <div className="flex px-4 py-2 gap-1 overflow-x-auto no-scrollbar" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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

      {error && (
        <div className="mx-4 mt-3 rounded-xl px-3 py-2 text-xs text-red-200/80" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {tab === "search" && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
          {searching ? (
            <p className="text-white/35 text-sm text-center py-10">Searching...</p>
          ) : query.trim().length < 2 ? (
            <p className="text-white/35 text-sm text-center py-10">Enter at least 2 characters.</p>
          ) : activeSearchResults.length === 0 ? (
            <p className="text-white/35 text-sm text-center py-10">{t("noResults")}</p>
          ) : (
            activeSearchResults.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSent={sent.some((item) => item.id === user.id)}
                busy={busyIds.has(user.id)}
                onNavigate={() => setLocation(`/user/${user.id}`)}
                onAction={() => sent.some((item) => item.id === user.id) ? cancelRequest(user) : sendRequest(user)}
              />
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="px-4 py-3">
          {loading ? <p className="text-white/35 text-sm text-center py-16">Loading...</p> : requests.length === 0 ? (
            <EmptyState icon={<UserCheck size={40} className="text-white/20" />} text="No friend requests" />
          ) : requests.map((request) => (
            <div key={request.user.id} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }} data-testid={`friend-request-${request.user.id}`}>
              <button onClick={() => setLocation(`/user/${request.user.id}`)}>
                <img src={request.user.avatar} alt={request.user.displayName} className="w-12 h-12 rounded-full object-cover" />
              </button>
              <div className="flex-1 min-w-0">
                <button onClick={() => setLocation(`/user/${request.user.id}`)}>
                  <p className="text-white font-semibold text-sm">{request.user.displayName}</p>
                </button>
                <p className="text-white/50 text-xs">@{request.user.username} · {request.mutualFriends} {t("mutualFriends")}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyIds.has(request.user.id)}
                    onClick={() => acceptRequest(request)}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)" }}
                    data-testid={`btn-accept-${request.user.id}`}
                  >
                    {busyIds.has(request.user.id) ? "..." : t("accept")}
                  </button>
                  <button
                    disabled={busyIds.has(request.user.id)}
                    onClick={() => declineRequest(request)}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold text-white/70 disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                    data-testid={`btn-decline-${request.user.id}`}
                  >
                    {t("decline")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "suggested" && (
        <div className="px-4 py-3">
          {loading ? <p className="text-white/35 text-sm text-center py-16">Loading...</p> : suggestions.length === 0 ? (
            <EmptyState icon={<UserPlus size={40} className="text-white/20" />} text="No suggestions right now" />
          ) : suggestions.map((user) => (
            <UserRow key={user.id} user={user} isSent={sent.some((item) => item.id === user.id)} busy={busyIds.has(user.id)} onNavigate={() => setLocation(`/user/${user.id}`)} onAction={() => sent.some((item) => item.id === user.id) ? cancelRequest(user) : sendRequest(user)} />
          ))}
        </div>
      )}

      {tab === "sent" && (
        <div className="px-4 py-3">
          {loading ? <p className="text-white/35 text-sm text-center py-16">Loading...</p> : sent.length === 0 ? (
            <EmptyState icon={<UserPlus size={40} className="text-white/20" />} text="No sent requests" />
          ) : sent.map((user) => (
            <UserRow key={user.id} user={user} isSent={true} busy={busyIds.has(user.id)} label={t("requestSent")} onNavigate={() => setLocation(`/user/${user.id}`)} onAction={() => cancelRequest(user)} />
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex flex-col items-center justify-center py-16 gap-3">{icon}<p className="text-white/40 text-sm">{text}</p></div>;
}

function UserRow({
  user,
  isSent,
  busy,
  label,
  onNavigate,
  onAction,
}: {
  user: FriendUser;
  isSent: boolean;
  busy: boolean;
  label?: string;
  onNavigate: () => void;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }} data-testid={`user-row-${user.id}`}>
      <button onClick={onNavigate}>
        <img src={user.avatar} alt={user.displayName} className="w-11 h-11 rounded-full object-cover" />
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={onNavigate}>
          <p className="text-white font-semibold text-sm">{user.displayName}</p>
        </button>
        <p className="text-white/50 text-xs">@{user.username} · {user.followers} followers</p>
      </div>
      <button
        disabled={busy}
        onClick={onAction}
        className="px-4 py-1.5 rounded-full text-sm font-semibold text-white flex-shrink-0 disabled:opacity-50"
        style={{
          background: isSent ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #FF006E, #8B00FF)",
          border: isSent ? "1px solid rgba(255,255,255,0.15)" : "none",
          boxShadow: isSent ? "none" : "0 2px 8px rgba(255,0,110,0.3)",
        }}
        data-testid={`btn-add-${user.id}`}
      >
        {busy ? "..." : label || (isSent ? t("requestSent") : t("sendRequest"))}
      </button>
    </div>
  );
}
