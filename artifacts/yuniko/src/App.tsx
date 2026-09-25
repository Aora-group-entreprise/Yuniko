import { useState, useRef, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
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
import SettingsNotifications from "@/pages/settings-notifications";
import SettingsSecurity from "@/pages/settings-security";
import SettingsStorage from "@/pages/settings-storage";
import SettingsAbout from "@/pages/settings-about";
import Legal from "@/pages/legal";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import Live from "@/pages/live";
import NotFound from "@/pages/not-found";
import Verification from "@/pages/verification";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: false } },
});

const TAB_ROOTS = new Set(["/", "/notifications", "/create", "/messages", "/profile"]);

function isTabRoot(path: string) {
  return TAB_ROOTS.has(path);
}

const slideVariants = {
  enterForward:  { opacity: 0 },
  enterBack:     { opacity: 0 },
  center:        { opacity: 1 },
  exitForward:   { opacity: 0 },
  exitBack:      { opacity: 0 },
  instant:       { opacity: 1 },
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
    <div className="relative h-[var(--yuniko-vh)] min-h-0 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={location}
          variants={slideVariants}
          initial={getInitial()}
          animate="center"
          exit={getExit()}
          transition={{ duration: transitionDuration, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ width: "100%", height: "var(--yuniko-vh)", minHeight: 0, overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
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
            <Route path="/settings/notifications" component={SettingsNotifications} />
            <Route path="/settings/security" component={SettingsSecurity} />
            <Route path="/settings/storage" component={SettingsStorage} />
            <Route path="/settings/about" component={SettingsAbout} />
            <Route path="/legal/terms">{() => <Legal type="terms" />}</Route>
            <Route path="/legal/privacy">{() => <Legal type="privacy" />}</Route>
            <Route path="/legal/licenses">{() => <Legal type="licenses" />}</Route>
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
            <Route path="/account/verify" component={Verification} />

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
  const initialRouteHandledRef = useRef(false);

  // Browsers such as Firefox can restore the last URL/scroll position when a
  // standalone/PWA window is reopened. Yuniko always starts a fresh app session
  // on the Home feed, while normal in-app navigation remains untouched.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  // After splash + auth resolution: authenticate and normalize a cold launch.
  useEffect(() => {
    if (!splashDone || isLoading) return;
    const onAuthPage = location === "/login";
    if (!user && !onAuthPage) {
      navigate("/login");
      return;
    }
    if (user && !initialRouteHandledRef.current) {
      initialRouteHandledRef.current = true;
      if (location !== "/") navigate("/");
      return;
    }
    if (user && onAuthPage) {
      navigate("/");
    }
  }, [splashDone, isLoading, user, location, navigate]);

  useEffect(() => {
    if (!user) return;

    let enabled = false;
    let cancelled = false;

    apiFetch("/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        if (!cancelled) enabled = settings?.clearCacheOnExit === true;
      })
      .catch(() => {});

    const clearOnExit = () => {
      if (!enabled) return;
      const keep = new Set(["yuniko_user", "yuniko_lang"]);
      for (const key of Object.keys(localStorage)) {
        if (!keep.has(key)) localStorage.removeItem(key);
      }
    };

    window.addEventListener("pagehide", clearOnExit);
    window.addEventListener("beforeunload", clearOnExit);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", clearOnExit);
      window.removeEventListener("beforeunload", clearOnExit);
    };
  }, [user]);

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <AnimatedRoutes />
    </>
  );
}

function useKeyboardViewport() {
  useEffect(() => {
    let frame = 0;
    let settleTimer = 0;

    const updateViewport = () => {
      const viewport = window.visualViewport;
      const layoutHeight = window.innerHeight;
      const visualHeight = viewport?.height ?? layoutHeight;
      const visualTop = viewport?.offsetTop ?? 0;
      const keyboardOffset = Math.max(0, layoutHeight - visualHeight - visualTop);
      const effectiveHeight = Math.max(1, Math.round(visualHeight + visualTop));

      document.documentElement.style.setProperty("--yuniko-vh", `${effectiveHeight}px`);
      document.documentElement.style.setProperty("--yuniko-keyboard-offset", `${Math.round(keyboardOffset)}px`);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateViewport);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(updateViewport, 80);
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.addEventListener("focusin", scheduleUpdate);
    window.addEventListener("focusout", scheduleUpdate);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.removeEventListener("focusin", scheduleUpdate);
      window.removeEventListener("focusout", scheduleUpdate);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      document.documentElement.style.removeProperty("--yuniko-keyboard-offset");
    };
  }, []);
}

export default function App() {
  useKeyboardViewport();
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
