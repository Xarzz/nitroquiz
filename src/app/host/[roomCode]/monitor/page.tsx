"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Users, Skull } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

// ── Lap Indicator: BIG NUMBER ──
function LapIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
      }}
    >
      <span
        style={{
          fontFamily: "Orbitron, monospace",
          fontSize: "26px",
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1,
          textShadow: "0 0 10px rgba(147,197,253,0.8)",
        }}
      >
        {current}
      </span>

      <span
        style={{
          fontFamily: "Orbitron, monospace",
          fontSize: "10px",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        / {total}
      </span>
    </div>
  );
}

// ── Single Player Card ──
function PlayerCard({
  player,
  rank,
  totalQuestions,
}: {
  player: Participant;
  rank: number;
  totalQuestions: number;
}) {
  const baseCar = (player.car_character || "purple").replace("-bot", "");
  const avatarSrc =
    player.avatar_url ||
    logoImageMap[baseCar] ||
    "/assets/characters/scloski/logo/logo1.png";

  const isFinished =
    player.finished_at !== null || player.current_question >= totalQuestions;
  const isNew = player.current_question === 0 && !player.finished_at && !player.eliminated;

  const rankColors: Record<number, string> = {
    0: "#f59e0b",
    1: "#94a3b8",
    2: "#b45309",
  };
  const rankColor = rankColors[rank] ?? "rgba(255,255,255,0.15)";

  let statusLabel = "RACING";
  let statusBg = "rgba(255,255,255,0.05)";
  let statusBorder = "rgba(255,255,255,0.12)";
  let statusText = "rgba(255,255,255,0.45)";
  let statusPulse = false;

  if (isFinished) {
    statusLabel = "FINISH";
    statusBg = "rgba(16,185,129,0.12)";
    statusBorder = "rgba(16,185,129,0.5)";
    statusText = "#34d399";
  } else if (player.eliminated) {
    statusLabel = "CRASHED";
    statusBg = "rgba(239,68,68,0.12)";
    statusBorder = "rgba(239,68,68,0.5)";
    statusText = "#f87171";
  } else if (player.minigame) {
    statusLabel = "QUIZ";
    statusBg = "rgba(59,130,246,0.12)";
    statusBorder = "rgba(59,130,246,0.5)";
    statusText = "#93c5fd";
    statusPulse = true;
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        borderRadius: "12px",
        overflow: "hidden",
        background: "linear-gradient(135deg, rgba(16,26,52,0.97) 0%, rgba(11,16,32,0.97) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
      }}
    >
      {/* Left rank stripe */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "3px",
          background: rankColor,
          boxShadow: `0 0 8px ${rankColor}`,
        }}
      />

      {/* Avatar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px",
          marginLeft: "3px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            flexShrink: 0,
            overflow: "hidden",
            border: `2px solid ${rankColor}`,
            boxShadow: `0 0 10px ${rankColor}40`,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {isNew && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                textAlign: "center",
                padding: "2px 0",
                background: "rgba(37,99,235,0.85)",
                fontFamily: "Orbitron, monospace",
                fontSize: "7px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: "#bfdbfe",
                textTransform: "uppercase",
              }}
            >
              NEW
            </div>
          )}
          {player.eliminated ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(239,68,68,0.15)",
              }}
            >
              <Skull size={28} color="#f87171" />
            </div>
          ) : player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={player.nickname}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={logoImageMap[baseCar] || "/assets/characters/scloski/logo/logo1.png"}
                alt={player.nickname}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transform: "scale(2.1)",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div
        style={{
          flex: 1,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "5px",
          minWidth: 0,
        }}
      >
        {/* Name + Lap indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontFamily: "Orbitron, monospace",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.92)",
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {player.nickname}
          </span>
          <span
            style={{
              fontFamily: "Orbitron, monospace",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              flexShrink: 0,
              background: "rgba(255,255,255,0.06)",
              padding: "2px 8px",
              borderRadius: "6px",
            }}
          >
            LAP {player.current_question}/{totalQuestions}
          </span>
        </div>

        {/* Score + Status row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "2px 8px",
              borderRadius: "6px",
              background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.3)",
            }}
          >
            <span
              style={{
                fontFamily: "Orbitron, monospace",
                fontSize: "7px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "rgba(147,197,253,0.6)",
                textTransform: "uppercase",
              }}
            >
              SCORE
            </span>
            <span
              style={{
                fontFamily: "Orbitron, monospace",
                fontSize: "12px",
                fontWeight: 900,
                color: "#93c5fd",
                lineHeight: 1,
              }}
            >
              {player.score.toLocaleString()}
            </span>
          </div>

          {/* Status badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "2px 8px",
              borderRadius: "6px",
              background: statusBg,
              border: `1px solid ${statusBorder}`,
              color: statusText,
              fontFamily: "Orbitron, monospace",
              fontSize: "8.5px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {statusPulse && (
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: statusText,
                  animation: "pulse 1.5s infinite",
                  flexShrink: 0,
                }}
              />
            )}
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Position indicator (right side) */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 14px",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          minWidth: "80px",
          gap: "4px",
        }}
      >
        {/* No POS label as requested */}

        <span
          style={{
            fontFamily: "Orbitron, monospace",
            fontSize: "24px",
            fontWeight: 900,
            fontStyle: "italic",
            color: rankColor,
            textShadow: `0 0 12px ${rankColor}80`,
            lineHeight: 1,
          }}
        >
          #{rank + 1}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function GameMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isEnding, setIsEnding] = useState(false);

  const participantsRef = useRef(participants);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("id, question_limit, total_time_minutes, started_at")
          .eq("game_pin", roomCode)
          .single();

        if (sessionError) return;

        if (sessionData) {
          setSessionId(sessionData.id);
          setTotalQuestions(sessionData.question_limit || 5);
          setTimeLeft((sessionData.total_time_minutes || 5) * 60);

          const { data: pData } = await supabase
            .from("participants")
            .select("*")
            .eq("session_id", sessionData.id);

          if (pData) setParticipants(pData as Participant[]);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    fetchInitialData();
  }, [roomCode]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel("host_game_monitor")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as Participant;
          setParticipants((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new as Participant]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  useEffect(() => {
    if (timeLeft <= 0) { handleEndRace(); return; }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (!sessionId || participants.length === 0 || isEnding) return;
    const allDone = participants.every((p) => p.finished_at !== null || p.eliminated === true);
    if (allDone) handleEndRace();
  }, [participants, sessionId, isEnding]);

  useEffect(() => {
    if (!sessionId || isEnding) return;
    const botInterval = setInterval(() => {
      const currentPlayers = participantsRef.current;
      const activeBots = currentPlayers.filter(
        (p) => p.car_character?.endsWith("-bot") && !p.eliminated && p.current_question < totalQuestions && p.finished_at === null
      );
      activeBots.forEach(async (bot) => {
        if (Math.random() > 0.4) {
          const nextQ = bot.current_question + 1;
          const scoreAdd = Math.floor(Math.random() * 80) + 20;
          const isFinished = nextQ >= totalQuestions;
          try {
            await supabase.from("participants").update({
              current_question: nextQ,
              score: bot.score + scoreAdd,
              finished_at: isFinished ? new Date().toISOString() : null,
            }).eq("id", bot.id);
          } catch (e) { console.error("Bot error:", e); }
        }
      });
    }, 3000);
    return () => clearInterval(botInterval);
  }, [sessionId, isEnding, totalQuestions]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndRace = async () => {
    if (isEnding || !sessionId) return;
    setIsEnding(true);
    try {
      await supabase.from("sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
      router.push(`/host/${roomCode}/leaderboard`);
    } catch (error) {
      console.error("Failed to end race:", error);
      setIsEnding(false);
    }
  };

  const rankedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.current_question - a.current_question;
    });
  }, [participants]);


  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07091a",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Rajdhani, sans-serif",
        color: "white",
      }}
    >
      {/* BG Grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.25,
          backgroundImage: `
            linear-gradient(rgba(45,106,242,0.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45,106,242,0.18) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      {/* Radial center glow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 55% at 50% 50%, rgba(45,106,242,0.07) 0%, transparent 70%)",
        }}
      />
      {/* Purple corner accents */}
      <div style={{ position: "fixed", bottom: 0, left: 0, zIndex: 0, pointerEvents: "none", width: "320px", height: "320px", background: "radial-gradient(circle at bottom left, rgba(139,92,246,0.35) 0%, transparent 70%)", opacity: 0.2 }} />
      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 0, pointerEvents: "none", width: "320px", height: "320px", background: "radial-gradient(circle at top right, rgba(139,92,246,0.3) 0%, transparent 70%)", opacity: 0.15 }} />

      {/* ── HEADER ── */}
      <div
        style={{
          position: "relative",
          zIndex: 20,
          width: "100%",
          padding: "40px 24px 20px", // Increased top padding to move elements down
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent", // Removed solid background
          backdropFilter: "none", // Removed blur wrapper
          borderBottom: "none", // Removed border line
        }}
      >
        {/* Left: Logo + count */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/assets/logo/logo1.png"
            alt="NitroQuiz Logo"
            style={{ height: "40px", objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(45,106,242,0.5))" }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              borderRadius: "8px",
              background: "rgba(26,34,53,0.8)",
              border: "1px solid rgba(45,106,242,0.3)",
            }}
          >
            <Users size={13} color="#60a5fa" />
            <span style={{ fontFamily: "Orbitron, monospace", fontSize: "12px", color: "#60a5fa", letterSpacing: "0.15em" }}>
              {participants.length}
            </span>
          </div>
        </div>

        {/* Center: LIVE TIMING + Timer */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >

          <div
            style={{
              padding: "6px 28px",
              borderRadius: "10px",
              background: "rgba(10,14,30,0.95)",
              border: "2px solid rgba(45,106,242,0.6)",
              boxShadow: "0 0 20px rgba(45,106,242,0.3), inset 0 0 10px rgba(45,106,242,0.05)",
            }}
          >
            <span
              style={{
                fontFamily: "Orbitron, monospace",
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: timeLeft < 60 ? "#ef4444" : "#93c5fd",
                textShadow: `0 0 12px ${timeLeft < 60 ? "#ef4444" : "#93c5fd"}`,
              }}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Right: logo2 + END RACE */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src="/assets/logo/logo2.png"
            alt="GameForSmart.com"
            style={{ height: "36px", objectFit: "contain", opacity: 0.75 }}
          />
          <button
            onClick={handleEndRace}
            disabled={isEnding}
            style={{
              padding: "9px 22px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
              border: "1px solid rgba(239,68,68,0.5)",
              boxShadow: "0 0 16px rgba(220,38,38,0.35)",
              color: "#fecaca",
              fontFamily: "Orbitron, monospace",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              cursor: isEnding ? "not-allowed" : "pointer",
              opacity: isEnding ? 0.5 : 1,
            }}
          >
            {isEnding ? "ENDING..." : "END RACE"}
          </button>
        </div>
      </div>

      {/* ── LEADERBOARD ── */}
      <div
        style={{
          position: "relative",
          zIndex: 20,
          flex: 1,
          padding: "14px 16px",
          overflowY: "auto",
        }}
      >
        {/* Label */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px", paddingRight: "4px" }}>
          <span style={{ fontFamily: "Orbitron, monospace", fontSize: "9px", letterSpacing: "0.35em", color: "rgba(147,197,253,0.45)", textTransform: "uppercase" }}>
            LEADERBOARD
          </span>
        </div>

        <div className="leaderboard-grid" style={{ maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
          {rankedParticipants.map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              rank={index}
              totalQuestions={totalQuestions}
            />
          ))}

          {participants.length === 0 && (
            <div
              className="empty-grid-msg"
              style={{
                height: "240px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "16px",
                background: "rgba(0,0,0,0.2)",
                border: "1px dashed rgba(255,255,255,0.07)",
              }}
            >
              <Users size={36} style={{ opacity: 0.2, marginBottom: "12px" }} />
              <p style={{ fontFamily: "Orbitron, monospace", fontSize: "11px", letterSpacing: "0.4em", textTransform: "uppercase", opacity: 0.25 }}>
                Waiting for Grid...
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .leaderboard-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .leaderboard-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1280px) {
          .leaderboard-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .empty-grid-msg {
          grid-column: 1 / -1;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}