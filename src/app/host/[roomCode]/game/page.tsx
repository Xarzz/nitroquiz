"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Users, Clock, Flag, Trophy, Skull } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

const carImageMap: Record<string, string> = {
  purple: "/assets/characters/scloski/showroom/showroom1.png",
  white: "/assets/characters/scloski/showroom/showroom2.png",
  black: "/assets/characters/scloski/showroom/showroom1.png",
  aqua: "/assets/characters/scloski/showroom/showroom2.png",
  blue: "/assets/characters/scloski/showroom/showroom1.png",
};

const monitorGifMap: Record<string, string> = {
  purple: "/assets/characters/scloski/monitor/monitor1.gif",
  white: "/assets/characters/scloski/monitor/monitor1.gif",
  black: "/assets/characters/scloski/monitor/monitor1.gif",
  aqua: "/assets/characters/scloski/monitor/monitor1.gif",
  blue: "/assets/characters/scloski/monitor/monitor1.gif",
};

const logoImageMap: Record<string, string> = {
  purple: "/assets/characters/scloski/logo/logo1.png",
  white: "/assets/characters/scloski/logo/logo1.png",
  black: "/assets/characters/scloski/logo/logo1.png",
  aqua: "/assets/characters/scloski/logo/logo1.png",
  blue: "/assets/characters/scloski/logo/logo1.png",
};

interface Participant {
  id: string;
  nickname: string;
  car_character: string;
  score: number;
  current_question: number;
  finished_at: string | null;
  eliminated: boolean;
  minigame?: boolean;
  user_id?: string | null;
  avatar_url?: string | null;
}

export default function GameMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Session state
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins default
  const [isEnding, setIsEnding] = useState(false);

  // Track participants using ref for bot logic interval
  const participantsRef = useRef(participants);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // 1. Initial Load: Get Session and Participants
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch Session
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("id, question_limit, total_time_minutes, started_at")
          .eq("game_pin", roomCode)
          .single();

        if (sessionError) {
          console.error("Session fetch error:", sessionError);
          // alert("Could not load session data!");
          return;
        }

        if (sessionData) {
          setSessionId(sessionData.id);
          setTotalQuestions(sessionData.question_limit || 5);
          setTimeLeft((sessionData.total_time_minutes || 5) * 60);

          // Fetch Participants
          const { data: pData } = await supabase
            .from("participants")
            .select("*")
            .eq("session_id", sessionData.id);

          if (pData) {
            setParticipants(pData as Participant[]);
          }

          // Session status already set to "active" from lobby page
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    fetchInitialData();
  }, [roomCode]);

  // 2. Real-time Subscription for Player Updates
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel("host_game_monitor")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = payload.new as Participant;
          setParticipants((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new as Participant]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // 3. Timer Logic
  useEffect(() => {
    if (timeLeft <= 0) {
      handleEndRace();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // 3.5 Auto-end when ALL players finish (no need to wait for timer)
  useEffect(() => {
    if (!sessionId || participants.length === 0 || isEnding) return;
    const allDone = participants.every(p =>
      p.finished_at !== null || p.eliminated === true
    );
    if (allDone) {
      // Jump immediately
      handleEndRace();
    }
  }, [participants, sessionId, isEnding]);

  // 4. Bot Brain System
  useEffect(() => {
    if (!sessionId || isEnding) return;

    // Bot actions run every 3 seconds
    const botInterval = setInterval(() => {
      // Retrieve latest participant data from ref
      const currentPlayers = participantsRef.current;

      // Find all active bots who haven't finished yet
      const activeBots = currentPlayers.filter(
        (p) =>
          p.car_character?.endsWith("-bot") &&
          !p.eliminated &&
          p.current_question < totalQuestions &&
          p.finished_at === null,
      );

      // Give each bot a 60% chance to answer and advance per tick (simulates thinking)
      activeBots.forEach(async (bot) => {
        if (Math.random() > 0.4) {
          const nextQ = bot.current_question + 1;
          // Bots can gain random score simulating "Time Multiplier" logic
          const scoreAdd = Math.floor(Math.random() * 80) + 20;
          const isFinished = nextQ >= totalQuestions;

          try {
            await supabase
              .from("participants")
              .update({
                current_question: nextQ,
                score: bot.score + scoreAdd,
                finished_at: isFinished ? new Date().toISOString() : null,
              })
              .eq("id", bot.id);
          } catch (e) {
            console.error("Bot action error:", e);
          }
        }
      });
    }, 3000);

    return () => clearInterval(botInterval);
  }, [sessionId, isEnding, totalQuestions]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndRace = async () => {
    if (isEnding || !sessionId) return;
    setIsEnding(true);

    try {
      await supabase
        .from("sessions")
        .update({ status: "finished", ended_at: new Date().toISOString() })
        .eq("id", sessionId);

      // Navigate to Podium/Leaderboard
      router.push(`/host/${roomCode}/podium`);
    } catch (error) {
      console.error("Failed to end race:", error);
      setIsEnding(false);
    }
  };

  // Derived states
  // Sort players by position (score and progression)
  const rankedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.current_question - a.current_question;
    });
  }, [participants]);

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden font-rajdhani text-white flex flex-col">
      {/* Dark Space & Grids Background */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0a0a0f] to-[#050508] pointer-events-none"></div>
      
      {/* Fine Grid lines */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(45,106,242,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45,106,242,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px'
        }}
      />

      {/* Decorative vertical lines / stripes from image */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-10">
        <div className="absolute left-10 top-0 bottom-0 w-[1px] bg-blue-500" />
        <div className="absolute left-12 top-0 bottom-0 w-[1px] bg-blue-500/50" />
      </div>

      <div className="scanlines z-10 opacity-10 pointer-events-none"></div>

      {/* Header / HUD */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 w-full px-8 py-3 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl"
      >
        <div className="flex items-center gap-4">
          <Image
            src="/assets/logo/logo2.png"
            alt="NitroQuiz"
            width={200}
            height={50}
            className="object-contain drop-shadow-[0_0_8px_rgba(45,106,242,0.5)]"
            priority
          />
          
          <div className="flex items-center gap-2 bg-[#1a2235] border border-[#2d6af2]/30 px-3 py-1.5 rounded-lg shadow-[inset_0_0_10px_rgba(45,106,242,0.1)]">
            <Users size={14} className="text-[#2d6af2]" />
            <span className="font-orbitron text-xs tracking-widest text-blue-400">
              {participants.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Digital Timer Box */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-blue-500/20 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center gap-3 bg-[#0a0f1e] border-2 border-blue-500/50 px-6 py-2 rounded-xl shadow-[0_0_20px_rgba(45,106,242,0.4)]">
              <span className={`font-orbitron text-3xl tracking-[0.15em] ${timeLeft < 60 ? "text-red-500 animate-pulse" : "text-blue-400"}`} style={{ textShadow: '0 0 10px currentColor' }}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          <button
            onClick={handleEndRace}
            disabled={isEnding}
            style={{
                background: 'linear-gradient(135deg, #991b1b 0%, #450a0a 100%)',
                boxShadow: '0 0 20px rgba(220, 38, 38, 0.4)'
            }}
            className={`relative group px-8 py-3 rounded-lg border border-red-500/50 overflow-hidden transition-all active:scale-95 ${isEnding ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-400'}`}
          >
            <div className="absolute inset-0 bg-red-600/20 group-hover:bg-red-600/30 transition-colors" />
            <span className="relative z-10 font-orbitron text-xs font-bold tracking-[0.2em] text-red-100">
              {isEnding ? "ENDING..." : "END RACE"}
            </span>
          </button>
        </div>
      </motion.div>

      {/* Main Tracks Area */}
      <div className="relative z-20 flex-1 w-full mx-auto p-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-3">
          {/* Leaderboard Title from image */}
          <div className="flex justify-end pr-4">
             <span className="font-orbitron text-[10px] tracking-[0.3em] text-blue-500/60 uppercase">Leaderboard</span>
          </div>

          <AnimatePresence>
            {rankedParticipants.map((player, index) => {
              const rawProgress = totalQuestions > 0 ? (player.current_question / totalQuestions) * 100 : 0;
              const progress = Math.min(100, Math.max(0, rawProgress));
              const isFinished = player.finished_at !== null || progress >= 100;
              
              const baseCar = (player.car_character || "purple").replace("-bot", "");
              const carSrc = carImageMap[baseCar] || carImageMap["purple"];

              return (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative flex items-center bg-[#0d1425]/80 backdrop-blur-md border border-white/5 rounded-xl px-6 py-3 group hover:border-blue-500/30 transition-all shadow-xl"
                  style={{
                    background: 'linear-gradient(90deg, #111b33 0%, #0d121f 100%)'
                  }}
                >
                  {/* Subtle edge glow for top 3 */}
                  {index < 3 && (
                    <div className={`absolute inset-y-0 left-0 w-1 ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-300' : 'bg-amber-700'} shadow-[0_0_10px_currentColor]`} />
                  )}

                  {/* Rank */}
                  <div className="w-14 flex-shrink-0 flex items-center justify-center">
                    <span className={`font-orbitron text-2xl font-black italic ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-700' : 'text-white/20'}`}>
                      #{index + 1}
                    </span>
                  </div>

                  {/* Avatar Slot */}
                  <div className="relative mr-6">
                      <div className="w-16 h-16 rounded-full border-2 border-white/20 bg-black/40 overflow-hidden flex items-center justify-center p-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <img 
                            src={logoImageMap[baseCar] || "/assets/characters/scloski/logo/logo1.png"} 
                            alt="Avatar" 
                            className="w-full h-full object-contain p-0 scale-130 drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]" 
                          />
                        )}
                      </div>
                    {/* Rank specific badge/circle */}
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-[#1a2235] text-white'}`}>
                      {index + 1}
                    </div>
                  </div>

                  {/* Player Stats */}
                  <div className="w-44 flex-shrink-0 flex flex-col justify-center gap-0.5">
                    <h3 className="font-orbitron text-sm font-bold tracking-widest text-white/90 truncate uppercase">{player.nickname}</h3>
                    <div className="flex items-center gap-1.5">
                       <span className="text-yellow-500 text-xs">⭐</span>
                       <span className="font-mono text-xs text-blue-400 font-bold">{player.score.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Visual Track Area (The SVG Wavy line logic from image) */}
                  <div className="flex-1 relative h-16 mx-4 flex items-center">
                    {/* Decorative wavy lines mimicking the image */}
                    <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full w-full opacity-20" preserveAspectRatio="none">
                      <path 
                        d="M 0 30 Q 50 10 100 30 T 200 30 T 300 30 T 400 30 T 500 30" 
                        stroke="#2d6af2" 
                        strokeWidth="2" 
                        fill="none" 
                        vectorEffect="non-scaling-stroke"
                        className="animate-pulse"
                      />
                    </svg>

                    {/* Progress Track Line */}
                    <div className="absolute inset-x-0 h-[2px] bg-white/5">
                        <motion.div 
                          className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"
                          animate={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Moving Car */}
                    <motion.div
                      className="absolute left-0 z-20 flex items-center justify-center -ml-10"
                      animate={{ left: `${progress}%` }}
                      transition={{ type: "spring", stiffness: 45, damping: 15 }}
                    >
                      <div className="relative group/car">
                        {/* Speed lines/trails */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-20 h-8 bg-gradient-to-r from-transparent to-blue-500/20 blur-sm pointer-events-none" />
                        
                        {player.eliminated ? (
                          <div className="w-16 h-12 flex items-center justify-center bg-red-500/20 rounded-full border border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                            <Skull className="text-red-500" size={24} />
                          </div>
                        ) : (
                          <div className="w-24 drop-shadow-[0_0_15px_rgba(0,195,255,0.4)] transition-transform group-hover/car:scale-110">
                            <img 
                              src={monitorGifMap[baseCar] || "/assets/characters/scloski/monitor/monitor1.gif"} 
                              alt="car" 
                              className="w-full h-auto object-contain" 
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* Progress Detail */}
                  <div className="w-24 flex-shrink-0 flex flex-col items-center justify-center border-l border-white/5">
                    <span className="text-[10px] text-white/30 uppercase font-black tracking-tighter">LAP</span>
                    <div className="flex items-center gap-1.5 font-orbitron font-bold">
                        <span className="text-sm text-white/80">{player.current_question}/{totalQuestions}</span>
                        <Flag size={14} className="text-emerald-400" />
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="w-32 flex-shrink-0 flex justify-end pl-4">
                    <div className={`
                      px-4 py-1.5 rounded-full text-[10px] font-orbitron font-black tracking-[0.2em] uppercase text-center w-full border
                      ${isFinished ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 
                        player.eliminated ? 'bg-red-500/10 border-red-500/40 text-red-400' :
                        player.minigame ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 animate-pulse' :
                        'bg-white/5 border-white/10 text-white/40'}
                    `}>
                      {isFinished ? 'FINISH' : player.eliminated ? 'CRASHED' : player.minigame ? 'QUIZ' : 'RACING'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {participants.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-gray-700 bg-black/20 rounded-2xl border border-white/5 border-dashed">
              <Users size={40} className="mb-4 opacity-20" />
              <p className="font-orbitron tracking-[0.4em] text-xs uppercase opacity-30">
                Waiting for Grid...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
