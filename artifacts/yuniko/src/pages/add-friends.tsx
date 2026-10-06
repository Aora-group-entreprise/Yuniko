import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, UserCheck, UserPlus, X, Link as LinkIcon, Share2 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

type Tab = "requests" | "suggested" | "search" | "sent";

type FriendUser = {
  id: number;
  avatar: string;
  displayName: string;
  username: string;
  age?: number | null;
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

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

  const inviteUrl = typeof window === "undefined"
    ? ""
    : window.location.origin + "/add-friends?invite=" + encodeURIComponent(String((JSON.parse(localStorage.getItem("yuniko_user") || "{}") as { id?: number }).id ?? ""));

  const inviteText = "Rejoins-moi sur Yuniko et découvre le feed mondial.";

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteNotice("Lien copié");
    } catch {
      setInviteNotice("Impossible de copier le lien");
    }
    window.setTimeout(() => setInviteNotice(null), 2500);
  };

  const shareInvite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Rejoins-moi sur Yuniko", text: inviteText, url: inviteUrl });
      } else {
        await copyInviteLink();
        return;
      }
      setInviteNotice("Invitation partagée");
      window.setTimeout(() => setInviteNotice(null), 2500);
    } catch {
      // User cancelled the native share sheet.
    }
  };

  const shareToFacebook = () => {
    if (!inviteUrl) return;
    window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(inviteUrl), "_blank", "noopener,noreferrer");
  };

  const activeSearchResults = useMemo(() => searchResults, [searchResults]);

    const displayedSuggestions = suggestions;
  return (
    <div className="relative min-h-[var(--yuniko-vh)] w-full overflow-x-hidden bg-[#050509] pb-28 text-white">
      <div className="pointer-events-none fixed inset-y-0 left-0 right-0 mx-auto w-full max-w-[430px]" style={{background:"radial-gradient(ellipse 55% 35% at 0% 38%,rgba(255,20,147,.18),transparent 70%),radial-gradient(ellipse 55% 38% at 100% 56%,rgba(0,140,255,.18),transparent 70%)"}} />

      <header className="relative z-10 px-5 pt-8">
        <div className="text-center">
          <h1 className="text-[42px] font-black tracking-[-0.045em] text-white">Add Friends</h1>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setLocation("/")} className="text-left" data-testid="btn-back-add-friends">
            <span className="text-[24px] font-bold" style={{background:"linear-gradient(90deg,#FF1493,#8B5CFF,#008CFF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>✦ yuniko</span>
          </button>
          <button onClick={() => setLocation("/settings")} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Settings">
            <span className="text-[28px] text-white/45">⚙</span>
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-full p-[3px]" style={{background:"linear-gradient(90deg,#FF1493,#8B5CFF,#008CFF)",boxShadow:"0 0 22px rgba(255,20,147,.18)"}}>
          <div className="flex w-full items-center gap-3 rounded-full bg-[#08080d] px-5 py-3.5">
            <Search size={28} style={{color:"#9B7CFF"}} />
            <input value={query} onChange={(e)=>{setQuery(e.target.value);setTab("search");}} placeholder="Search by username, name or email" className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/42" data-testid="input-search-friends" />
            {query && <button onClick={()=>{setQuery("");setTab("requests");}}><X size={18} className="text-white/40"/></button>}
          </div>
        </div>
      </header>

      {error && <div className="relative z-10 mx-5 mt-3 rounded-xl px-3 py-2 text-xs text-red-200/80" style={{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)"}}>{error}</div>}

      <main className="relative z-10 px-5 pt-6">
        {tab === "search" && query.trim().length >= 2 ? (
          <section>
            <h2 className="mb-4 text-[25px] font-bold">Search results</h2>
            {searching ? <p className="py-12 text-center text-white/35">Searching...</p> : activeSearchResults.length===0 ? <p className="py-12 text-center text-white/35">{t("noResults")}</p> : activeSearchResults.map(user=>(
              <FriendCard key={user.id} user={user} isSent={sent.some(item=>item.id===user.id)} busy={busyIds.has(user.id)} onNavigate={()=>setLocation(`/user/${user.id}`)} onAction={()=>sent.some(item=>item.id===user.id)?cancelRequest(user):sendRequest(user)} />
            ))}
          </section>
        ) : tab === "requests" && requests.length > 0 ? (
          <section>
            <div className="mb-4 flex items-end justify-between"><div><h2 className="text-[25px] font-bold">Friend requests</h2><p className="mt-1 text-sm text-white/45">People who want to connect with you</p></div></div>
            {requests.map(request=><RequestCard key={request.user.id} request={request} busy={busyIds.has(request.user.id)} onNavigate={()=>setLocation(`/user/${request.user.id}`)} onAccept={()=>acceptRequest(request)} onDecline={()=>declineRequest(request)} />)}
          </section>
        ) : (
          <section>
            <h2 className="text-[25px] font-bold">Suggested for you</h2>
            <p className="mt-1 text-[15px] text-white/48">People you may know based on mutual friends</p>
            <div className="mt-5 space-y-4">
              {loading ? <p className="py-14 text-center text-white/35">Loading...</p> : displayedSuggestions.length===0 ? <EmptyState icon={<UserPlus size={40} className="text-white/20" />} text="No suggestions right now" /> : displayedSuggestions.map(user=>(
                <FriendCard key={user.id} user={user} isSent={sent.some(item=>item.id===user.id)} busy={busyIds.has(user.id)} onNavigate={()=>setLocation(`/user/${user.id}`)} onAction={()=>sent.some(item=>item.id===user.id)?cancelRequest(user):sendRequest(user)} />
              ))}
            </div>

            <button onClick={() => setInviteOpen(true)} className="mt-7 flex w-full items-center gap-4 rounded-[22px] p-4 text-left" style={{background:"rgba(10,9,16,.82)",border:"1px solid rgba(255,20,147,.28)",boxShadow:"0 0 24px rgba(0,140,255,.10)"}}>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{background:"linear-gradient(135deg,#FF1493,#008CFF)",boxShadow:"0 0 18px rgba(255,20,147,.28)"}}><Share2 size={30} /></div>
              <div className="min-w-0 flex-1"><p className="text-[20px] font-bold">Invite friends</p><p className="mt-1 text-sm text-white/45">Facebook, TikTok, Instagram, Messenger and more</p></div>
              <span className="rounded-xl px-4 py-2 text-sm font-bold" style={{border:"1px solid rgba(255,70,180,.7)",color:"#C56CFF"}}>Invite</span>
            </button>n>
          </section>
        )}
      </main>

      <BottomNav />

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 pb-3" onClick={() => setInviteOpen(false)}>
          <div className="w-full max-w-[430px] rounded-[24px] p-5" onClick={(event) => event.stopPropagation()} style={{background:"rgba(12,11,18,.98)",border:"1px solid rgba(255,255,255,.1)",boxShadow:"0 -12px 50px rgba(0,0,0,.45)"}}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between">
              <div><h2 className="text-[22px] font-bold">Invite friends</h2><p className="mt-1 text-sm text-white/45">No phone contacts needed. Share your Yuniko invite.</p></div>
              <button onClick={() => setInviteOpen(false)} className="rounded-full p-2 text-white/55"><X size={20} /></button>
            </div>
            <button onClick={shareInvite} className="mt-5 flex w-full items-center gap-3 rounded-2xl p-4 text-left" style={{background:"linear-gradient(135deg,#FF1493,#008CFF)"}}>
              <Share2 size={22} /><div className="flex-1"><p className="font-bold">Partager avec...</p><p className="text-xs text-white/75">Ouvre le partage du téléphone pour choisir les applications disponibles.</p></div>
            </button>
            <button onClick={shareToFacebook} className="mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left" style={{background:"rgba(66,103,178,.18)",border:"1px solid rgba(66,103,178,.35)"}}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4267B2] text-lg font-black">f</span><div className="flex-1"><p className="font-bold">Facebook</p><p className="text-xs text-white/45">Ouvre le partage Facebook pour publier le lien.</p></div>
            </button>
            <button onClick={copyInviteLink} className="mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left" style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)"}}>
              <LinkIcon size={21} className="text-[#8B7CFF]" /><div className="flex-1"><p className="font-bold">Copier le lien</p><p className="text-xs text-white/45 truncate">{inviteUrl}</p></div>
            </button>
            {inviteNotice && <p className="mt-3 text-center text-sm font-semibold text-[#7DB8FF]">{inviteNotice}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex flex-col items-center justify-center py-16 gap-3">{icon}<p className="text-white/40 text-sm">{text}</p></div>;
}

function FriendCard({user,isSent,busy,onNavigate,onAction}:{user:FriendUser;isSent:boolean;busy:boolean;onNavigate:()=>void;onAction:()=>void}) {
  return (
    <div className="flex items-center gap-3 rounded-[17px] px-4 py-3.5" style={{background:"rgba(15,15,18,.9)",border:"1px solid rgba(255,255,255,.12)",boxShadow:"0 8px 24px rgba(0,0,0,.22)"}}>
      <button onClick={onNavigate} className="shrink-0">
        <div className="h-[72px] w-[72px] rounded-full p-[3px]" style={{background:"linear-gradient(135deg,#FF1493,#8B5CFF,#008CFF)",boxShadow:"0 0 14px rgba(255,20,147,.18)"}}>
          <img src={user.avatar} alt={user.displayName} className="h-full w-full rounded-full border-2 border-[#09090d] object-cover" />
        </div>
      </button>
      <button onClick={onNavigate} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[20px] font-bold">{user.displayName}</p>
        <p className="mt-1 truncate text-[14px] text-white/72">{user.mutualFriends ?? 0} mutual friends <span className="text-[#7D67FF]">⌖</span> {user.username}</p>
      </button>
      <button disabled={busy} onClick={onAction} className="shrink-0 rounded-[17px] px-5 py-3 text-[17px] font-bold text-white disabled:opacity-50" style={{background:isSent?"rgba(255,255,255,.08)":"linear-gradient(135deg,#FF1493,#4267FF)",boxShadow:isSent?"none":"0 5px 18px rgba(255,20,147,.25)"}}>
        {busy ? "..." : isSent ? "Sent" : "Add"}
      </button>
    </div>
  );
}

function RequestCard({request,busy,onNavigate,onAccept,onDecline}:{request:FriendRequest;busy:boolean;onNavigate:()=>void;onAccept:()=>void;onDecline:()=>void}) {
  return (
    <div className="rounded-[17px] p-4" style={{background:"rgba(15,15,18,.9)",border:"1px solid rgba(255,255,255,.12)"}}>
      <div className="flex items-center gap-3">
        <button onClick={onNavigate}><img src={request.user.avatar} alt={request.user.displayName} className="h-[64px] w-[64px] rounded-full object-cover" /></button>
        <div className="min-w-0 flex-1"><p className="truncate text-lg font-bold">{request.user.displayName}</p><p className="text-sm text-white/55">{request.mutualFriends} mutual friends</p></div>
      </div>
      <div className="mt-3 flex gap-2"><button onClick={onAccept} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-bold" style={{background:"linear-gradient(135deg,#FF1493,#008CFF)"}}>Accept</button><button onClick={onDecline} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white/70" style={{background:"rgba(255,255,255,.08)"}}>Decline</button></div>
    </div>
  );
}
