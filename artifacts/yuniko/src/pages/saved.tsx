import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookmarkIcon } from "lucide-react";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

type Post = { id:number; mediaUrl:string|null; caption:string; mediaType:string };
export default function Saved(){
  const [,setLocation]=useLocation(); const [posts,setPosts]=useState<Post[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{apiJson<{posts:Post[]}>("/posts/saved").then(d=>setPosts(d.posts??[])).catch(()=>setPosts([])).finally(()=>setLoading(false));},[]);
  return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
    <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3 bg-black/95 border-b border-white/5"><button onClick={()=>setLocation("/profile")}><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">{t("saved")}</h1></header>
    {loading?<div className="py-20 text-center text-white/40">Loading...</div>:posts.length===0?<div className="flex flex-col items-center justify-center py-20 gap-3"><BookmarkIcon size={48} className="text-white/20"/><p className="text-white/40 text-sm">No saved posts yet</p></div>:<div className="grid grid-cols-3 gap-0.5 px-0.5 pt-1">{posts.map(p=><button key={p.id} onClick={()=>setLocation(`/post/live_${p.id}`)} className="aspect-square overflow-hidden">{p.mediaUrl?<img src={p.mediaUrl} alt={p.caption} loading="lazy" className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center p-2 text-white/60 text-xs">{p.caption}</div>}</button>)}</div>}
    <BottomNav/>
  </div>;
}
