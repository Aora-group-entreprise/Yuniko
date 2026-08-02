import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Settings, Grid3X3, BookmarkIcon, BarChart2, BadgeCheck, MapPin, MoreHorizontal, MessageCircle, Phone, Share2, Link2 } from "lucide-react";
import { currentUser, getUserById, getPostsByUser, formatCount } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

interface ProfilePageProps {
  userId?: string;
}

export default function Profile({ userId }: ProfilePageProps) {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const targetId = userId || params?.userId || "me";
  const isOwn = targetId === "me" || targetId === currentUser.id;

  const user = isOwn ? currentUser : getUserById(targetId);
  const [following, setFollowing] = useState(user?.isFollowing ?? false);
  const [tab, setTab] = useState<"grid" | "saved" | "analytics">("grid");
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  if (!user) {
    return (
      <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex items-center justify-center">
        <p className="text-white/50">User not found</p>
      </div>
    );
  }

  const userPosts = getPostsByUser(user.id);
  const samplePosts = Array.from({ length: 9 }).map((_, i) => ({
    id: `sample-${i}`,
    src: `https://picsum.photos/seed/profile_${user.id}_${i}/200/200`,
  }));

  const statItems = [
    { label: t("posts"), value: formatCount(user.posts), onClick: undefined },
    { label: t("followers"), value: formatCount(user.followers), onClick: () => setLocation(`/followers/${user.id}`) },
    { label: t("following"), value: formatCount(user.following), onClick: () => setLocation(`/following/${user.id}`) },
  ];

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center justify-between"
        style={{
          background: "rgba(13,11,20,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="profile-header"
      >
        {!isOwn ? (
          <button onClick={goBack} data-testid="btn-back-profile">
            <ArrowLeft size={22} className="text-white/80" />
          </button>
        ) : (
          <div className="w-6" />
        )}
        <span className="font-semibold text-white text-base flex items-center gap-1">
          {user.username}
          {user.verified && <BadgeCheck size={15} className="text-blue-400 fill-blue-400" />}
        </span>
        {isOwn ? (
          <button onClick={() => setLocation("/settings")} data-testid="btn-settings">
            <Settings size={22} className="text-white/80" strokeWidth={1.8} />
          </button>
        ) : (
          <button onClick={() => setShowOptions(true)} data-testid="btn-more-profile">
            <MoreHorizontal size={22} className="text-white/80" />
          </button>
        )}
      </header>

      {/* Cover photo */}
      <div className="relative h-32 overflow-hidden" style={{ background: GRADIENT }}>
        <img src={user.coverPhoto} alt="Cover" className="w-full h-full object-cover opacity-60" />
        {isOwn && (
          <button
            onClick={() => setLocation("/profile/edit")}
            className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg text-xs font-medium text-white/90"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
            data-testid="btn-edit-cover"
          >
            {t("editCoverPhoto")}
          </button>
        )}
      </div>

      {/* Avatar + action buttons */}
      <div className="px-4 relative">
        <div className="flex items-end justify-between -mt-9 mb-3">
          <button onClick={() => setShowPhotoViewer(true)} className="relative" data-testid="btn-profile-photo">
            <div
              className="w-[78px] h-[78px] rounded-full p-[2.5px]"
              style={{ background: GRADIENT, boxShadow: "0 0 20px rgba(255,0,110,0.45)" }}
            >
              <img
                src={user.avatar}
                alt={user.displayName}
                className="w-full h-full rounded-full object-cover"
                style={{ border: "2.5px solid #0D0B14" }}
              />
            </div>
            {user.isOnline && (
              <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-400" style={{ border: "2px solid #0D0B14" }} />
            )}
          </button>

          {isOwn ? (
            <div className="flex gap-2">
              <button
                onClick={() => setLocation("/profile/edit")}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                data-testid="btn-edit-profile"
              >
                {t("editProfile")}
              </button>
              <button
                onClick={() => setLocation("/add-friends")}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: GRADIENT, boxShadow: "0 2px 12px rgba(255,0,110,0.3)" }}
                data-testid="btn-add-friends"
              >
                {t("addFriends")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setFollowing((p) => !p)}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
                style={{
                  background: following ? "rgba(255,255,255,0.1)" : GRADIENT,
                  border: following ? "1px solid rgba(255,255,255,0.15)" : "none",
                  boxShadow: following ? "none" : "0 2px 12px rgba(255,0,110,0.35)",
                }}
                data-testid="btn-follow-profile"
              >
                {following ? t("following") : t("follow")}
              </button>
              <button
                onClick={() => setLocation(`/chat/${user.id}`)}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                data-testid="btn-message-user"
              >
                <MessageCircle size={16} className="text-white/80" />
              </button>
              <button
                onClick={() => setLocation(`/voice-call/${user.id}`)}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                data-testid="btn-voice-call-user"
              >
                <Phone size={16} className="text-white/80" />
              </button>
            </div>
          )}
        </div>

        {/* Name & bio */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-0.5">
            <h2 className="font-bold text-white text-base">{user.displayName}</h2>
            {user.verified && <BadgeCheck size={15} className="text-blue-400 fill-blue-400" />}
          </div>
          <p className="text-white/50 text-sm mb-1">@{user.username}</p>
          {user.bio && <p className="text-white/80 text-sm leading-snug mb-2">{user.bio}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            {user.location && (
              <div className="flex items-center gap-1 text-white/45 text-xs">
                <MapPin size={12} />
                <span>{user.location}</span>
              </div>
            )}
            {user.website && (
              <div className="flex items-center gap-1 text-xs" style={{ color: "#FF3D9A" }}>
                <Link2 size={12} />
                <span>{user.website}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div
          className="flex rounded-2xl mb-4 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {statItems.map((stat, i) => (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 active:bg-white/5"
              style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
              data-testid={`stat-${stat.label.toLowerCase()}`}
            >
              <span className="text-white font-bold text-lg leading-tight">{stat.value}</span>
              <span className="text-white/45 text-xs">{stat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 mb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {[
          { id: "grid", icon: Grid3X3 },
          { id: "saved", icon: BookmarkIcon },
          ...(isOwn ? [{ id: "analytics", icon: BarChart2 }] : []),
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id as typeof tab)}
            className="flex-1 py-3 flex items-center justify-center"
            style={{ borderBottom: tab === tabItem.id ? "2px solid #FF3D9A" : "2px solid transparent" }}
            data-testid={`tab-${tabItem.id}`}
          >
            <tabItem.icon
              size={20}
              style={{ color: tab === tabItem.id ? "#FF3D9A" : "rgba(255,255,255,0.35)" }}
              strokeWidth={1.8}
            />
          </button>
        ))}
      </div>

      {/* Grid tab */}
      {tab === "grid" && (
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {userPosts.length > 0 ? (
            userPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => setLocation(`/post/${post.id}`)}
                className="aspect-square overflow-hidden"
                data-testid={`grid-post-${post.id}`}
              >
                <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
              </button>
            ))
          ) : (
            samplePosts.map((sp, i) => (
              <button
                key={sp.id}
                onClick={() => setLocation(`/post/sample-${i}`)}
                className="aspect-square overflow-hidden"
              >
                <img src={sp.src} alt="" className="w-full h-full object-cover" />
              </button>
            ))
          )}
        </div>
      )}

      {/* Saved tab */}
      {tab === "saved" && (
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <button
              key={i}
              onClick={() => setLocation("/saved")}
              className="aspect-square overflow-hidden"
            >
              <img src={`https://picsum.photos/seed/saved_${user.id}_${i}/200/200`} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Analytics tab */}
      {tab === "analytics" && (
        <div className="px-4 py-4 flex flex-col gap-3">
          {[
            { label: "Profile Views", value: "2,840", change: "+12%", up: true },
            { label: "Post Impressions", value: "45,200", change: "+8%", up: true },
            { label: "Reach", value: "18,600", change: "+23%", up: true },
            { label: "Followers Gained", value: "342", change: "+5%", up: true },
            { label: "Avg. Engagement", value: "4.2%", change: "-0.3%", up: false },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-2xl flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div>
                <p className="text-white/55 text-xs mb-1">{stat.label}</p>
                <p className="text-white font-bold text-xl">{stat.value}</p>
              </div>
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${stat.up ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                {stat.change}
              </span>
            </div>
          ))}
        </div>
      )}

      <BottomNav />

      {/* Photo viewer */}
      {showPhotoViewer && (
        <div
          className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center"
          onClick={() => setShowPhotoViewer(false)}
        >
          <div
            className="w-72 h-72 rounded-full p-1"
            style={{ background: GRADIENT, boxShadow: "0 0 80px rgba(255,0,110,0.5)" }}
          >
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-full h-full rounded-full object-cover"
              style={{ border: "3px solid #0D0B14" }}
            />
          </div>
          <button
            onClick={() => setShowPhotoViewer(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            data-testid="btn-close-photo-viewer"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
        </div>
      )}

      {/* Options bottom sheet */}
      {showOptions && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowOptions(false)} />
          <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden"
            style={{ background: "rgba(18,15,30,0.98)", border: "1px solid rgba(255,0,110,0.15)" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1" />
            {[
              { icon: <Share2 size={18} />, label: t("shareProfile") },
              { icon: <Link2 size={18} />, label: t("copyProfileLink") },
              { icon: <span className="text-red-400"><MoreHorizontal size={18} /></span>, label: <span className="text-red-400">{t("report")}</span> },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => setShowOptions(false)}
                className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                {item.icon} {item.label}
              </button>
            ))}
            <button onClick={() => setShowOptions(false)} className="w-full py-4 text-white/50 text-sm">{t("cancel")}</button>
          </div>
        </>
      )}
    </div>
  );
}
