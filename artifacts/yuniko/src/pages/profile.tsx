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
  user: { id:number; username:string; displayName:string; avatarUrl:string|null; bio:string; country:string|null; countryFlag:string|null; website:string|null };
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
    return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-[#050509] pb-24 text-white">
      <header className="sticky top-0 z-40 h-14 px-4 flex items-center justify-between" style={{background:"rgba(5,5,9,0.92)",backdropFilter:"blur(22px)",borderBottom:"1px solid rgba(255,255,255,0.05)"}} data-testid="profile-header">
        {!isOwn?<button onClick={goBack} className="w-10 h-10 rounded-full flex items-center justify-center" data-testid="btn-back-profile"><ArrowLeft size={21} className="text-white/85"/></button>:<div className="w-10"/>}
        <span className="font-bold text-white text-[18px] tracking-tight">{user.username}{user.verified&&<BadgeCheck size={14} className="inline ml-1 text-blue-400 fill-blue-400"/>}</span>
        {isOwn?<button onClick={()=>setLocation("/settings")} className="w-10 h-10 rounded-full flex items-center justify-center" data-testid="btn-settings"><Settings size={21} className="text-white/80" strokeWidth={1.8}/></button>:<button onClick={()=>setShowOptions(true)} className="w-10 h-10 rounded-full flex items-center justify-center" data-testid="btn-more-profile"><MoreHorizontal size={22} className="text-white/80"/></button>}
      </header>

      <section>
        <div className="relative h-[154px] overflow-hidden">
          {user.coverPhoto ? <img src={user.coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover"/> : <div className="absolute inset-0" style={{background:"linear-gradient(135deg,#180a20 0%,#071b32 52%,#120817 100%)"}}/>}
          <div className="absolute inset-0" style={{background:"linear-gradient(180deg,rgba(5,5,9,0.05),rgba(5,5,9,0.78) 100%)"}}/>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[106px] h-[106px] rounded-full p-[3px]" style={{background:"linear-gradient(135deg,#FF1493,#008CFF)",boxShadow:"0 0 28px rgba(255,20,147,.34)"}}>
            <button onClick={()=>setShowPhotoViewer(true)} className="w-full h-full rounded-full overflow-hidden bg-[#050509]" data-testid="btn-profile-photo">
              <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover"/>
            </button>
          </div>
        </div>

        <div className="px-4 pt-14 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="font-extrabold text-[24px] leading-tight tracking-[-0.03em]">{user.displayName}</h1>
            {user.verified&&<BadgeCheck size={17} className="text-blue-400 fill-blue-400"/>}
          </div>
          <p className="text-[#FF65B5] text-[15px] mt-0.5">@{user.username}</p>
          {user.bio&&<p className="text-white/68 text-[14px] leading-5 max-w-[350px] mx-auto mt-2">{user.bio}</p>}
          {user.location&&<div className="mt-2 flex items-center justify-center gap-1.5 text-white/48 text-[13px]"><MapPin size={14} className="text-[#FF3D9A]"/><span>{user.location}</span></div>}
          {user.website&&<div className="mt-1 flex items-center justify-center gap-1 text-[#72A8FF] text-[12px]"><Link2 size={13}/><span>{user.website}</span></div>}

          <div className="grid grid-cols-3 mt-6 py-3 border-y border-white/[0.07]">
            {statItems.map((stat,i)=><button key={stat.label} onClick={stat.onClick} className="flex flex-col items-center gap-0.5 active:opacity-70" data-testid={`stat-${stat.label.toLowerCase()}`}><span className="font-extrabold text-[20px]">{stat.value}</span><span className="text-white/45 text-[12px]">{stat.label}</span></button>)}
          </div>

          {!isOwn&&<div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={()=>void toggleFollowing()} disabled={followLoading} className="h-11 rounded-full text-[15px] font-bold text-white disabled:opacity-60" style={{background:following?"rgba(255,255,255,.08)": "linear-gradient(135deg,#FF1493,#008CFF)",border:following?"1px solid rgba(255,255,255,.18)":"none",boxShadow:following?"none":"0 5px 18px rgba(255,20,147,.18)"}} data-testid="btn-follow-profile">{following?t("following"):t("follow")}</button>
            <button onClick={()=>setLocation(`/chat/${user.id}`)} className="h-11 rounded-full text-[15px] font-bold" style={{border:"2px solid transparent",background:"linear-gradient(#050509,#050509) padding-box,linear-gradient(135deg,#FF1493,#008CFF) border-box"}} data-testid="btn-message-user">Message</button>
          </div>}
        </div>
      </section>

      <div className="mt-5 px-3 grid grid-cols-3 border-b border-white/[0.07]">
        {[{id:"grid",label:"Post",icon:Grid3X3},...(isOwn?[{id:"saved",label:"Saved",icon:BookmarkIcon},{id:"analytics",label:"Statistique",icon:BarChart2}]:[])].map(tabItem=><button key={tabItem.id} onClick={()=>setTab(tabItem.id as typeof tab)} className="relative py-3.5 flex items-center justify-center gap-1.5 text-[15px] font-semibold" style={{color:tab===tabItem.id?"white":"rgba(255,255,255,.42)"}} data-testid={`tab-${tabItem.id}`}>{tab===tabItem.id&&<span className="absolute inset-x-4 bottom-0 h-[3px] rounded-full" style={{background:"linear-gradient(90deg,#FF1493,#008CFF)",boxShadow:"0 0 10px rgba(255,20,147,.4)"}}/>}<tabItem.icon size={16} className="opacity-70" />{tabItem.label}</button>)}
      </div>

      {tab==="grid"&&<div className="grid grid-cols-3 gap-2 px-3 pt-3">
        {userPosts.length>0?userPosts.map(post=><div key={post.id} className="relative aspect-square overflow-hidden rounded-[18px] p-[2px]" style={{background:"linear-gradient(135deg,rgba(255,20,147,.9),rgba(0,140,255,.85))"}}>
          <button onClick={()=>setLocation(post.url)} className="w-full h-full overflow-hidden rounded-[16px] bg-[#09090e]" data-testid={`grid-post-${post.id}`}><img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover"/></button>
          {isOwn&&<button onClick={event=>{event.stopPropagation();setDeletePostId(post.id)}} className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/65 backdrop-blur-sm flex items-center justify-center" aria-label="Delete post" data-testid={`btn-delete-post-${post.id}`}><Trash2 size={15} className="text-white"/></button>}
        </div>):<div className="col-span-3 py-16 text-center text-white/35 text-sm">{isOwn?"No posts yet":"No posts"}</div>}
      </div>}

      {tab==="saved"&&<div className="grid grid-cols-3 gap-2 px-3 pt-3">
        {isOwn&&savedPostsError?<div className="col-span-3 py-16 px-4 text-center"><p className="text-white/60 text-sm">Unable to load saved posts</p><p className="text-white/30 text-xs mt-1">{savedPostsError}</p></div>:isOwn&&savedPosts.length>0?savedPosts.map(post=><button key={post.id} onClick={()=>setLocation(post.url)} className="aspect-square overflow-hidden rounded-[18px] p-[2px]" style={{background:"linear-gradient(135deg,rgba(255,20,147,.9),rgba(0,140,255,.85))"}} data-testid={`profile-saved-post-${post.id}`}>{post.mediaUrl?<img src={post.mediaUrl} alt={post.caption} className="w-full h-full rounded-[16px] object-cover"/>:<div className="w-full h-full rounded-[16px] p-3 flex items-center justify-center bg-[#101018]"><p className="text-white/75 text-xs leading-snug line-clamp-6 text-left">{post.caption||"Saved post"}</p></div>}</button>):<div className="col-span-3 py-16 text-center text-white/35 text-sm">No saved posts yet</div>}
      </div>}

      {tab==="analytics"&&<div className="px-4 py-4 flex flex-col gap-3">
        {[{label:"Profile Views",value:analytics.profileViews},{label:"Post Impressions",value:analytics.postImpressions},{label:"Reach",value:analytics.reach}].map(stat=><div key={stat.label} className="p-4 rounded-2xl flex items-center justify-between" style={{background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.08)"}}><div><p className="text-white/50 text-xs mb-1">{stat.label}</p><p className="font-extrabold text-2xl">{analyticsLoading?"…":formatCount(stat.value)}</p></div><span className="text-xs px-2.5 py-1 rounded-full text-white/45 bg-white/5">All time</span></div>)}
        {analyticsError&&<p className="text-red-300/80 text-xs px-1">{analyticsError}</p>}
      </div>}

      <BottomNav />
    </div>
  );
      {showPhotoViewer&&<ScreenPortal><div className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center" onClick={()=>setShowPhotoViewer(false)}>
        <div className="w-72 h-72 rounded-full p-1" style={{background:GRADIENT,boxShadow:"0 0 80px rgba(255,0,110,0.5)"}}><img src={user.avatar} alt={user.displayName} className="w-full h-full rounded-full object-cover" style={{border:"3px solid #0D0B14"}}/></div>
        <button onClick={()=>setShowPhotoViewer(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" data-testid="btn-close-photo-viewer"><ArrowLeft size={18} className="text-white"/></button>
      </div></ScreenPortal>}

      {deletePostId && <ScreenPortal>
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-5" onClick={() => !deletingPost && setDeletePostId(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{background:"rgba(18,15,30,0.98)",border:"1px solid rgba(255,255,255,0.1)"}} onClick={(event) => event.stopPropagation()}>
            <h3 className="text-white font-semibold text-base">Delete this post?</h3>
            <p className="text-white/45 text-sm mt-1">This post will be permanently removed from your profile and feed.</p>
            <div className="flex gap-2 mt-5">
              <button disabled={deletingPost} onClick={() => setDeletePostId(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/65 text-sm">Cancel</button>
              <button disabled={deletingPost} onClick={() => void deleteOwnPost()} className="flex-1 py-2.5 rounded-xl bg-red-500/15 text-red-400 text-sm font-semibold">{deletingPost ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      </ScreenPortal>}
      
      {showOptions&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setShowOptions(false)}/><div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden" style={{background:"rgba(18,15,30,0.98)",border:"1px solid rgba(255,0,110,0.15)"}}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1"/>
        {[{icon:<Share2 size={18}/>,label:t("shareProfile")},{icon:<Link2 size={18}/>,label:t("copyProfileLink")},{icon:<span className="text-red-400"><MoreHorizontal size={18}/></span>,label:<span className="text-red-400">{t("report")}</span>}].map((item,i)=><button key={i} onClick={()=>setShowOptions(false)} className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>{item.icon}{item.label}</button>)}
        <button onClick={()=>setShowOptions(false)} className="w-full py-4 text-white/50 text-sm">{t("cancel")}</button>
      </div></></ScreenPortal>}
    </div>
  );
}
