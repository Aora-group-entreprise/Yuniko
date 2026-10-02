import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Settings, Grid3X3, BookmarkIcon, BarChart2,
  BadgeCheck, MapPin, MoreHorizontal, MessageCircle, Phone, Share2, Link2, Trash2,
} from "lucide-react";
import { getUserById, getPostsByUser, formatCount } from "@/data/mockData";
import { useAuth, AuthUser } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { apiFetch, apiJson } from "@/lib/api";
import ScreenPortal from "@/components/ScreenPortal";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { fetchSessionJson, getSessionCache, invalidateSessionCache, setSessionUser } from "@/lib/session-cache";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

function authUserToDisplay(u: AuthUser) {
  return {
    id: String(u.id), username: u.username, displayName: u.displayName,
    avatar: u.avatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(u.displayName)}&backgroundColor=FF006E`,
    bio: u.bio ?? "", location: [u.countryFlag, u.country].filter(Boolean).join(" ") || "",
    flag: u.countryFlag ?? "", verified: false, followers: 0, following: 0, posts: 0,
    isOnline: true, coverPhoto: "", isFollowing: false, isFriend: false, website: u.website ?? undefined,
  };
}

interface ProfilePageProps { userId?: string; }
interface RemoteProfile {
  user: { id:number; username:string; displayName:string; avatarUrl:string|null; bio:string; country:string|null; countryFlag:string|null; website:string|null; coverPhoto?:string|null };
  posts: Array<{ id:number; caption:string; mediaUrl:string|null }>;
  stats: { posts:number; followers:number; following:number };
  following:boolean;
}

export default function Profile({ userId }: ProfilePageProps) {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const { user: authUser } = useAuth();
  setSessionUser(Number(authUser?.id));
  const targetId = userId || params?.userId || "me";
  const isOwn = targetId === "me" || (authUser && targetId === String(authUser.id));
  const isDatabaseProfile = isOwn || /^\d+$/.test(targetId);
  const profileCacheKey = isDatabaseProfile && authUser
    ? `/users/${isOwn ? authUser.id : Number(targetId)}`
    : "";
  const cachedRemoteProfile = profileCacheKey ? getSessionCache<RemoteProfile>(profileCacheKey) : undefined;
  const [remoteProfile, setRemoteProfile] = useState<RemoteProfile | null>(() => cachedRemoteProfile ?? null);
  const [profileLoading, setProfileLoading] = useState(isDatabaseProfile && !!authUser && !cachedRemoteProfile);

  useEffect(() => {
    if (!isDatabaseProfile || !authUser) return;
    const id = isOwn ? authUser.id : Number(targetId);
    if (!Number.isInteger(id) || id <= 0) { setProfileLoading(false); return; }
    setProfileLoading(!getSessionCache<RemoteProfile>(`/users/${id}`));
    let cancelled = false;
    void fetchSessionJson<RemoteProfile>(`/users/${id}`)
      .then((data) => {
        if (!cancelled) setRemoteProfile(data);
      })
      .catch(() => {
        if (!cancelled) setRemoteProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [authUser, isDatabaseProfile, isOwn, targetId]);

  const remoteUser = remoteProfile ? {
    id: String(remoteProfile.user.id), username: remoteProfile.user.username,
    displayName: remoteProfile.user.displayName,
    avatar: remoteProfile.user.avatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(remoteProfile.user.displayName)}&backgroundColor=FF006E`,
    bio: remoteProfile.user.bio,
    location: [remoteProfile.user.countryFlag, remoteProfile.user.country].filter(Boolean).join(" "),
    flag: remoteProfile.user.countryFlag ?? "", verified:false,
    coverPhoto: remoteProfile.user.coverPhoto ?? "",
    followers:remoteProfile.stats.followers, following:remoteProfile.stats.following, posts:remoteProfile.stats.posts,
    isOnline:true, isFollowing:remoteProfile.following, isFriend:false, website:remoteProfile.user.website ?? undefined,
  } : null;
  const user = isDatabaseProfile ? (remoteUser ?? (isOwn && authUser ? authUserToDisplay(authUser) : null)) : getUserById(targetId);
  const [following, setFollowing] = useState(user?.isFollowing ?? false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    setFollowing(Boolean(user?.isFollowing));
  }, [user?.id, user?.isFollowing]);
  const [tab, setTab] = useState<"grid"|"saved"|"analytics">("grid");
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [ownPosts, setOwnPosts] = useState<Array<{id:string; url:string; imageUrl:string; caption:string}>>([]);
  const [savedPosts, setSavedPosts] = useState<Array<{id:number; url:string; caption:string; mediaUrl:string|null}>>([]);
  const [savedPostsError, setSavedPostsError] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [analytics, setAnalytics] = useState({ profileViews: 0, postImpressions: 0, reach: 0 });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwn || !authUser) return;
    fetchSessionJson<{ posts?: Array<{id:number; caption:string; mediaUrl:string|null}> }>("/posts/mine")
      .then((data) => {
        setOwnPosts((data.posts ?? []).map((post) => ({
          id: String(post.id),
          url: `/post/live_${post.id}`,
          imageUrl: post.mediaUrl ?? `https://api.dicebear.com/8.x/shapes/svg?seed=post-${post.id}`,
          caption: post.caption ?? "",
        })));
      })
      .catch(() => setOwnPosts([]));
  }, [authUser, isOwn]);

  const loadSavedPosts = async () => {
    if (!isOwn || !authUser) {
      setSavedPosts([]);
      return;
    }
    setSavedPostsError(null);
    try {
      const data = await fetchSessionJson<{ posts?: Array<{id:number; caption:string; mediaUrl:string|null}> }>("/posts/saved");
      setSavedPosts((data.posts ?? []).map((post) => ({
        ...post,
        url: `/post/live_${post.id}`,
      })));
    } catch (error) {
      setSavedPosts([]);
      setSavedPostsError(error instanceof Error ? error.message : "Unable to load saved posts");
    }
  };

  useEffect(() => {
    void loadSavedPosts();
  }, [authUser, isOwn]);

  useEffect(() => {
    if (!isDatabaseProfile || !authUser || !user || isOwn) return;
    void apiFetch(`/analytics/profile/${user.id}/view`, { method: "POST" }).catch(() => {});
  }, [authUser, isDatabaseProfile, isOwn, user?.id]);

  useEffect(() => {
    if (!isOwn || !authUser || tab !== "analytics") return;
    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    apiJson<{ profileViews: number; postImpressions: number; reach: number }>(`/analytics/me?_=${Date.now()}`)
      .then((data) => {
        if (!cancelled) {
          setAnalytics(data);
          setAnalyticsError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAnalyticsError(error instanceof Error ? error.message : "Unable to load real analytics");
        }
      })
      .finally(() => { if (!cancelled) setAnalyticsLoading(false); });
    return () => { cancelled = true; };
  }, [authUser, isOwn, tab]);

  useEffect(() => {
    const handleSavedPostChanged = () => {
      void loadSavedPosts();
    };
    window.addEventListener("yuniko:save-changed", handleSavedPostChanged);
    return () => window.removeEventListener("yuniko:save-changed", handleSavedPostChanged);
  }, [authUser, isOwn]);

  const deleteOwnPost = async () => {
    if (!deletePostId) return;
    setDeletingPost(true);
    try {
      const response = await apiFetch(`/posts/${deletePostId}`, { method: "DELETE" });
      if (!response.ok) {
        let message = "La suppression du post a échoué.";
        try {
          const data = await response.json() as { error?: string };
          if (data.error) message = data.error;
        } catch {}
        throw new Error(message);
      }
      invalidateSessionCache("/posts/mine");
      setOwnPosts((current) => current.filter((post) => post.id !== deletePostId));
      setRemoteProfile((current) => current ? {
        ...current,
        stats: { ...current.stats, posts: Math.max(0, current.stats.posts - 1) },
      } : current);
      setDeletePostId(null);
    } catch (error) {
      console.error("Post deletion failed:", error);
      window.alert(error instanceof Error ? error.message : "La suppression du post a échoué.");
    } finally {
      setDeletingPost(false);
    }
  };

  if (profileLoading) return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20"><LoadingSkeleton variant="profile" /></div>;
  if (!user) return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex items-center justify-center"><p className="text-white/50">User not found</p></div>;

  const userPosts = isOwn
    ? ownPosts
    : remoteProfile
      ? remoteProfile.posts.map(post => ({
          id:String(post.id),
          url:`/post/live_${post.id}`,
          imageUrl:post.mediaUrl ?? `https://api.dicebear.com/8.x/shapes/svg?seed=post-${post.id}`,
          caption:post.caption,
        }))
      : getPostsByUser(user.id).map(post => ({
          ...post,
          url: `/post/live_${post.id}`,
        }));
  const statItems = [
    {label:t("posts"),value:formatCount(user.posts),onClick:undefined},
    {label:t("followers"),value:formatCount(user.followers),onClick:()=>setLocation(`/followers/${user.id}`)},
    {label:t("following"),value:formatCount(user.following),onClick:()=>setLocation(`/following/${user.id}`)},
  ];
  const goBack=()=>{if(window.history.length>1)window.history.back();else setLocation("/")};
  const toggleFollowing=async()=>{
    const numericId=Number(user.id);
    if (!Number.isInteger(numericId) || numericId <= 0 || followLoading) return;
    const previousFollowing = following;
    setFollowing(!previousFollowing);
    setFollowLoading(true);
    try {
      const result = await apiJson<{following:boolean}>(`/users/${numericId}/follow`,{method:"POST"});
      const nextFollowing = Boolean(result.following);
      setFollowing(nextFollowing);
      setRemoteProfile((current) => current ? {
        ...current,
        following: nextFollowing,
        stats: {
          ...current.stats,
          followers: Math.max(0, current.stats.followers + (nextFollowing === previousFollowing ? 0 : (nextFollowing ? 1 : -1))),
        },
      } : current);
    } catch {
      setFollowing(previousFollowing);
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen overflow-x-hidden bg-[#050509] pb-24 text-white">
      <section className="relative">
        <div className="relative h-[210px] overflow-hidden">
          {user.coverPhoto ? (
            <img src={user.coverPhoto} alt="" className="absolute inset-0 h-full w-full object-cover"/>
          ) : (
            <div className="absolute inset-0" style={{background:"linear-gradient(135deg,#17081d 0%,#071a30 55%,#09050f 100%)"}}/>
          )}
          <div className="absolute inset-0" style={{background:"linear-gradient(180deg,rgba(0,0,0,.04) 20%,rgba(5,5,9,.18) 55%,rgba(5,5,9,.96) 100%)"}}/>
        </div>

        <div className="relative -mt-[57px] px-4">
          <div className="flex justify-center">
            <button onClick={()=>setShowPhotoViewer(true)} className="h-[114px] w-[114px] rounded-full p-[3px]" style={{background:"linear-gradient(135deg,#FF1493 0%,#C13CFF 48%,#008CFF 100%)",boxShadow:"0 0 26px rgba(255,20,147,.38),0 0 34px rgba(0,140,255,.22)"}} data-testid="btn-profile-photo">
              <span className="block h-full w-full rounded-full bg-[#050509] p-[3px]">
                <img src={user.avatar} alt={user.displayName} className="h-full w-full rounded-full object-cover"/>
              </span>
            </button>
          </div>

          <div className="pt-5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-[25px] font-extrabold leading-none tracking-[-0.035em]">{user.displayName}</h1>
              {user.verified&&<BadgeCheck size={17} className="text-blue-400 fill-blue-400"/>}
            </div>
            <p className="mt-2 text-[16px] font-semibold" style={{color:"#B77BFF"}}>@{user.username}</p>
            {user.bio&&<p className="mx-auto mt-3 max-w-[350px] text-[14px] leading-5 text-white/55">{user.bio}</p>}
            {user.location&&<div className="mt-2.5 flex items-center justify-center gap-1.5 text-[14px] text-white/65"><MapPin size={15} className="text-[#C14BFF]"/><span>{user.location}</span></div>}
            {user.website&&<div className="mt-1 flex items-center justify-center gap-1 text-[12px] text-blue-300/80"><Link2 size={13}/><span>{user.website}</span></div>}
          </div>

          <div className="mt-7 grid grid-cols-3">
            {statItems.map(stat=><button key={stat.label} onClick={stat.onClick} className="flex flex-col items-center active:opacity-70" data-testid={`stat-${stat.label.toLowerCase()}`}>
              <span className="text-[22px] font-extrabold leading-none">{stat.value}</span>
              <span className="mt-2 text-[12px] font-medium text-white/55">{stat.label}</span>
            </button>)}
          </div>

          {!isOwn&&<div className="mt-7 grid grid-cols-2 gap-3 px-1">
            <button onClick={()=>void toggleFollowing()} disabled={followLoading} className="h-[52px] rounded-full text-[16px] font-extrabold text-white disabled:opacity-60" style={{background:following?"rgba(255,255,255,.08)":"linear-gradient(100deg,#FF1493,#C13CFF 52%,#008CFF)",border:following?"1px solid rgba(255,255,255,.18)":"none",boxShadow:following?"none":"0 8px 22px rgba(255,20,147,.18)"}} data-testid="btn-follow-profile">{following?t("following"):t("follow")}</button>
            <button onClick={()=>setLocation(`/chat/${user.id}`)} className="h-[52px] rounded-full text-[16px] font-extrabold text-[#D75CFF]" style={{border:"2px solid transparent",background:"linear-gradient(#050509,#050509) padding-box,linear-gradient(100deg,#FF4AAA,#B64BFF 50%,#008CFF) border-box"}} data-testid="btn-message-user">Message</button>
          </div>}
        </div>
      </section>

      <div className="mt-7 grid grid-cols-3 border-b border-white/[0.08]">
        {[{id:"grid",label:"Post"},...(isOwn?[{id:"saved",label:"Saved"},{id:"analytics",label:"Statistique"}]:[])].map(tabItem=><button key={tabItem.id} onClick={()=>setTab(tabItem.id as typeof tab)} className="relative h-[60px] flex items-center justify-center bg-[#07070b] text-[15px] font-bold" style={{color:tab===tabItem.id?"#fff":"rgba(255,255,255,.43)"}} data-testid={`tab-${tabItem.id}`}>
          {tab===tabItem.id&&<span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full" style={{background:"linear-gradient(90deg,#FF1493,#008CFF)",boxShadow:"0 0 11px rgba(255,20,147,.55)"}}/>}
          {tabItem.label}
        </button>)}
      </div>

      {tab==="grid"&&<div className="grid grid-cols-3 gap-[7px] px-3 pt-3">
        {userPosts.length>0?userPosts.map(post=><div key={post.id} className="relative aspect-square overflow-hidden rounded-[17px] p-[2px]" style={{background:"linear-gradient(135deg,rgba(255,20,147,.95),rgba(0,140,255,.9))"}}>
          <button onClick={()=>setLocation(post.url)} className="h-full w-full overflow-hidden rounded-[15px] bg-[#09090e]" data-testid={`grid-post-${post.id}`}><img src={post.imageUrl} alt={post.caption} className="h-full w-full object-cover"/></button>
          {isOwn&&<button onClick={event=>{event.stopPropagation();setDeletePostId(post.id)}} className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 backdrop-blur-sm" aria-label="Delete post" data-testid={`btn-delete-post-${post.id}`}><Trash2 size={15} className="text-white"/></button>}
        </div>):<div className="col-span-3 py-16 text-center text-sm text-white/35">{isOwn?"No posts yet":"No posts"}</div>}
      </div>}

      {tab==="saved"&&<div className="grid grid-cols-3 gap-[7px] px-3 pt-3">
        {isOwn&&savedPostsError?<div className="col-span-3 px-4 py-16 text-center"><p className="text-sm text-white/60">Unable to load saved posts</p><p className="mt-1 text-xs text-white/30">{savedPostsError}</p></div>:isOwn&&savedPosts.length>0?savedPosts.map(post=><button key={post.id} onClick={()=>setLocation(post.url)} className="aspect-square overflow-hidden rounded-[17px] p-[2px]" style={{background:"linear-gradient(135deg,rgba(255,20,147,.95),rgba(0,140,255,.9))"}} data-testid={`profile-saved-post-${post.id}`}>{post.mediaUrl?<img src={post.mediaUrl} alt={post.caption} className="h-full w-full rounded-[15px] object-cover"/>:<div className="flex h-full w-full items-center justify-center rounded-[15px] bg-[#101018] p-3"><p className="line-clamp-6 text-left text-xs leading-snug text-white/75">{post.caption||"Saved post"}</p></div>}</button>):<div className="col-span-3 py-16 text-center text-sm text-white/35">No saved posts yet</div>}
      </div>}

      {tab==="analytics"&&<div className="flex flex-col gap-3 px-4 py-4">
        {[{label:"Profile Views",value:analytics.profileViews},{label:"Post Impressions",value:analytics.postImpressions},{label:"Reach",value:analytics.reach}].map(stat=><div key={stat.label} className="flex items-center justify-between rounded-2xl p-4" style={{background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.08)"}}><div><p className="mb-1 text-xs text-white/50">{stat.label}</p><p className="text-2xl font-extrabold">{analyticsLoading?"…":formatCount(stat.value)}</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/45">All time</span></div>)}
        {analyticsError&&<p className="px-1 text-xs text-red-300/80">{analyticsError}</p>}
      </div>}

      <BottomNav />
      {showPhotoViewer&&<ScreenPortal><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/92" onClick={()=>setShowPhotoViewer(false)}>
        <div className="h-72 w-72 rounded-full p-1" style={{background:GRADIENT,boxShadow:"0 0 80px rgba(255,0,110,0.5)"}}><img src={user.avatar} alt={user.displayName} className="h-full w-full rounded-full object-cover" style={{border:"3px solid #0D0B14"}}/></div>
        <button onClick={()=>setShowPhotoViewer(false)} className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10" data-testid="btn-close-photo-viewer"><ArrowLeft size={18} className="text-white"/></button>
      </div></ScreenPortal>}

      {deletePostId && <ScreenPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5" onClick={() => !deletingPost && setDeletePostId(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{background:"rgba(18,15,30,0.98)",border:"1px solid rgba(255,255,255,0.1)"}} onClick={(event) => event.stopPropagation()}>
            <h3 className="text-base font-semibold text-white">Delete this post?</h3>
            <p className="mt-1 text-sm text-white/45">This post will be permanently removed from your profile and feed.</p>
            <div className="mt-5 flex gap-2">
              <button disabled={deletingPost} onClick={() => setDeletePostId(null)} className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm text-white/65">Cancel</button>
              <button disabled={deletingPost} onClick={() => void deleteOwnPost()} className="flex-1 rounded-xl bg-red-500/15 py-2.5 text-sm font-semibold text-red-400">{deletingPost ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      </ScreenPortal>}
      
      {showOptions&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setShowOptions(false)}/><div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 overflow-hidden rounded-t-2xl" style={{background:"rgba(18,15,30,0.98)",border:"1px solid rgba(255,0,110,0.15)"}}>
        <div className="mx-auto mb-1 mt-3 h-1 w-10 rounded-full bg-white/20"/>
        {[{icon:<Share2 size={18}/>,label:t("shareProfile")},{icon:<Link2 size={18}/>,label:t("copyProfileLink")},{icon:<span className="text-red-400"><MoreHorizontal size={18}/></span>,label:<span className="text-red-400">{t("report")}</span>}].map((item,i)=><button key={i} onClick={()=>setShowOptions(false)} className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-white/85" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>{item.icon}{item.label}</button>)}
        <button onClick={()=>setShowOptions(false)} className="w-full py-4 text-sm text-white/50">{t("cancel")}</button>
      </div></></ScreenPortal>}
    </div>
  );}
