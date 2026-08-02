import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Phone, Video, MoreHorizontal, Image, Smile, Mic, Send, Camera, BadgeCheck, Heart, ThumbsUp, Laugh, Angry } from "lucide-react";
import { getUserById, getChatMessages } from "@/data/mockData";
import { t } from "@/lib/i18n";

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

export default function Chat() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "u1";
  const user = getUserById(userId);
  const [messages, setMessages] = useState(getChatMessages(userId));
  const [inputText, setInputText] = useState("");
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `m${Date.now()}`,
        senderId: "me",
        text: inputText.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        read: true,
        reactions: [],
        type: "text" as const,
      },
    ]);
    setInputText("");
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, reactions: m.reactions.includes(emoji) ? m.reactions.filter((r) => r !== emoji) : [...m.reactions, emoji] }
          : m
      )
    );
    setReactionTarget(null);
  };

  if (!user) return null;

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(13,11,20,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="chat-header"
      >
        <button onClick={() => setLocation("/messages")} data-testid="btn-back-chat">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <button
          onClick={() => setLocation(`/user/${user.id}`)}
          className="flex items-center gap-2.5 flex-1"
          data-testid="btn-chat-user-profile"
        >
          <div className="relative">
            <img src={user.avatar} alt={user.displayName} className="w-9 h-9 rounded-full object-cover" />
            {user.isOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400" style={{ border: "1.5px solid #0D0B14" }} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-white font-semibold text-sm">{user.displayName}</span>
              {user.verified && <BadgeCheck size={13} className="text-blue-400 fill-blue-400" />}
            </div>
            <span className="text-white/50 text-xs">{user.isOnline ? t("online") : t("offline")}</span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setLocation("/voice-call")} data-testid="btn-voice-call">
            <Phone size={20} className="text-white/70" strokeWidth={1.8} />
          </button>
          <button onClick={() => setLocation("/video-call")} data-testid="btn-video-call">
            <Video size={20} className="text-white/70" strokeWidth={1.8} />
          </button>
          <button data-testid="btn-chat-options">
            <MoreHorizontal size={20} className="text-white/70" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 pb-2" style={{ paddingBottom: 80 }} data-testid="messages-container">
        {messages.map((msg) => {
          const isMe = msg.senderId === "me";
          return (
            <div
              key={msg.id}
              className={`flex mb-2 ${isMe ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.id}`}
            >
              {!isMe && (
                <img src={user.avatar} alt="" className="w-7 h-7 rounded-full object-cover mr-2 mt-auto flex-shrink-0" />
              )}
              <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                {msg.type === "image" && msg.imageUrl ? (
                  <button
                    onDoubleClick={() => setReactionTarget(msg.id)}
                    className="rounded-2xl overflow-hidden"
                    data-testid={`msg-image-${msg.id}`}
                  >
                    <img src={msg.imageUrl} alt="Photo" className="max-w-[200px] rounded-2xl" />
                  </button>
                ) : (
                  <button
                    onDoubleClick={() => setReactionTarget(msg.id)}
                    className={`px-3.5 py-2.5 rounded-2xl text-sm text-left ${
                      isMe
                        ? "rounded-br-sm text-white"
                        : "rounded-bl-sm text-white/90"
                    }`}
                    style={{
                      background: isMe
                        ? "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)"
                        : "rgba(255,255,255,0.08)",
                    }}
                    data-testid={`msg-bubble-${msg.id}`}
                  >
                    {msg.text}
                  </button>
                )}

                {/* Reactions */}
                {msg.reactions.length > 0 && (
                  <div className="flex gap-1 mt-1 px-1">
                    {msg.reactions.map((r) => (
                      <span
                        key={r}
                        className="text-sm px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                <span className="text-white/30 text-[10px] mt-1 px-1">{msg.timestamp}</span>

                {/* Reaction picker */}
                {reactionTarget === msg.id && (
                  <div
                    className="flex gap-2 px-3 py-2 rounded-full mt-1"
                    style={{ background: "rgba(20,17,35,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                  >
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => addReaction(msg.id, emoji)}
                        className="text-xl hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button onClick={() => setReactionTarget(null)} className="text-white/40 text-sm ml-1">✕</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3 py-3"
        style={{
          background: "rgba(13,11,20,0.95)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
        data-testid="chat-input-bar"
      >
        <div className="flex items-center gap-2">
          <button data-testid="btn-attach-media">
            <Image size={22} style={{ color: "#FF3D9A" }} strokeWidth={1.8} />
          </button>
          <button data-testid="btn-camera-msg">
            <Camera size={22} style={{ color: "#FF3D9A" }} strokeWidth={1.8} />
          </button>
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={t("typeMessage")}
              className="flex-1 bg-transparent text-white/85 text-sm outline-none placeholder:text-white/30"
              data-testid="input-message"
            />
            <button data-testid="btn-emoji">
              <Smile size={18} className="text-white/40" />
            </button>
          </div>
          {inputText.trim() ? (
            <button
              onClick={sendMessage}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)", boxShadow: "0 2px 12px rgba(255,0,110,0.4)" }}
              data-testid="btn-send"
            >
              <Send size={16} className="text-white ml-0.5" />
            </button>
          ) : (
            <button data-testid="btn-voice-msg">
              <Mic size={22} style={{ color: "#FF3D9A" }} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
