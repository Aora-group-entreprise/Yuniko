import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.07]", className)} {...props} />
}

type LoadingVariant = "feed" | "stories" | "profile" | "post" | "list" | "chat" | "settings" | "story";

function LoadingSkeleton({ variant }: { variant: LoadingVariant }) {
  if (variant === "feed") return <div className="h-full px-2.5" aria-busy="true"><div className="h-full rounded-[20px] overflow-hidden bg-white/[0.035]"><Skeleton className="h-[56%] w-full rounded-none" /><div className="p-4 space-y-3"><div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-2.5 w-20" /></div></div><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-2/3" /></div></div></div>;
  if (variant === "stories") return <div className="flex items-center gap-3 h-full px-4 overflow-hidden" aria-busy="true">{[0,1,2,3,4].map(i=><div key={i} className="flex-shrink-0 flex flex-col items-center gap-1.5"><Skeleton className="w-14 h-14 rounded-full" /><Skeleton className="w-12 h-2.5 rounded-full" /></div>)}</div>;
  if (variant === "profile") return <div className="px-4 pt-5 space-y-5" aria-busy="true"><div className="flex flex-col items-center gap-3"><Skeleton className="w-[88px] h-[88px] rounded-full" /><Skeleton className="h-4 w-28 rounded-full" /><Skeleton className="h-3 w-20 rounded-full" /><Skeleton className="h-3 w-48 rounded-full" /></div><Skeleton className="h-16 w-full rounded-2xl" /><div className="grid grid-cols-3 gap-0.5">{[0,1,2,3,4,5].map(i=><Skeleton key={i} className="aspect-square rounded-none" />)}</div></div>;
  if (variant === "post") return <div className="p-4 space-y-4" aria-busy="true"><div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-20" /></div></div><Skeleton className="w-full aspect-[4/5] rounded-xl" /><div className="flex gap-3"><Skeleton className="h-8 w-14 rounded-full" /><Skeleton className="h-8 w-14 rounded-full" /><Skeleton className="h-8 w-14 rounded-full" /></div><Skeleton className="h-3 w-4/5" /></div>;
  if (variant === "chat") return <div className="p-4 space-y-4" aria-busy="true"><div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-16" /></div></div><div className="pt-10 space-y-3"><div className="flex justify-start"><Skeleton className="h-10 w-40 rounded-2xl" /></div><div className="flex justify-end"><Skeleton className="h-10 w-52 rounded-2xl" /></div><div className="flex justify-start"><Skeleton className="h-12 w-48 rounded-2xl" /></div></div></div>;
  if (variant === "settings") return <div className="px-4 py-4 space-y-4" aria-busy="true"><Skeleton className="h-5 w-32 rounded-full" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>;
  if (variant === "story") return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-black flex items-center justify-center" aria-busy="true"><Skeleton className="w-full min-h-screen rounded-none bg-white/[0.05]" /></div>;
  return <div className="divide-y divide-white/[0.05]" aria-busy="true">{[0,1,2,3,4,5].map(i=><div key={i} className="flex items-center gap-3 px-4 py-3.5"><Skeleton className="w-12 h-12 rounded-full flex-shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-52 max-w-[75%]" /></div><Skeleton className="w-16 h-8 rounded-full" /></div>)}</div>;
}

export { Skeleton, LoadingSkeleton }
