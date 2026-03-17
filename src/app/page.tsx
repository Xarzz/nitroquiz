"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, saveUser, removeUser } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { User } from "@/types";
import {
  Menu,
  Maximize,
  Minimize,
  PlayCircle,
  Download,
  Globe,
  LogOut,
  X,
  User as UserIcon,
  ChevronRight,
  Zap,
  Users,
  Trophy,
  Target,
  DownloadIcon,
  Gamepad2,
  LogIn,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [isHosting, setIsHosting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsDropdownOpen(false);
  };
  useEffect(() => {
    async function init() {
      // PRIORITY: Check if this is a QR scan redirect (?room=XXX)
      // If so, show loading, check login, redirect immediately — never show homepage
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      if (roomParam) {
        const code = roomParam.toUpperCase();
        setIsRedirecting(true);

        // Quick check: is user already in localStorage?
        const existingUser = getUser();
        if (existingUser) {
          router.push(`/player/${code}/lobby`);
          return;
        }

        // Also check Supabase session (OAuth users)
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const newUser: User = {
              id: session.user.id,
              username:
                session.user.user_metadata.full_name ||
                session.user.email?.split("@")[0] ||
                "Racer",
              email: session.user.email || "",
              avatar: session.user.user_metadata.avatar_url || session.user.user_metadata.picture || "",
              totalPoints: 0,
              gamesPlayed: 0,
              createdAt: new Date().toISOString(),
            };
            saveUser(newUser);
            router.push(`/player/${code}/lobby`);
            return;
          }
        } catch (e) {
          console.error("Session check failed:", e);
        }

        // Not logged in → redirect to player login with room code
        router.push(`/player/${code}/login`);
        return;
      }

      // Normal homepage flow (no ?room= param)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const u = getUser();
          const sessionAvatar = session.user.user_metadata.avatar_url || session.user.user_metadata.picture || "";
          
          if (!u || u.id !== session.user.id || u.avatar !== sessionAvatar) {
            const newUser: User = {
              id: session.user.id,
              username:
                session.user.user_metadata.full_name ||
                session.user.email?.split("@")[0] ||
                "Racer",
              email: session.user.email || "",
              avatar: sessionAvatar,
              totalPoints: u?.totalPoints || 0,
              gamesPlayed: u?.gamesPlayed || 0,
              createdAt: u?.createdAt || new Date().toISOString(),
            };
            saveUser(newUser);
            setUser(newUser);
          } else {
            setUser(u);
          }
        } else {
          const currentUser = getUser();
          if (!currentUser) {
            router.push("/login");
            return;
          }
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Failed to get Supabase session:", error);
        const currentUser = getUser();
        if (!currentUser) {
          router.push("/login");
          return;
        }
        setUser(currentUser);
      }
    }

    init();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    removeUser();
    router.push("/login");
  };

  const handleHost = () => {
    setIsHosting(true);
    setTimeout(() => {
      router.push("/host/select-quiz");
    }, 100);
  };

  const handleJoin = () => {
    if (roomCode.trim()) {
      const nick = nickname.trim() || user?.username || "Racer";
      router.push(
        `/player/${roomCode.trim()}/login?nickname=${encodeURIComponent(nick)}`,
      );
    }
  };

  if (!user || isHosting || isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f] relative overflow-hidden font-display text-white">
        <div className="text-center z-10">
          <div className="w-16 h-16 border-4 border-[#2d6af2]/30 border-t-[#2d6af2] rounded-full animate-spin mx-auto mb-6"></div>
          <p className="mt-4 text-[#2d6af2] text-xl tracking-[0.2em] uppercase animate-pulse">
            Establishing Signal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b101a] text-white min-h-screen relative overflow-hidden font-body selection:bg-[#2d6af2] selection:text-white flex flex-col">
      {/* Main Background Image */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ 
          backgroundImage: 'url("/assets/backgorund/homepage_bg.png")',
          backgroundAttachment: 'fixed'
        }}
      ></div>
      
      {/* Overlays to ensure readability and mood */}
      <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#0b101a] via-[#0b101a]/40 to-transparent pointer-events-none"></div>
      <div className="scanlines"></div>

      {/* Top Bar: Logo1 left, Logo2 right */}
      <div className="fixed top-0 left-0 right-0 z-[90] px-4 md:px-6 py-3 flex items-center justify-between pointer-events-none">
        {/* Logo kiri (jika ingin dipakai nanti) */}
        {/* 
  <div className="pointer-events-auto">
    <Logo width={140} height={40} withText={false} animated={false} />
  </div>
  */}

        {/* Logo kanan */}
        <div className="pointer-events-auto mr-16 md:mr-20">
          <Image
            src="/assets/logo/logo2.png"
            alt="GameForSmart.com"
            width={240}
            height={60}
            className="object-contain opacity-70 hover:opacity-100 transition-opacity duration-300 drop-shadow-[0_0_10px_rgba(45,106,242,0.3)]"
            priority
          />
        </div>
      </div>

      {/* Top Right Dropdown Menu */}
      {user && (
        <div
          className="fixed top-3 right-4 md:top-3 md:right-6 z-[100]"
          ref={dropdownRef}
        >
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 border ${
              isDropdownOpen
                ? "bg-[#2d6af2] border-[#2d6af2] text-white shadow-[0_0_20px_rgba(45,106,242,0.5)]"
                : "bg-black/40 backdrop-blur-md border-white/10 text-gray-400 hover:text-white hover:border-white/20"
            }`}
          >
            {isDropdownOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute top-14 right-0 w-72 bg-[#0d121f]/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col font-body z-[101]"
              >
                {/* User Header */}
                <div className="p-6 bg-gradient-to-br from-white/[0.05] to-transparent border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#2d6af2]/20 flex items-center justify-center border border-[#2d6af2]/30">
                      <UserIcon className="w-6 h-6 text-[#2d6af2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-lg font-bold truncate tracking-tight">
                        {user.username}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions List */}
                <div className="p-3 flex flex-col gap-1">
                  <button
                    onClick={toggleFullscreen}
                    className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group"
                  >
                    <div className="p-2 rounded-xl bg-gray-500/10 group-hover:bg-[#2d6af2]/20 transition-colors">
                      {isFullscreen ? (
                        <Minimize className="w-4 h-4 text-[#2d6af2]" />
                      ) : (
                        <Maximize className="w-4 h-4 text-[#2d6af2]" />
                      )}
                    </div>

                    <span className="text-sm font-medium tracking-wide">
                      {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowHowToPlay(true);
                      setIsDropdownOpen(false);
                    }}
                    className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group"
                  >
                    <div className="p-2 rounded-xl bg-gray-500/10 group-hover:bg-[#2d6af2]/20 transition-colors">
                      <PlayCircle className="w-4 h-4 text-[#2d6af2]" />
                    </div>
                    <span className="text-sm font-medium tracking-wide">
                      How to Play
                    </span>
                  </button>

                  <button className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group opacity-50 cursor-not-allowed">
                    <div className="p-2 rounded-xl bg-gray-500/10 transition-colors">
                      <DownloadIcon className="w-4 h-4 text-[#2d6af2]" />
                    </div>
                    <span className="text-sm font-medium tracking-wide">
                      Install App
                    </span>
                  </button>

                  <button className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group">
                    <div className="p-2 rounded-xl bg-gray-500/10 group-hover:bg-[#2d6af2]/20 transition-colors">
                      <Globe className="w-4 h-4 text-[#2d6af2]" />
                    </div>
                    <span className="text-sm font-medium tracking-wide">
                      Language (EN)
                    </span>
                  </button>
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-black/20 border-t border-white/5">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-4 w-full px-4 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all group font-bold"
                  >
                    <div className="p-2 rounded-xl bg-red-500/20 group-hover:bg-white/20 transition-colors">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="text-sm tracking-[0.1em] uppercase">
                      Logout
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* How to Play Modal */}
      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHowToPlay(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 150 }}
              className="w-full max-w-lg bg-[#0d121f]/98 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent */}
              <div className="h-1 bg-gradient-to-r from-[#2d6af2] via-[#00ff9d] to-[#2d6af2]"></div>

              {/* Header */}
              <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#2d6af2]/20 border border-[#2d6af2]/30">
                    <PlayCircle className="w-5 h-5 text-[#2d6af2]" />
                  </div>
                  <h2 className="text-xl font-display uppercase tracking-wider text-white drop-shadow-[0_0_10px_rgba(45,106,242,0.5)]">
                    How to Play
                  </h2>
                </div>
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Steps */}
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {[
                  {
                    icon: <Zap className="w-5 h-5" />,
                    title: "Host or Join",
                    desc: "Create a room as Host to select a quiz and invite players, or enter a Room Code to Join as a player.",
                    color: "text-[#00ff9d]",
                    bg: "bg-[#00ff9d]/10 border-[#00ff9d]/20",
                  },
                  {
                    icon: <Target className="w-5 h-5" />,
                    title: "Select a Quiz",
                    desc: "As a Host, browse and pick from available quizzes. Configure the number of questions, duration, and difficulty.",
                    color: "text-[#2d6af2]",
                    bg: "bg-[#2d6af2]/10 border-[#2d6af2]/20",
                  },
                  {
                    icon: <Users className="w-5 h-5" />,
                    title: "Wait for Players",
                    desc: "Share your Room Code with friends. Once everyone has joined the lobby, the Host starts the game.",
                    color: "text-purple-400",
                    bg: "bg-purple-400/10 border-purple-400/20",
                  },
                  {
                    icon: <Trophy className="w-5 h-5" />,
                    title: "Answer & Race!",
                    desc: "Answer questions as fast as possible! Points are awarded based on speed and accuracy. The fastest correct answer wins!",
                    color: "text-yellow-400",
                    bg: "bg-yellow-400/10 border-yellow-400/20",
                  },
                ].map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-start gap-4 p-4 rounded-2xl border ${step.bg} transition-all`}
                  >
                    <div
                      className={`flex-shrink-0 p-2 rounded-xl ${step.bg} ${step.color}`}
                    >
                      {step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-display tracking-widest text-gray-500 uppercase">
                          Step {i + 1}
                        </span>
                      </div>
                      <h3
                        className={`font-display text-sm uppercase tracking-wider mb-1 ${step.color}`}
                      >
                        {step.title}
                      </h3>
                      <p className="text-gray-400 text-xs leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-6 pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="w-full py-3.5 bg-gradient-to-r from-[#2d6af2] to-[#4da6ff] text-white font-display text-xs tracking-widest uppercase rounded-xl hover:shadow-[0_0_20px_rgba(45,106,242,0.5)] transition-all active:scale-[0.98]"
                >
                  Got It!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-20 flex flex-col items-center justify-center min-h-screen w-full max-w-7xl mx-auto p-4 md:p-8">
        <header className="text-center mb-12 relative z-30 w-full flex flex-col items-center">
          <Image
            src="/assets/logo/logo1.png"
            alt="GameForSmart Logo"
            width={400}
            height={120}
            className="object-contain"
            priority
          />
        </header>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-16 w-full justify-center items-stretch max-w-5xl">
          {/* Host Card */}
          <div className="host-card rounded-[2rem] p-8 md:p-10 flex-1 flex flex-col items-center justify-between relative overflow-hidden group transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#00ff9d]/20 to-transparent rounded-bl-full pointer-events-none"></div>
            <div className="w-full text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#000000]/50 border border-white/10 mb-6 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                <Gamepad2 className="w-8 h-8 text-[#00ff9d]" />
              </div>
              <h2 className="font-body font-bold text-4xl text-white mb-2 tracking-wide glow-text uppercase">
                HOST
              </h2>
              <p className="text-gray-400 text-sm font-light tracking-wider">
                Create a new room and invite players.
              </p>
            </div>
            <div className="w-full mb-28">
              <button
                onClick={handleHost}
                className="w-full bg-[#00ff9d] hover:bg-[#33ffb0] text-black font-display text-sm py-4 px-6 rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.4)] hover:shadow-[0_0_30px_rgba(0,255,157,0.6)] transition-all duration-300 uppercase tracking-wider transform active:scale-[0.98] border border-white/20"
              >
                Create Room
              </button>
            </div>
          </div>

          {/* Join Card */}
          <div className="join-card rounded-[2rem] p-8 md:p-10 flex-1 flex flex-col items-center justify-between relative overflow-hidden group transition-all duration-300">
            <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-[#2d6af2]/20 to-transparent rounded-br-full pointer-events-none"></div>
            <div className="w-full text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#000000]/50 border border-white/10 mb-6 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                <LogIn className="w-8 h-8 text-[#2d6af2]" />
              </div>
              <h2 className="font-body font-bold text-4xl text-white mb-2 tracking-wide glow-text uppercase">
                JOIN
              </h2>
              <p className="text-gray-400 text-sm font-light tracking-wider">
                Enter a code to join game.
              </p>
            </div>
            <div className="w-full mt-auto space-y-3">
              <div className="relative group/input">
                <input
                  className="w-full bg-black/60 border border-white/10 text-white font-display text-center text-sm py-4 px-4 rounded-xl focus:outline-none focus:border-[#2d6af2] focus:ring-1 focus:ring-[#2d6af2] transition-all placeholder:font-display placeholder:text-xs uppercase tracking-widest shadow-inner placeholder:text-gray-500"
                  maxLength={6}
                  placeholder="ROOM CODE"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
              <div className="relative group/input">
                <input
                  className="w-full bg-black/60 border border-white/10 text-white font-body text-center text-sm py-3 px-4 rounded-xl focus:outline-none focus:border-[#00ff9d]/50 focus:ring-1 focus:ring-[#00ff9d]/30 transition-all placeholder:text-xs placeholder:text-gray-500 shadow-inner"
                  maxLength={20}
                  placeholder="Your Nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
              <button
                onClick={handleJoin}
                className="w-full bg-[#2d6af2] hover:bg-[#4da6ff] text-white font-display text-sm py-4 px-6 rounded-xl shadow-[0_0_20px_rgba(45,106,242,0.4)] hover:shadow-[0_0_30px_rgba(45,106,242,0.6)] transition-all duration-300 uppercase tracking-wider transform active:scale-[0.98] border border-white/20"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="absolute top-1/4 left-10 w-1 h-24 bg-gradient-to-b from-transparent via-[#2d6af2]/40 to-transparent blur-sm hidden lg:block"></div>
        <div className="absolute bottom-1/3 right-10 w-1 h-32 bg-gradient-to-b from-transparent via-[#00ff9d]/40 to-transparent blur-sm hidden lg:block"></div>
      </main>
    </div>
  );
}
