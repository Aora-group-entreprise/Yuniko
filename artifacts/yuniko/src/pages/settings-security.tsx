import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import BottomNav from "@/components/BottomNav";
export default function SecuritySettings(){
 const [,setLocation]=useLocation(); const [current,setCurrent]=useState(""); const [next,setNext]=useState(""); const [confirm,setConfirm]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
 const save=async()=>{setError("");setMessage("");if(!current||!next)return setError("Complete all fields.");if(next.length<6)return setError("New password must be at least 6 characters.");if(next!==confirm)return setError("Passwords do not match.");setBusy(true);try{await apiJson("/auth/change-password",{method:"POST",body:JSON.stringify({currentPassword:current,newPassword:next})});setCurrent("");setNext("");setConfirm("");setMessage("Password changed successfully.");}catch(e){setError(e instanceof Error?e.message:"Could not change password.");}finally{setBusy(false)}};
 return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20"><header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.06)"}}><button onClick={()=>setLocation("/settings")}><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">{t("security")}</h1></header>
 <div className="px-4 py-5"><div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:"rgba(99,102,241,.18)"}}><Lock size={18} className="text-indigo-400"/></div><div><p className="text-white font-semibold">Password</p><p className="text-white/40 text-xs">Change your Yuniko password securely</p></div></div>
 {message&&<div className="mb-4 flex items-center gap-2 text-green-400 text-sm"><CheckCircle2 size={16}/>{message}</div>}{error&&<p className="text-red-400 text-xs mb-4">{error}</p>}
 {[["Current password",current,setCurrent],["New password",next,setNext],["Confirm new password",confirm,setConfirm]].map(([label,value,setter])=><label key={label as string} className="block mb-4"><span className="text-white/50 text-xs font-semibold uppercase tracking-wider">{label as string}</span><input type="password" value={value as string} onChange={e=>(setter as any)(e.target.value)} className="mt-2 w-full rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-white outline-none" autoComplete="new-password"/></label>)}
 <button onClick={save} disabled={busy} className="w-full py-3.5 rounded-2xl text-white font-semibold disabled:opacity-50" style={{background:"linear-gradient(135deg,#FF006E,#8B00FF)"}}>{busy?"Saving...":"Change password"}</button>
 </div><BottomNav/></div>;
}