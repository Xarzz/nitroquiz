"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Crown,
  Medal,
  Users,
  Clock,
  Star,
  ChevronRight,
  LayoutDashboard,
  House,
  RotateCcw,
  BarChart2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import { useTranslation } from "react-i18next";

const carImageMap: Record<string, string> = {
  purple: "/assets/characters/rico/showroom/showroom1.png",
  white: "/assets/characters/rico/showroom/showroom2.png",
  black: "/assets/characters/rico/showroom/showroom1.png",
  aqua: "/assets/characters/rico/showroom/showroom2.png",
  blue: "/assets/characters/rico/showroom/showroom1.png",
};


// Helper: Generate initials from a name
const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// Initials avatar colors based on nickname hash
const AVATAR_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#f97316'];
const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Reusable InitialsAvatar component
const InitialsAvatar = ({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const fontSize = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-base' : 'text-xs';
  return (
    <div
      className={`w-full h-full rounded-full flex items-center justify-center ${fontSize} font-black text-white select-none`}
      style={{ backgroundColor: getAvatarColor(name) }}
    >
      {getInitials(name)}
    </div>
  );
};

interface Participant {
  id: string;
  nickname: string;
  car_character: string;
  score: number;
  current_question: number;
  finished_at: string | null;
  duration: number;
  eliminated: boolean;
  avatar_url?: string | null;
}

export default function LeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const roomCode = params.roomCode as string;

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("id")
          .eq("game_pin", roomCode)
          .single();

        if (sessionError || !sessionData) {
          console.error("Session not found", sessionError);
          return;
        }

        setSessionId(sessionData.id);

        const { data: pData, error: pError } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", sessionData.id);

        if (!pError && pData) {
          setParticipants(pData as Participant[]);
        }
      } catch (err) {
        console.error("Failed to load leaderboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [roomCode]);

  const rankedPlayers = [...participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dA = a.duration || Infinity;
    const dB = b.duration || Infinity;
    return dA - dB;
  });

  const triggerConfetti = () => {
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 };
    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;
    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        setShowResults(true);
        if (rankedPlayers.length > 0) setTimeout(() => triggerConfetti(), 1500);
      }, 800);
    }
  }, [isLoading, rankedPlayers.length]);

  const podiumVariants: any = {
    hidden: { y: 150, opacity: 0 },
    visible: (custom: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 70,
        damping: 12,
        delay: custom * 0.35 + 0.4,
      },
    }),
  };

  const firstPlace = rankedPlayers[0];
  const secondPlace = rankedPlayers[1];
  const thirdPlace = rankedPlayers[2];

  const formatDuration = (seconds: number | undefined | null) => {
    if (!seconds || seconds === Infinity) return "--:--";
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f] font-display text-white">
        <div className="text-center z-10">
          <div className="w-16 h-16 border-4 border-[#2d6af2]/30 border-t-[#2d6af2] rounded-full animate-spin mx-auto mb-6"></div>
          <p className="mt-4 text-[#2d6af2] text-xl tracking-[0.2em] uppercase animate-pulse">
            {t("host_leaderboard.loading")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden font-body text-white flex flex-col items-center pb-12">
      {/* Background effects */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0a0a0f] to-[#050508] pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(45,106,242,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(45,106,242,0.05)_1px,transparent_1px)] bg-[length:40px_40px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#2d6af2]/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

      {/* Top Bar: Logo1 left, Logo2 right */}
      <div className="w-full z-30 px-4 md:px-6 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center justify-center">
          <img
            src="/assets/logo/logo1.png"
            alt="NitroQuiz Logo"
            width={140}
            height={40}
            className="object-contain"
          />
        </div>
        <img
          src="/assets/logo/logo2.png"
          alt="GameForSmart.com"
          width={240}
          height={60}
          className="object-contain opacity-70 hover:opacity-100 transition-opacity duration-300 drop-shadow-[0_0_10px_rgba(45,106,242,0.3)]"
        />
      </div>

      <div className="w-full max-w-5xl z-20 px-4 sm:px-6">
        {/* Floating Side Buttons - Desktop only */}
        <div className="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50 hidden md:flex">
          <Button
            onClick={() => router.push("/")}
            className="w-12 h-12 rounded-full p-0 bg-black/60 backdrop-blur-md border border-[#2d6af2]/50 hover:bg-[#2d6af2]/20 hover:scale-110 flex items-center justify-center text-[#2d6af2] shadow-[0_0_15px_rgba(45,106,242,0.4)] transition-all"
            title={t("host_leaderboard.home_tooltip")}
          >
            <House size={20} />
          </Button>
          <Button
            onClick={() => router.push(`/host/${roomCode}/lobby`)}
            className="w-12 h-12 rounded-full p-0 bg-black/60 backdrop-blur-md border border-[#00ff9d]/50 hover:bg-[#00ff9d]/20 hover:scale-110 flex items-center justify-center text-[#00ff9d] shadow-[0_0_15px_rgba(0,255,157,0.4)] transition-all"
            title={t("host_leaderboard.play_again_tooltip")}
          >
            <RotateCcw size={20} />
          </Button>
        </div>

        {/* Floating Side Buttons - Desktop only */}
        <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50 hidden md:flex">
          <Button
            onClick={() =>
              sessionId &&
              window.open(
                `https://gameforsmartnewui.vercel.app/stat/${sessionId}`,
                "_blank",
              )
            }
            className="w-12 h-12 rounded-full p-0 bg-black/60 backdrop-blur-md border border-[#f59e0b]/50 hover:bg-[#f59e0b]/20 hover:scale-110 flex items-center justify-center text-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all"
            title={t("host_leaderboard.stats_tooltip")}
          >
            <BarChart2 size={20} />
          </Button>
        </div>

        {/* Compact Podium */}
        {showResults && rankedPlayers.length > 0 && (
          <div className="relative flex items-end justify-center w-full h-[220px] sm:h-[300px] mt-8 mb-4 px-2">
            <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-2/3 h-16 bg-[#2d6af2]/20 blur-[30px] rounded-full pointer-events-none" />

            {/* 2nd Place */}
            {secondPlace && (
              <motion.div
                custom={2}
                variants={podiumVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center relative z-10 mx-[-8px] sm:mx-1"
              >
                <div className="mb-2 text-center">
                  <div className="bg-black/60 border border-slate-300/40 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                    <p className="font-display text-slate-200 text-xs sm:text-sm tracking-wider truncate max-w-[100px]" title={secondPlace.nickname}>
                      {secondPlace.nickname}
                    </p>
                  </div>
                </div>
                <div className="w-[85px] sm:w-[120px] h-[110px] sm:h-[140px] bg-gradient-to-b from-[#1a2235] to-[#0a0f1a] border-t-4 border-l border-r border-[#64748b] rounded-t-xl flex flex-col items-center justify-between py-2 sm:py-3">
                  <div className="relative">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-slate-400/30 bg-black/40 overflow-hidden flex items-center justify-center p-0 shadow-inner relative z-10">
                      {secondPlace.avatar_url ? (
                        <img
                          src={secondPlace.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <InitialsAvatar name={secondPlace.nickname} size="sm" />
                      )}
                    </div>
                  </div>
                  <span className="font-display text-2xl sm:text-4xl text-slate-300 font-bold mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
                    {secondPlace.score.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            )}

            {/* 1st Place */}
            {firstPlace && (
              <motion.div
                custom={3}
                variants={podiumVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center relative z-20 mx-0 sm:mx-2"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="mb-1"
                >
                  <Crown className="w-7 h-7 sm:w-9 sm:h-9 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
                </motion.div>
                <div className="mb-2 text-center">
                  <div className="bg-[#1a1500]/80 border border-yellow-500/60 backdrop-blur-md px-4 sm:px-5 py-2 rounded-xl shadow-[0_0_25px_rgba(250,204,21,0.3)]">
                    <p className="font-display text-yellow-500 text-sm sm:text-lg font-bold tracking-widest uppercase truncate max-w-[130px]" title={firstPlace.nickname}>
                      {firstPlace.nickname}
                    </p>
                  </div>
                </div>
                <div className="w-[100px] sm:w-[140px] h-[160px] sm:h-[200px] bg-gradient-to-b from-[#2a1f0a] to-[#0a0f1a] border-t-8 border-l-2 border-r-2 border-[#eab308] rounded-t-xl relative overflow-hidden flex flex-col items-center justify-between py-3 sm:py-5">
                  <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-[#eab308] to-transparent" />
                  <div className="absolute inset-0 bg-yellow-500/5 opacity-50 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-500/40 to-transparent" />
                  <div className="relative z-10">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-yellow-500/30 bg-black/40 overflow-hidden flex items-center justify-center p-0 shadow-inner relative z-10">
                      {firstPlace.avatar_url ? (
                        <img
                          src={firstPlace.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <InitialsAvatar name={firstPlace.nickname} size="md" />
                      )}
                    </div>
                  </div>
                  <span className="font-display text-3xl sm:text-5xl text-yellow-400 font-bold relative z-10 pb-0 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">
                    {firstPlace.score.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            )}

            {/* 3rd Place */}
            {thirdPlace && (
              <motion.div
                custom={1}
                variants={podiumVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center relative z-10 mx-[-8px] sm:mx-1"
              >
                <div className="mb-2 text-center">
                  <div className="bg-black/60 border border-orange-700/40 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                    <p className="font-display text-orange-200 text-xs sm:text-sm tracking-wider truncate max-w-[100px]" title={thirdPlace.nickname}>
                      {thirdPlace.nickname}
                    </p>
                  </div>
                </div>
                <div className="w-[75px] sm:w-[110px] h-[80px] sm:h-[110px] bg-gradient-to-b from-[#25140b] to-[#0a0f1a] border-t-4 border-l border-r border-[#c2410c] rounded-t-xl flex flex-col items-center justify-between py-2 sm:py-3">
                  <div className="relative">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 border-orange-700/30 bg-black/40 overflow-hidden flex items-center justify-center p-0 shadow-inner relative z-10">
                      {thirdPlace.avatar_url ? (
                        <img
                          src={thirdPlace.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <InitialsAvatar name={thirdPlace.nickname} size="sm" />
                      )}
                    </div>
                  </div>
                  <span className="font-display text-xl sm:text-3xl text-orange-300 font-bold mb-1 drop-shadow-[0_0_10px_rgba(251,146,60,0.4)]">
                    {thirdPlace.score.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Leaderboard Table */}
        {showResults && rankedPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 2.2,
              type: "spring",
              stiffness: 100,
              damping: 14,
            }}
            className="bg-black/40 backdrop-blur-xl border border-[#2d6af2]/30 rounded-2xl p-4 sm:p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
          >
            <div className="overflow-x-auto w-full custom-scrollbar max-h-[470px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2d6af2]/20 text-gray-400 font-display text-[10px] sm:text-xs tracking-wider">
                    <th className="px-2 sm:px-4 py-3 w-12 sm:w-16 text-center">
                      {t("host_leaderboard.rank")}
                    </th>
                    <th className="px-2 sm:px-4 py-3">{t("host_leaderboard.player")}</th>
                    <th className="px-2 sm:px-4 py-3 text-right">{t("host_leaderboard.score")}</th>
                    <th className="px-2 sm:px-4 py-3 text-center">{t("host_leaderboard.time")}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {rankedPlayers.map((player, index) => {
                      const isTop3 = index < 3;
                      return (
                        <motion.tr
                          key={player.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 2.5 + index * 0.1 }}
                          className={`border-b border-[#2d6af2]/10 transition-colors ${
                            isTop3
                              ? index === 0
                                ? "bg-yellow-500/5"
                                : index === 1
                                  ? "bg-slate-300/5"
                                  : "bg-orange-600/5"
                              : "hover:bg-[#2d6af2]/5"
                          }`}
                        >
                          <td className="px-2 sm:px-4 py-3 text-center">
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mx-auto font-display text-xs sm:text-sm
                                                            ${
                                                              index === 0
                                                                ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50"
                                                                : index === 1
                                                                  ? "bg-slate-300/20 text-slate-300 border border-slate-300/50"
                                                                  : index === 2
                                                                    ? "bg-orange-600/20 text-orange-400 border border-orange-600/50"
                                                                    : "bg-white/5 text-gray-500"
                                                            }`}
                            >
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-lg shadow-inner overflow-hidden flex-shrink-0">
                                {player.eliminated
                                  ? "💀"
                                  : player.avatar_url ? (
                                      <img
                                        src={player.avatar_url}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <InitialsAvatar name={player.nickname} size="sm" />
                                    )}
                              </div>
                              <p
                                className={`font-display tracking-wider uppercase text-xs sm:text-sm truncate ${isTop3 ? "text-white" : "text-gray-300"} ${index === 0 && "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"}`}
                                title={player.nickname}
                              >
                                {player.nickname}
                              </p>
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-right">
                            <span
                              className={`font-mono font-bold text-sm sm:text-base ${index === 0 ? "text-yellow-400" : "text-[#00ff9d]"}`}
                            >
                              {player.score.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center">
                            <span className="text-cyan-400 font-mono text-xs sm:text-sm">
                              {formatDuration(player.duration)}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
        {/* Actions Mobile (sm ke bawah) */}
        <div className="md:hidden bg-black/40 backdrop-blur-md w-full text-center py-4 fixed bottom-0 left-0 z-50 flex items-center justify-center space-x-4 border-t border-white/5 px-4 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          {/* Tombol Home */}
          <button
            onClick={() => router.push("/")}
            className="flex-1 bg-black/40 border border-[#2d6af2]/50 rounded-xl text-[#2d6af2] py-3.5 text-xs font-display font-bold tracking-widest uppercase hover:bg-[#2d6af2]/10 transition-all flex items-center justify-center gap-2"
          >
            <House size={16} />
            {t("host_leaderboard.home_tooltip")}
          </button>

          {/* Tombol Play Again (Restart) */}
          <button
            onClick={() => router.push(`/host/${roomCode}/lobby`)}
            className="flex-1 bg-[#00ff9d] border border-white/20 rounded-xl text-black py-3.5 text-xs font-display font-bold tracking-widest uppercase hover:bg-[#00ff9d]/80 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,157,0.3)]"
          >
            <RotateCcw size={16} />
            {t("host_leaderboard.play_again_tooltip")}
          </button>

          {/* Tombol Statistics */}
          <button
            onClick={() =>
              sessionId &&
              window.open(
                `https://gameforsmartnewui.vercel.app/stat/${sessionId}`,
                "_blank",
              )
            }
            className="flex-1 bg-black/40 border border-[#f59e0b]/50 rounded-xl text-[#f59e0b] py-3.5 text-xs font-display font-bold tracking-widest uppercase hover:bg-[#f59e0b]/10 transition-all flex items-center justify-center gap-2"
          >
            <BarChart2 size={16} />
            {t("host_leaderboard.stats_tooltip")}
          </button>
        </div>
      </div>
    </div>
  );
}
