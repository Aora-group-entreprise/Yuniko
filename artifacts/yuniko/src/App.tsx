import { useState, useRef, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { motion, AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/lib/auth-context";

import SplashScreen from "@/components/SplashScreen";
import Home from "@/pages/home";
import Notifications from "@/pages/notifications";
import Create from "@/pages/create";
import Messages from "@/pages/messages";
import Profile from "@/pages/profile";
import Search from "@/pages/search";
import Chat from "@/pages/chat";
import Story from "@/pages/story";
import AddFriends from "@/pages/add-friends";
import VideoCall from "@/pages/video-call";
import VoiceCall from "@/pages/voice-call";
import PostDetail from "@/pages/post-detail";
import EditProfile from "@/pages/edit-profile";
import Followers from "@/pages/followers";
import Saved from "@/pages/saved";
import Hashtag from "@/pages/hashtag";
import BlockedUsers from "@/pages/blocked-users";
import CallHistory from "@/pages/call-history";
import MessageRequests from "@/pages/message-requests";
import ArchivedChats from "@/pages/archived-chats";
import Help from "@/pages/help";
import Feedback from "@/pages/feedback";
import DeleteAccount from "@/pages/account-delete";
import SettingsPrivacy from "@/pages/settings-privacy";
import SettingsSecurity from "@/pages/settings-security";
import SettingsStorage from "@/pages/settings-storage";
import SettingsAbout from "@/pages/settings-about";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import Live from "@/pages/live";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: false } },
});

const TAB_ROOTS = new Set(["/", "/notifications", "/create", "/messages", "/profile"]);

function isTabRoot(path: string) {
  return TAB_ROOTS.has(path);
}

const slideVariants = {
  enterForward:  { x: "100%", opacity: 1 },
  enterBack:     { x: "-100%", opacity: 1 },
  center:        { x: 0, opacity: 1 },
  exitForward:   { x: "-100%", opacity: 1 },
  exitBack:      { x: "100%", opacity: 1 },
  instant:       { x: 0, opacity: 1 },
};

function AnimatedRoutes() {
  const [location] = useLocation();

  const historyRef = useRef<string[]>([location]);
  const prevLocationRef = useRef(location);
  const directionRef = useRef<"forward" | "back" | "instant">("instant");

  if (location !== prevLocationRef.current) {
    const history = historyRef.current;
    const prevIdx = history.slice(0, -1).lastIndexOf(location);

    if (isTabRoot(location) || location === "/login") {
      directionRef.current = "instant";
      historyRef.current = [location];
    } else if (prevIdx !== -1) {
      directionRef.current = "back";
      historyRef.current = history.slice(0, prevIdx + 1);
    } else {
      directionRef.current = "forward";
      historyRef.current = [...history, location];
    }

    prevLocationRef.current = location;
  }

  const direction = directionRef.current;

  const getInitial = () => {
    if (direction === "instant") return "instant";
    return direction === "forward" ? "enterForward" : "enterBack";
  };

  const getExit = () => {
    if (direction === "instant") return "instant";
    return direction === "forward" ? "exitForward" : "exitBack";
  };

  const transitionDuration = direction === "instant" ? 0 : 0.22;

  return (
    <div className="relative overflow-hidden" style={{ minHeight: "100dvh" }}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={location}
          variants={slideVariants}
          initial={getInitial()}
          animate="center"
          exit={getExit()}
          transition={{ duration: transitionDuration, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ width: "100%", minHeight: "100dvh", willChange: direction === "instant" ? "auto" : "transform" }}
        >
          <Switch>
            {/* Auth */}
            <Route path="/login" component={Login} />

            {/* Main tabs */}
            <Route path="/" component={Home} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/create" component={Create} />
            <Route path="/messages" component={Messages} />
            <Route path="/profile">
              {() => <Profile />}
            </Route>

            {/* Settings */}
            <Route path="/settings" component={Settings} />
            <Route path="/settings/privacy" component={SettingsPrivacy} />
            <Route path="/settings/security" component={SettingsSecurity} />
            <Route path="/settings/storage" component={SettingsStorage} />
            <Route path="/settings/about" component={SettingsAbout} />
            <Route path="/settings/account">
              {() => <EditProfile />}
            </Route>

            {/* Profile pages */}
            <Route path="/profile/edit" component={EditProfile} />
            <Route path="/user/:userId">
              {(params) => <Profile userId={params.userId} />}
            </Route>
            <Route path="/followers/:userId">
              {() => <Followers mode="followers" />}
            </Route>
            <Route path="/following/:userId">
              {() => <Followers mode="following" />}
            </Route>

            {/* Content */}
            <Route path="/post/:postId" component={PostDetail} />
            <Route path="/saved" component={Saved} />
            <Route path="/hashtag/:tag" component={Hashtag} />
            <Route path="/search" component={Search} />

            {/* Social */}
            <Route path="/add-friends" component={AddFriends} />

            {/* Messaging */}
            <Route path="/chat/:userId" component={Chat} />
            <Route path="/message-requests" component={MessageRequests} />
            <Route path="/archived-chats" component={ArchivedChats} />
            <Route path="/call-history" component={CallHistory} />

            {/* Calls */}
            <Route path="/video-call" component={VideoCall} />
            <Route path="/video-call/:userId" component={VideoCall} />
            <Route path="/voice-call" component={VoiceCall} />
            <Route path="/voice-call/:userId" component={VoiceCall} />

            {/* Stories */}
            <Route path="/story/:userId" component={Story} />

            {/* Live */}
            <Route path="/live" component={Live} />

            {/* Account */}
            <Route path="/blocked-users" component={BlockedUsers} />
            <Route path="/account/delete" component={DeleteAccount} />
            <Route path="/account/verify">
              {() => (
                <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex items-center justify-center px-6">
                  <div className="text-center">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                      style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 40px rgba(255,0,110,0.4)" }}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h2 className="text-white font-bold text-xl mb-2">Verify Account</h2>
                    <p className="text-white/50 text-sm mb-6 leading-relaxed">
                      Verification helps your followers know your account is authentic.
                    </p>
                    <button
                      className="px-6 py-3 rounded-2xl text-sm font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 4px 16px rgba(255,0,110,0.4)" }}
                    >
                      Request Verification
                    </button>
                  </div>
                </div>
              )}
            </Route>

            {/* Support */}
            <Route path="/help" component={Help} />
            <Route path="/feedback" component={Feedback} />

            {/* Fallback */}
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Inner component — has access to AuthProvider context
function AppContent() {
  const [splashDone, setSplashDone] = useState(false);
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  // After splash + auth resolution: redirect if needed
  useEffect(() => {
    if (!splashDone || isLoading) return;
    const onAuthPage = location === "/login";
    if (!user && !onAuthPage) {
      navigate("/login");
    } else if (user && onAuthPage) {
      navigate("/");
    }
  }, [splashDone, isLoading, user, location]);

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <AnimatedRoutes />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <div className="yuniko-root">
                <AppContent />
              </div>
            </WouterRouter>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
