import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Settings, Grid3X3, BookmarkIcon, BadgeCheck, MapPin, MoreHorizontal, MessageCircle, Phone } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
const GRADIENT="linear-gradient(135deg,#FF006E 0%,#8B00FF 100%)";
type User={id:number;username:string;displayName:string;avatarUrl:string|null;bio:string;country:string|null;countryFlag:string|null;website:string|null;verificationStatus?:string;followers:number;following:number;posts:number;isFollowing:boolean};
type Post={id:number;mediaUrl:string|null;mediaType:string;caption:string;mediaItems:string|null};
const avatar=(u:Pick<User,"avatarUrl"|"displayName">)=>u.avatarUrl??`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(u.displayName)}&backgroundColor=FF006E`;
export default function Profile({userId}:{userId?:string}){
 const [,setLocation]=useLocation(); const params=useParams<{userId:string}>(); const {user:me,isLoading:authLoading,refreshUser}=useAuth();
 const target=userId||params?.userId||"me"; const isOwn=target==="me";
 const [resolvedId,setResolvedId]=useState<number|null>(isOwn?(me?.id??null):Number(target));
 const [data,setData]=useState<{user:User;posts:Post[]}|null>(null); const [loading,setLoading]=useState(true); const [tab,setTab]=useState<"grid"|"saved">("grid");
 useEffect(()=>{ if(!authLoading && isOwn && !me) void refreshUser(); },[authLoading,isOwn,me,refreshUser]);
 useEffect(()=>{ if(!isOwn){setResolvedId(Number(target));return;} if(me?.id)setResolvedId(me.id); },[isOwn,target,me?.id]);
 useEffect(()=>{
   if(authLoading)return;
   let cancelled=false;
   const load=async()=>{
     if(!resolvedId||!Number.isSafeInteger(resolvedId)||resolvedId<=0){if(!cancelled)setLoading(false);return;}
     setLoading(true);
     try{
       const result=await apiJson<{user:User;posts?:Post[]}>(`/users/${resolvedId}`);
       if(cancelled)return;
       if(result?.user?.id) setData({user:result.user,posts:Array.isArray(result.posts)?result.posts:[]});
       else setData(null);
     }catch{if(!cancelled)setData(null)}finally{if(!cancelled)setLoading(false)}
   };
   load();
   return()=>{cancelled=true};
 },[resolvedId,authLoading]);
 useEffect(()=>{if(!data||!resolvedId)return;apiJson<{verificationStatus?:string}>(`/users/${resolvedId}/verification`).then(v=>setData(current=>current?{...current,user:{...current.user,verificationStatus:v.verificationStatus}}:current)).catch(()=>{});},[data?.user.id,resolvedId]);
 if(authLoading||loading)return <div className="min-h-screen bg-background flex items-center justify-center text-white/50">{t("loading")}</div>;
 if(!data)return <div className="min-h-screen bg-background flex items-center justify-center text-white/50">{t("noResults")}</div>;
 const u=data.user,own=me?.id===u.id,verified=u.verificationStatus==="approved";
 const toggleFollow=async()=>{const method=u.isFollowing?"DELETE":"POST";const d=await apiJson<{following:boolean}>(`/users/${u.id}/follow`,{method}).catch(()=>null);if(d)setData(x=>x?{...x,user:{...x.user,isFollowing:d.following,followers:Math.max(0,x.user.followers+(d.following?1:-1))}}:x)};
 return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20"><header className="sticky top-0 z-40 px-4 py-4 flex items-center justify-between bg-black/90 border-b border-white/5"><button aria-label={t("back")} onClick={()=>window.history.length>1?window.history.back():setLocation("/")}><ArrowLeft size={22} className="text-white/80"/></button><span className="font-semibold text-white">@{u.username}</span>{own?<button aria-label={t("settings")} onClick={()=>setLocation("/settings")}><Settings size={22} className="text-white/80"/></button>:<MoreHorizontal size={22} className="text-white/80"/>}</header><div className="h-32" style={{background:GRADIENT}}/><div className="px-4 relative"><div className="flex items-end justify-between -mt-9 mb-3"><img src={avatar(u)} alt={u.displayName} className="w-[78px] h-[78px] rounded-full object-cover border-4 border-[#0D0B14]"/>{!own&&<div className="flex gap-2"><button onClick={toggleFollow} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{background:u.isFollowing?"rgba(255,255,255,.1)":GRADIENT}}>{u.isFollowing?t("following"):t("follow")}</button><button aria-label={t("messages")} onClick={()=>setLocation(`/chat/${u.id}`)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><MessageCircle size={16} className="text-white/80"/></button><button aria-label="Voice call" onClick={()=>setLocation(`/voice-call/${u.id}`)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><Phone size={16} className="text-white/80"/></button></div>}</div><div className="mb-4"><div className="flex items-center gap-1"><h2 className="font-bold text-white text-base">{u.displayName}</h2>{verified&&<BadgeCheck aria-label="Verified" size={15} className="text-blue-400"/>}</div><p className="text-white/50 text-sm">@{u.username}</p>{u.bio&&<p className="text-white/80 text-sm mt-2">{u.bio}</p>}<div className="flex gap-3 mt-2 text-xs text-white/45">{u.country&&<span><MapPin size={12} className="inline"/> {u.countryFlag} {u.country}</span>}{u.website&&<span className="text-pink-400">{u.website}</span>}</div></div><div className="flex rounded-2xl mb-4 overflow-hidden bg-white/[.04] border border-white/[.07]"><button className="flex-1 py-3 text-center border-r border-white/[.07]"><b className="text-white block">{u.posts}</b><span className="text-white/45 text-xs">Posts</span></button><button onClick={()=>setLocation(`/followers/${u.id}`)} className="flex-1 py-3 text-center border-r border-white/[.07]"><b className="text-white block">{u.followers}</b><span className="text-white/45 text-xs">Followers</span></button><button onClick={()=>setLocation(`/following/${u.id}`)} className="flex-1 py-3 text-center"><b className="text-white block">{u.following}</b><span className="text-white/45 text-xs">Following</span></button></div><div className="flex border-b border-white/5 mb-2"><button aria-label={t("posts")} onClick={()=>setTab("grid")} className={`flex-1 py-3 ${tab==="grid"?"text-pink-400":"text-white/40"}`}><Grid3X3 size={18} className="mx-auto"/></button>{own&&<button aria-label={t("saved")} onClick={()=>setTab("saved")} className={`flex-1 py-3 ${tab==="saved"?"text-pink-400":"text-white/40"}`}><BookmarkIcon size={18} className="mx-auto"/></button>}</div>{tab==="grid"?<div className="grid grid-cols-3 gap-1">{data.posts.map(p=><button key={p.id} aria-label={p.caption||t("posts")} onClick={()=>setLocation(`/post/${p.id}`)} className="aspect-square bg-white/5 overflow-hidden">{p.mediaUrl?<img src={p.mediaUrl} alt={p.caption||"Post"} loading="lazy" className="w-full h-full object-cover"/>:<div className="w-full h-full p-2 flex items-center justify-center text-white/70 text-xs">{p.caption}</div>}</button>)}{data.posts.length===0&&<div className="col-span-3 py-16 text-center text-white/35 text-sm">No posts yet</div>}</div>:<SavedGrid/>}</div><BottomNav/></div>;
}
function SavedGrid(){const [posts,setPosts]=useState<Post[]>([]);useEffect(()=>{apiJson<{posts:Post[]}>("/posts/saved").then(d=>setPosts(d.posts??[])).catch(()=>{});},[]);return <div className="grid grid-cols-3 gap-1">{posts.map(p=><img key={p.id} src={p.mediaUrl??""} alt={p.caption||"Saved post"} className="aspect-square object-cover" loading="lazy"/> )}</div>}
