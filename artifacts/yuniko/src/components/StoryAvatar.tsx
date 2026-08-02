import { useLocation } from "wouter";
import { getUserById } from "@/data/mockData";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";

interface StoryAvatarProps {
  userId: string;
  isOwn?: boolean;
  viewed?: boolean;
  label?: string;
}

export default function StoryAvatar({ userId, isOwn = false, viewed = false, label }: StoryAvatarProps) {
  const [, setLocation] = useLocation();
  const user = isOwn ? null : getUserById(userId);

  const handleClick = () => {
    if (isOwn) {
      setLocation("/create");
    } else {
      setLocation(`/story/${userId}`);
    }
  };

  const displayName = isOwn ? t("yourStory") : (label ?? user?.displayName ?? "");
  const avatarUrl = isOwn ? "https://picsum.photos/seed/me/200/200" : (user?.avatar ?? "");

  return (
    <motion.button
      data-testid={`story-avatar-${userId}`}
      onClick={handleClick}
      className="flex flex-col items-center gap-1 flex-shrink-0"
      style={{ minWidth: 64 }}
      whileTap={{ scale: 0.9 }}
    >
      <div className="relative">
        <div
          className="w-[54px] h-[54px] rounded-full p-[2px]"
          style={
            isOwn
              ? { background: "rgba(255,61,154,0.2)", border: "2px dashed rgba(255,61,154,0.5)" }
              : viewed
              ? { background: "rgba(255,255,255,0.15)" }
              : {
                  background: "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)",
                  boxShadow: "0 0 10px rgba(255,0,110,0.35)",
                }
          }
        >
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full rounded-full object-cover"
            style={{ border: "2px solid #0D0B14" }}
            loading="lazy"
          />
        </div>
        {isOwn && (
          <div
            className="absolute bottom-0 right-0 w-[18px] h-[18px] rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", border: "2px solid #0D0B14" }}
          >
            <Plus size={9} className="text-white" strokeWidth={3} />
          </div>
        )}
        {!isOwn && user?.isOnline && (
          <div
            className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-green-400"
            style={{ border: "1.5px solid #0D0B14" }}
          />
        )}
      </div>
      <span className="text-white/70 text-[10px] font-medium leading-tight text-center truncate max-w-[60px]">
        {displayName}
      </span>
    </motion.button>
  );
}
