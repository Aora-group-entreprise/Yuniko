import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import BottomNav from "@/components/BottomNav";

type LegalType = "terms" | "privacy" | "licenses";

const sections: Record<LegalType,{title:string;intro:string;items:string[]}> = {
 terms: {
  title: "Terms of Service",
  intro: "These rules describe the basic conditions for using Yuniko.",
  items: [
   "Use an account that belongs to you and keep your login credentials private.",
   "Do not use Yuniko to impersonate people, harass others, distribute unlawful content, or interfere with the service.",
   "You are responsible for the content you publish and for respecting the rights of other people.",
   "Yuniko may restrict or remove content or accounts when required to protect users, the service, or applicable rules.",
  ],
 },
 privacy: {
  title: "Privacy Policy",
  intro: "Yuniko processes information needed to provide your account and social features.",
  items: [
   "Account data may include username, display name, password hash, profile information, country, age, avatar and website.",
   "Social data may include posts, stories, comments, likes, saves, shares, follows, messages, notifications, feedback and settings.",
   "Technical and security records may include login events, sessions, reports and service activity needed to operate and protect the app.",
   "You can use the Settings area to change supported privacy preferences, export available account data, or permanently delete your account.",
   "Yuniko does not place your password in the downloadable account export.",
  ],
 },
 licenses: {
  title: "Open Source Licenses",
  intro: "Yuniko is built with open-source software. The project keeps the dependency declarations in its package manifests and lockfile.",
  items: [
   "React and React DOM",
   "Vite",
   "TypeScript",
   "Tailwind CSS",
   "TanStack Query",
   "Wouter",
   "Lucide React",
   "Framer Motion",
   "Zod",
   "Radix UI packages",
   "Other packages declared in the repository package manifests",
  ],
 },
};

export default function Legal({type="terms"}:{type?:string}){
 const [,setLocation]=useLocation();
 const key=(type==="privacy"||type==="licenses"?type:"terms") as LegalType;
 const page=sections[key];
 return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
  <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
   <button onClick={()=>setLocation("/settings/about")}><ArrowLeft size={22} className="text-white/80"/></button>
   <h1 className="text-base font-semibold text-white">{page.title}</h1>
  </header>
  <article className="px-5 py-6 text-white/70 text-sm leading-6">
   <p className="text-white font-semibold text-lg mb-4">Yuniko {page.title}</p>
   <p className="mb-5">{page.intro}</p>
   <div className="space-y-4">{page.items.map((item,i)=><section key={i}><p className="text-white/85 font-medium">{i+1}. {item}</p></section>)}</div>
   <p className="text-white/40 text-xs mt-8">Last updated: September 2026</p>
  </article>
  <BottomNav/>
 </div>;
}
