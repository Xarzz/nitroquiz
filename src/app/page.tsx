"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, saveUser, removeUser } from "@/lib/storage";
import { supabase, supabaseCentral } from "@/lib/supabase";
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
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { getI18nInstance } from "@/lib/i18n";
import { Logo } from "@/components/ui/logo";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const i18n = getI18nInstance();
  const [roomCode, setRoomCode] = useState("");
  const [isHosting, setIsHosting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
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
    if (profile) {
      const u = getUser();
      const newUser: User = {
        id: profile.auth_user_id,
        username: profile.nickname || profile.fullname || profile.username || "Racer",
        email: profile.email,
        avatar: profile.avatar_url || "",
        totalPoints: u?.totalPoints || 0,
        gamesPlayed: u?.gamesPlayed || 0,
        createdAt: u?.createdAt || new Date().toISOString(),
      };

      // Only update if data changed to prevent infinite loops
      if (!u || u.id !== newUser.id || u.username !== newUser.username || u.avatar !== newUser.avatar) {
        saveUser(newUser);
        setUser(newUser);
      } else {
        setUser(u);
      }
    } else if (!authLoading) {
      const currentUser = getUser();
      if (!currentUser) {
        // Double check session in case AuthContext is still initializing
        supabaseCentral.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            router.push("/login");
          }
        });
      } else {
        setUser(currentUser);
      }
    }
  }, [profile, authLoading, router]);

  useEffect(() => {
    async function init() {
      // PRIORITY: Check if this is a QR scan redirect (?room=XXX)
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      if (roomParam) {
        const code = roomParam.toUpperCase();
        setIsRedirecting(true);

        const existingUser = getUser();
        if (existingUser) {
          router.push(`/player/${code}/waiting`);
          return;
        }

        try {
          const {
            data: { session },
          } = await supabaseCentral.auth.getSession();
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
            router.push(`/player/${code}/waiting`);
            return;
          }
        } catch (e) {
          console.error("Session check failed:", e);
        }

        router.push(`/player/${code}/login`);
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
    await supabaseCentral.auth.signOut();
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
    if (roomCode.trim() && user) {
      router.push(
        `/player/${roomCode.trim()}/login?nickname=${encodeURIComponent(user.username)}`,
      );
    }
  };

  if (!user || isHosting || isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#04060f] relative overflow-hidden font-display text-white">
        <div className="text-center z-10">
          <div className="w-16 h-16 border-4 border-[#2d6af2]/30 border-t-[#00ff9d] rounded-full animate-spin mx-auto mb-6"></div>
          <p className="mt-4 text-[#00ff9d] text-xl tracking-[0.2em] uppercase animate-pulse">
            {t('homepage.loading')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#04060f] text-white min-h-screen relative overflow-hidden font-body selection:bg-[#2d6af2] selection:text-white flex flex-col">
      {/* Main Background Image */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: 'url("/assets/backgorund/homepage_bg.png")',
          backgroundAttachment: 'fixed'
        }}
      ></div>

      {/* Overlays to ensure readability and mood */}
      <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#04060f] via-[#04060f]/60 to-[#2d6af2]/10 pointer-events-none"></div>
      <div className="scanlines"></div>

      {/* Top Bar: Corner Logos */}
      <div className="fixed top-0 left-0 right-0 z-[90] px-4 md:px-8 py-5 flex items-start justify-between pointer-events-none">
        {/* Logo 1 (Top Left) */}
        <div className="pointer-events-auto">
          <Image
            src="/assets/logo/logo1.png"
            alt="Logo"
            width={180}
            height={50}
            className="h-10 md:h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(45,106,242,0.4)]"
            priority
          />
        </div>
        
        {/* Logo 2 (Top Right) - positioned to left of the menu button */}
        <div className="pointer-events-auto mr-14 md:mr-16">
          <Image
            src="/assets/logo/logo2.png"
            alt="NitroQuiz"
            width={160}
            height={40}
            className="h-7 md:h-9 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
            priority
          />
        </div>
      </div>

      {/* Top Right Dropdown Menu */}
      {user && (
        <div
          className="fixed top-5 right-4 md:right-8 z-[100]"
          ref={dropdownRef}
        >
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-2xl transition-all duration-300 border ${isDropdownOpen
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
                className="absolute top-14 right-0 w-72 bg-[#080d1a]/95 backdrop-blur-2xl border border-[#2d6af2]/30 rounded-[2rem] shadow-[0_0_50px_rgba(45,106,242,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col font-body z-[101]"
              >
                {/* User Header */}
                <div className="p-6 bg-gradient-to-br from-white/[0.05] to-transparent border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#2d6af2]/20 flex items-center justify-center border border-[#2d6af2]/30 overflow-hidden">
                      {user.avatar ? (
                        <Image
                          src={user.avatar}
                          alt={user.username}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-6 h-6 text-[#2d6af2]" />
                      )}
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
                        <Minimize className="w-4 h-4 text-[#00ff9d]" />
                      ) : (
                        <Maximize className="w-4 h-4 text-[#00ff9d]" />
                      )}
                    </div>

                    <span className="text-sm font-medium tracking-wide">
                      {isFullscreen ? t('homepage.menu.exit_fullscreen') : t('homepage.menu.fullscreen')}
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
                      <PlayCircle className="w-4 h-4 text-[#00ff9d]" />
                    </div>
                    <span className="text-sm font-medium tracking-wide">
                      {t('homepage.menu.how_to_play')}
                    </span>
                  </button>

                  <button className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group opacity-50 cursor-not-allowed">
                    <div className="p-2 rounded-xl bg-gray-500/10 transition-colors">
                      <DownloadIcon className="w-4 h-4 text-[#00ff9d]" />
                    </div>
                    <span className="text-sm font-medium tracking-wide">
                      {t('homepage.menu.install_app')}
                    </span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                      className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl hover:bg-white/5 text-gray-400 hover:text-white transition-all group"
                    >
                      <div className="p-2 rounded-xl bg-gray-500/10 group-hover:bg-[#2d6af2]/20 transition-colors">
                        <Globe className="w-4 h-4 text-[#2d6af2]" />
                      </div>
                      <span className="text-sm font-medium tracking-wide flex-1 text-left">
                        {t('homepage.menu.language')}
                      </span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isLanguageOpen ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isLanguageOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="px-3 pb-2 space-y-1 overflow-hidden"
                        >
                          {[
                            { code: "en", label: "English", sub: "Global" },
                            { code: "id", label: "Indonesia", sub: "Bahasa" },
                            { code: "ar", label: "العربية", sub: "Arabic" },
                          ].map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => {
                                i18n.changeLanguage(lang.code);
                                setIsLanguageOpen(false);
                                setIsDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all ${i18n.language.startsWith(lang.code)
                                ? "bg-[#2d6af2]/10 text-[#2d6af2] border border-[#2d6af2]/20 shadow-[0_4px_12px_rgba(45,106,242,0.1)]"
                                : "hover:bg-white/5 text-gray-500 hover:text-gray-300"
                                }`}
                            >
                              <div className="flex flex-col items-start translate-x-1">
                                <span className="text-xs font-bold uppercase tracking-widest">{lang.label}</span>
                              </div>
                              {i18n.language.startsWith(lang.code) && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[#2d6af2] shadow-[0_0_8px_#2d6af2]" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
                      {t('homepage.menu.logout')}
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
              className="w-full max-w-lg bg-[#080d1a]/98 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_0_50px_rgba(45,106,242,0.12)] overflow-hidden"
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
                    {t('homepage.how_to_play.title')}
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
                    title: t('homepage.how_to_play.step1.title'),
                    desc: t('homepage.how_to_play.step1.desc'),
                    color: "text-[#00ff9d]",
                    bg: "bg-[#00ff9d]/10 border-[#00ff9d]/20",
                  },
                  {
                    icon: <Target className="w-5 h-5" />,
                    title: t('homepage.how_to_play.step2.title'),
                    desc: t('homepage.how_to_play.step2.desc'),
                    color: "text-[#2d6af2]",
                    bg: "bg-[#2d6af2]/10 border-[#2d6af2]/20",
                  },
                  {
                    icon: <Users className="w-5 h-5" />,
                    title: t('homepage.how_to_play.step3.title'),
                    desc: t('homepage.how_to_play.step3.desc'),
                    color: "text-purple-400",
                    bg: "bg-purple-400/10 border-purple-400/20",
                  },
                  {
                    icon: <Trophy className="w-5 h-5" />,
                    title: t('homepage.how_to_play.step4.title'),
                    desc: t('homepage.how_to_play.step4.desc'),
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
                  {t('homepage.how_to_play.button')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-20 flex flex-col items-center justify-center min-h-screen w-full max-w-7xl mx-auto p-4 md:p-8">
        <header className="text-center mb-10 md:mb-14 relative z-30 w-full flex flex-col items-center">
          <div className="relative group">
            <Image
              src="/assets/logo/logo1.png"
              alt="GameForSmart Logo"
              width={500}
              height={150}
              className="object-contain w-[280px] md:w-[450px] drop-shadow-[0_0_30px_rgba(45,106,242,0.6)] group-hover:drop-shadow-[0_0_40px_rgba(45,106,242,0.8)] transition-all duration-500 scale-95 group-hover:scale-100"
              priority
            />
          </div>
          
          {/* Interactive Slogan */}
          <div className="mt-2 md:mt-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex items-center justify-center gap-2 md:gap-5"
            >
              {[
                { word: "RACE", color: "white" },
                { word: "LEARN", color: "#00ff9d" },
                { word: "DOMINATE", color: "white" }
              ].map((item, idx) => (
                <div key={item.word} className="flex items-center">
                  <span 
                    className="font-display text-[10px] sm:text-lg md:text-2xl font-black italic tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.4em] transition-all duration-300 cursor-default hover:text-[#00ff9d] hover:scale-110 hover:skew-x-[-12deg] active:scale-95"
                    style={{ 
                      color: item.color,
                      textShadow: '0 0 15px rgba(255,255,255,0.2)'
                    }}
                  >
                    {item.word}
                  </span>
                  {idx < 2 && (
                    <div className="mx-1.5 sm:mx-3 md:mx-4 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#2d6af2] shadow-[0_0_10px_#2d6af2]" />
                  )}
                </div>
              ))}
            </motion.div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-16 w-full justify-center items-stretch max-w-5xl">
          {/* Host Card */}
          <div className="host-card rounded-[2rem] p-8 md:p-10 flex-1 flex flex-col items-center justify-between gap-12 relative overflow-hidden group transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#00ff9d]/20 to-transparent rounded-bl-full pointer-events-none"></div>
            <div className="w-full text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#000000]/50 border border-white/10 mb-6 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                <Gamepad2 className="w-8 h-8 text-[#00ff9d]" />
              </div>
              <h2 className="font-body font-bold text-4xl text-white mb-2 tracking-wide glow-text uppercase">
                {t('homepage.host.title')}
              </h2>
              <p className="text-gray-400 text-sm font-light tracking-wider">
                {t('homepage.host.subtitle')}
              </p>
            </div>
            <div className="w-full">
              <button
                onClick={handleHost}
                className="w-full bg-gradient-to-r from-[#1a45c4] via-[#2d6af2] to-[#1a45c4] hover:shadow-[0_0_20px_rgba(45,106,242,0.6)] text-white font-display text-sm py-4 px-6 rounded-xl transition-all duration-300 uppercase tracking-wider transform active:scale-[0.98] font-bold"
              >
                  {t('homepage.host.button')}
              </button>
            </div>
          </div>

          {/* Join Card */}
          <div className="join-card rounded-[2rem] p-8 md:p-10 flex-1 flex flex-col items-center justify-center gap-12 relative overflow-hidden group transition-all duration-300">
            <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-[#2d6af2]/20 to-transparent rounded-br-full pointer-events-none"></div>
            <div className="w-full text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#000000]/50 border border-white/10 mb-6 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                <LogIn className="w-8 h-8 text-[#2d6af2]" />
              </div>
              <h2 className="font-body font-bold text-4xl text-white mb-2 tracking-wide glow-text uppercase">
                {t('homepage.join.title')}
              </h2>
              <p className="text-gray-400 text-sm font-light tracking-wider">
                {t('homepage.join.subtitle')}
              </p>
            </div>
            <div className="w-full space-y-3">
              <div className="relative group/input">
                <input
                  className="w-full bg-white/[0.03] border border-white/[0.07] text-white font-display text-center text-sm py-4 px-4 rounded-xl focus:outline-none focus:border-[#00ff9d]/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(0,255,157,0.1)] transition-all placeholder:font-display placeholder:text-xs uppercase tracking-widest placeholder:text-gray-600"
                  maxLength={6}
                  placeholder={t('homepage.join.placeholder')}
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
              <button
                onClick={handleJoin}
                className="w-full bg-gradient-to-r from-teal-500 via-[#00ff9d] to-teal-500 hover:shadow-[0_0_20px_rgba(0,255,157,0.5)] text-[#04060f] font-display text-sm py-4 px-6 rounded-xl transition-all duration-300 uppercase tracking-wider transform active:scale-[0.98] font-bold"
              >
                  {t('homepage.join.button')}
              </button>
            </div>
          </div>
        </div>

        <div className="absolute top-1/4 left-10 w-1 h-24 bg-gradient-to-b from-transparent via-[#2d6af2]/50 to-transparent blur-sm hidden lg:block"></div>
        <div className="absolute bottom-1/3 right-10 w-1 h-32 bg-gradient-to-b from-transparent via-[#00ff9d]/40 to-transparent blur-sm hidden lg:block"></div>
      </main>
    </div>
  );
}
