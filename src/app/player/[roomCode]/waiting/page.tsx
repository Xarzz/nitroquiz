'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getUser } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Loader2, Zap, Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from "react-i18next";

export const PLAYER_CHARACTERS = [
    {
        id: 'rico',
        name: 'SCHLOSKI RACER',
        imageSrc: '/assets/characters/rico/showroom/showroom1.png',
        sequenceFolder: '/assets/characters/rico/showroom/pose1',
        sequenceCount: 120,
        stats: { speed: 80, accel: 60, handling: 70 }
    },
    {
        id: 'gecho',
        name: 'NINJA GECKO',
        imageSrc: '/assets/characters/gecho/showroom/showroom1.png',
        gifSrc: '/assets/characters/gecho/showroom/pose1.gif',
        stats: { speed: 70, accel: 90, handling: 80 }
    },
    {
        id: 'roadhog',
        name: 'TUSK CHOPPER',
        imageSrc: '/assets/characters/roadhog/showroom/showroom1.png',
        gifSrc: '/assets/characters/roadhog/showroom/pose.gif',
        stats: { speed: 60, accel: 80, handling: 50 }
    }
];

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
    const fontSize = size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-[10px]';
    return (
        <div 
            className={`w-full h-full rounded-full flex items-center justify-center ${fontSize} font-black text-white`}
            style={{ backgroundColor: getAvatarColor(name) }}
        >
            {getInitials(name)}
        </div>
    );
};

const SequencePlayer = ({ folder, count, isLoading, onLoad }: { folder: string, count: number, isLoading: boolean, onLoad: () => void }) => {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(f => (f + 1) % count);
        }, 30);
        return () => clearInterval(interval);
    }, [count]);

    return (
        <img src={`${folder}/${frame}.png`} 
            alt="Your Car"
            className={`object-contain drop-shadow-[0_28px_60px_rgba(40,70,200,0.22)] transition-opacity duration-300 relative z-10 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            style={{ width: '100%', maxHeight: '100%' }}
            onLoad={onLoad}
        />
    );
};

export default function PlayerWaitingPage() {
    const router = useRouter();
    const params = useParams();
    const { t } = useTranslation();
    const roomCode = params.roomCode as string;

    const [status, setStatus] = useState<"loading" | "waiting" | "countdown" | "go" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [assignedCarId, setAssignedCarId] = useState<string>("rico");
    const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
    const [pendingCharacterId, setPendingCharacterId] = useState<string>("rico");
    const [countdownValue, setCountdownValue] = useState(3);
    const [participantId, setParticipantId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [participantCount, setParticipantCount] = useState(1);
    const [username, setUsername] = useState("");
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [allParticipants, setAllParticipants] = useState<{ nickname: string; car_character: string; avatar_url?: string | null }[]>([]);
    const [isLoadingVisual, setIsLoadingVisual] = useState(true);

    useEffect(() => {
        const user = getUser();
        if (!user) { router.push(`/player/${roomCode}/login`); return; }
        setUsername(user.username || "");
        setUserAvatar(user.avatar || null);
        let cleanup: (() => void) | undefined;

        const joinRoom = async () => {
            try {
                const { data: sessionData, error: sessionError } = await supabase
                    .from("sessions").select("id, status").eq("game_pin", roomCode).single();
                if (sessionError || !sessionData) { setStatus("error"); setErrorMessage("Room not found or invalid."); return; }
                if (sessionData.status === "active") { setStatus("countdown"); return; }

                const randIndex = Math.floor(Math.random() * PLAYER_CHARACTERS.length);
                const carChoice = PLAYER_CHARACTERS[randIndex].id;
                setAssignedCarId(carChoice);
                setPendingCharacterId(carChoice);

                const { data: existingP } = await supabase.from("participants").select("id")
                    .eq("session_id", sessionData.id).eq("nickname", user.username).maybeSingle();
                
                let currentParticipantId = existingP?.id;

                if (!existingP) {
                    const { data: newP, error: insertError } = await supabase.from("participants").insert({
                        session_id: sessionData.id, user_id: user.id || null,
                        nickname: user.username, car_character: carChoice, score: 0, minigame: false,
                        avatar_url: user.avatar || null
                    }).select('id').single();
                    
                    if (insertError) { setStatus("error"); setErrorMessage("Failed to enter room. " + insertError.message); return; }
                    currentParticipantId = newP?.id;
                }

                if (currentParticipantId) {
                    localStorage.setItem('nitroquiz_game_participantId', currentParticipantId);
                    setParticipantId(currentParticipantId);
                }

                const { data: pList, count } = await supabase.from("participants")
                    .select("nickname, car_character, avatar_url", { count: "exact" }).eq("session_id", sessionData.id);
                if (count !== null) setParticipantCount(count);
                if (pList) setAllParticipants(pList);

                setStatus("waiting");
                setSessionId(sessionData.id);

                const channel = supabase.channel(`player-session-${sessionData.id}`)
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionData.id}` },
                        (payload) => { if (payload.new.status === "active") { setStatus("countdown"); preloadQuizData(sessionData.id); } })
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionData.id}` },
                        async () => {
                            const { data: pList, count } = await supabase.from("participants")
                                .select("nickname, car_character, avatar_url", { count: "exact" }).eq("session_id", sessionData.id);
                            if (count !== null) setParticipantCount(count);
                            if (pList) setAllParticipants(pList);
                        })
                    .subscribe((s) => console.log(`[Player Waiting] Realtime: ${s}`));

                const sessId = sessionData.id;
                const pollInterval = setInterval(async () => {
                    try {
                        const { data } = await supabase.from("sessions").select("status").eq("id", sessId).single();
                        if (data?.status === "active") {
                            setStatus(prev => { if (prev === "waiting") { preloadQuizData(sessId); return "countdown"; } return prev; });
                            clearInterval(pollInterval);
                        }
                    } catch (e) { console.error("Poll session error:", e); }
                }, 2000);

                cleanup = () => { clearInterval(pollInterval); supabase.removeChannel(channel); };
            } catch (err: any) { setStatus("error"); setErrorMessage(err.message || "Unknown error occurred."); }
        };

        joinRoom();
        return () => { if (cleanup) cleanup(); };
    }, [roomCode, router]);

    const preloadQuizData = async (sessId: string) => {
        try {
            const { data } = await supabase.from("sessions")
                .select("current_questions, question_limit, quiz_id, difficulty").eq("id", sessId).single();
            if (data?.current_questions) {
                let questions = data.current_questions;
                if (typeof questions === 'string') { try { questions = JSON.parse(questions); } catch (e) { } }
                localStorage.setItem('nitroquiz_game_questions', JSON.stringify(questions));
                localStorage.setItem('nitroquiz_game_roomCode', roomCode);
                localStorage.setItem('nitroquiz_game_sessionId', sessId);
                localStorage.setItem('nitroquiz_game_difficulty', data.difficulty || 'easy');
                if (data.quiz_id) localStorage.setItem('nitroquiz_game_quizId', data.quiz_id);
                localStorage.removeItem('nitroquiz_game_score');
                localStorage.removeItem('nitroquiz_game_questionIndex');
            }
            
            const difficulty = data?.difficulty || 'easy';
            const route = `/player/${roomCode}/game`;
            
            const link = document.createElement('link'); link.rel = 'prefetch'; link.href = route; document.head.appendChild(link);
        } catch (err) { console.error('Failed to preload quiz:', err); }
    };

    useEffect(() => {
        if (status !== "countdown") return;
        if (countdownValue <= 0) { 
            setStatus("go"); 
            setTimeout(() => {
                router.push(`/player/${roomCode}/game`);
            }, 800); 
            return; 
        }
        const timer = setTimeout(() => setCountdownValue(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [status, countdownValue, router]);

    const getCountdownLabel = (val: number) => {
        if (val === 3) return t("player_waiting.ready"); 
        if (val === 2) return t("player_waiting.steady"); 
        if (val === 1) return t("player_waiting.go_race"); 
        return t("player_waiting.go");
    };
    const getCountdownColor = (val: number) => {
        if (val === 3) return "text-red-500"; 
        if (val === 2) return "text-yellow-400"; 
        return "text-[#00ff9d]";
    };

    const handleSelectCharacter = async () => {
        if (participantId && sessionId && pendingCharacterId !== assignedCarId) {
            await supabase.from("participants")
                .update({ car_character: pendingCharacterId })
                .eq("id", participantId);
        }
        setAssignedCarId(pendingCharacterId);
        setIsSelectingCharacter(false);
    };

    const assignedChar = PLAYER_CHARACTERS.find(c => c.id === assignedCarId) || PLAYER_CHARACTERS[0];
    const displayVisual = assignedChar.gifSrc || assignedChar.imageSrc;

    useEffect(() => {
        setIsLoadingVisual(true);
    }, [displayVisual]);

    return (
        <div className="bg-[#0b101a] text-white min-h-screen relative overflow-hidden font-body flex flex-col items-center justify-center p-4">
            <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#0b101a] via-transparent to-[#2d6af2]/10 pointer-events-none" />
            <div className="fixed bottom-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#2d6af2]/10 via-[#0a101f]/50 to-[#0a101f] pointer-events-none z-0" />
            <div className="fixed bottom-0 w-full h-1/2 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px)] bg-[length:60px_60px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom z-0 pointer-events-none opacity-20" />

            <div className="relative z-20 w-full max-w-sm text-center">

                {/* LOADING */}
                {status === "loading" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                        <Loader2 className="w-16 h-16 text-[#00ff9d] animate-spin mb-6" />
                        <h2 className="font-display text-2xl tracking-widest text-[#00ff9d] uppercase glow-text">{t("player_waiting.connecting")}</h2>
                    </motion.div>
                )}

                {/* ERROR */}
                {status === "error" && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl backdrop-blur-md">
                        <Zap className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="font-display text-xl text-red-400 mb-2 uppercase tracking-widest">{t("player_waiting.connection_lost")}</h2>
                        <p className="text-gray-400 text-sm font-mono">{errorMessage}</p>
                        <button onClick={() => router.push('/')} className="mt-6 px-6 py-2 bg-red-500/20 hover:bg-red-500 text-white rounded-xl transition-colors font-display text-xs uppercase tracking-wider">
                            {t("player_waiting.back_home")}
                        </button>
                    </motion.div>
                )}

                {/* ── WAITING ── */}
                {status === "waiting" && (
                    <>
                        {/* ===== MOBILE ===== */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="md:hidden fixed inset-0 z-30 bg-[#0b101a] flex flex-col">
                            <div className="flex items-center justify-center pt-10 pb-4 flex-shrink-0">
                                <img src="/assets/logo/logo1.png" alt="NitroQuiz" className="h-14 object-contain drop-shadow-[0_0_20px_rgba(45,106,242,0.7)]" />
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center px-5">
                                <div className="w-full bg-[#0d1526]/80 border border-[#2d6af2]/50 rounded-3xl p-5 shadow-[0_0_40px_rgba(45,106,242,0.15)]">
                                    <div className="flex justify-center mb-5">
                                        <div className="flex items-center gap-2 bg-[#1a2540] border border-[#2d6af2]/40 px-6 py-2 rounded-full">
                                            <Users className="w-5 h-5 text-[#2d6af2]" />
                                            <span className="font-display text-white text-xl font-bold">{participantCount}</span>
                                        </div>
                                    </div>
                                    <div className="relative mx-auto" style={{ width: '200px' }}>
                                        <div className="absolute -top-3 right-0 z-10 bg-[#00ff9d] text-black text-xs font-display font-black px-3 py-1 rounded-md tracking-widest shadow-[0_0_15px_rgba(0,255,157,0.5)]">{t("player_waiting.you")}</div>
                                        <div className="bg-[#080e1a] border border-[#00ff9d]/40 rounded-2xl p-4 flex flex-col items-center" style={{ minHeight: '220px' }}>
                                            <div className="flex-1 flex items-center justify-center w-full py-6">
                                                <img src={assignedChar.imageSrc} alt="Your Car" className="w-[130px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" />
                                            </div>
                                            <p className="font-display text-white text-sm uppercase tracking-widest font-bold mt-1">{username}</p>
                                        </div>
                                    </div>
                                    <div className="mt-5 w-full h-0.5 bg-[#2d6af2]/20 rounded-full overflow-hidden">
                                        <motion.div className="h-full bg-gradient-to-r from-[#2d6af2] to-[#00ff9d]"
                                            animate={{ x: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} />
                                    </div>
                                    <p className="font-display text-[#00ff9d]/60 text-[10px] uppercase tracking-[0.2em] mt-2 animate-pulse">{t("player_waiting.waiting_host")}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-5 pb-10 pt-4 flex-shrink-0">
                                <button onClick={() => router.push('/')} className="w-14 h-14 flex items-center justify-center rounded-full bg-[#1a0a12] border border-red-500/50 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all flex-shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                    <LogOut className="w-5 h-5" />
                                </button>
                                <button onClick={() => setIsSelectingCharacter(true)} className="flex-1 h-14 flex items-center justify-center rounded-full border border-[#00ff9d]/60 text-[#00ff9d] font-display text-sm uppercase tracking-widest hover:bg-[#00ff9d]/10 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,157,0.1)]">
                                    {t("player_waiting.choose_character")}
                                </button>
                            </div>
                        </motion.div>

                        {/* ===== DESKTOP — Racing Lobby ===== */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="hidden md:block fixed inset-0 z-30"
                            style={{
                                background: 'linear-gradient(180deg, #1a1f2e 0%, #1c2235 40%, #161c2c 100%)',
                            }}>

                            {/* Showroom BG — right side fills the screen */}
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Ceiling light beams */}
                                <div className="absolute top-0 left-[38%] w-[1px] h-[40%] bg-gradient-to-b from-white/20 to-transparent" />
                                <div className="absolute top-0 left-[52%] w-[1px] h-[50%] bg-gradient-to-b from-white/14 to-transparent" />
                                <div className="absolute top-0 left-[66%] w-[1px] h-[40%] bg-gradient-to-b from-white/18 to-transparent" />
                                <div className="absolute top-0 left-[80%] w-[1px] h-[35%] bg-gradient-to-b from-white/12 to-transparent" />
                                {/* Floor gradient */}
                                <div className="absolute bottom-0 inset-x-0 h-[35%] bg-gradient-to-t from-[#10141f] to-transparent" />
                                {/* Car glow on floor */}
                                <div className="absolute bottom-[22%] left-[62%] w-[380px] h-[50px] -translate-x-1/2 bg-[#3060c0]/10 blur-3xl rounded-full" />
                            </div>

                            {/* ── Top bar ── */}
                            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-3"
                                style={{ background: 'rgba(14,18,30,0.75)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex flex-col leading-none">
                                    <img src="/assets/logo/logo1.png" alt="Logo" className="h-10 object-contain" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-display text-[11px] text-gray-300 uppercase tracking-[0.22em]">
                                        {t("player_waiting.waiting_host_desktop")}
                                    </span>
                                    <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
                                </div>
                                <div className="flex flex-col leading-none">
                                    <img src="/assets/logo/logo2.png" alt="NitroQuiz" className="h-10 object-contain" />
                                </div>
                            </div>

                            {/* ── Left panel — floats over the showroom ── */}
                            <div className="absolute top-[60px] left-5 bottom-[64px] z-10 flex flex-col min-h-0 w-[320px] lg:w-[480px] xl:w-[680px]">
                                {/* Outer panel */}
                                <div className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden"
                                    style={{
                                        background: 'rgba(30,38,62,0.72)',
                                        border: '1px solid rgba(80,110,180,0.3)',
                                        backdropFilter: 'blur(16px)',
                                        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                                    }}>

                                    {/* Header row */}
                                    <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
                                        style={{ borderBottom: '1px solid rgba(80,110,180,0.2)' }}>
                                        {/* Grid icon (dots) */}
                                        <div className="grid grid-cols-3 gap-0.5 flex-shrink-0">
                                            {Array.from({ length: 9 }).map((_, i) => (
                                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#4a7cdc]" />
                                            ))}
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="font-display text-white text-sm font-bold tracking-widest">
                                                {t("player_waiting.player", { count: participantCount })}
                                            </span>
                                            <span className="font-display text-blue-300 text-[9px] uppercase tracking-[0.2em] opacity-80">
                                                {t("player_waiting.connected_info")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Scrollable cards */}
                                    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-max"
                                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(45,106,242,0.25) transparent' }}>

                                        {/* YOU card */}
                                        <div className="relative rounded-xl overflow-hidden h-[190px] w-full"
                                            style={{
                                                background: 'linear-gradient(160deg, rgba(28,42,80,0.95), rgba(22,34,68,0.98))',
                                                border: '1.5px solid rgba(60,110,220,0.6)',
                                                boxShadow: 'inset 0 0 24px rgba(40,80,180,0.1)',
                                            }}>
                                            {/* Profile avatar */}
                                            <div className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full border border-white/20 overflow-hidden bg-black/40">
                                                {userAvatar ? (
                                                    <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <InitialsAvatar name={username} size="sm" />
                                                )}
                                            </div>
                                            {/* YOU badge */}
                                            <div className="absolute top-2 right-2 z-10 font-display font-black text-[10px] tracking-widest px-2 py-0.5 rounded"
                                                style={{ background: '#00d4ff', color: '#000' }}>
                                                {t("player_waiting.you")}
                                            </div>
                                            {/* Car image */}
                                            <div className="flex items-center justify-center px-6 py-5"
                                                style={{ minHeight: '150px' }}>
                                                <img src={assignedChar.imageSrc} alt="car"
                                                    className="w-full max-h-[110px] object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.8)]" />
                                            </div>
                                            {/* Name */}
                                            <div className="text-center pb-3 px-3">
                                                <p className="font-display text-white text-xs font-bold uppercase tracking-[0.18em] truncate">{username}</p>
                                                <p className="font-display text-[#00ff9d] text-[9px] uppercase tracking-widest mt-1 opacity-80">{assignedChar.name}</p>
                                            </div>
                                        </div>

                                        {/* Other players */}
                                        {allParticipants.filter(p => p.nickname !== username).map((p, i) => {
                                            const charObj = PLAYER_CHARACTERS.find(c => c.id === p.car_character) || PLAYER_CHARACTERS[0];
                                            const pCarName = charObj.name;
                                            const carSrc = charObj.imageSrc;
                                            return (
                                                <div key={i} className="relative rounded-xl overflow-hidden h-[190px] w-full"
                                                    style={{
                                                        background: 'linear-gradient(160deg, rgba(24,34,62,0.92), rgba(18,26,50,0.95))',
                                                        border: '1px solid rgba(50,80,160,0.45)',
                                                    }}>
                                                    {/* Profile avatar */}
                                                    <div className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full border border-white/20 overflow-hidden bg-black/40">
                                                        {p.avatar_url ? (
                                                            <img src={p.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <InitialsAvatar name={p.nickname} size="sm" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-center px-6 py-5" style={{ minHeight: '150px' }}>
                                                        <img src={carSrc} alt="car" className="w-full max-h-[110px] object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.8)]" />
                                                    </div>
                                                    <div className="text-center pb-3 px-3">
                                                        <p className="font-display text-white text-xs font-bold uppercase tracking-[0.18em] truncate">{p.nickname}</p>
                                                        <p className="font-display text-[#00d4ff] text-[9px] uppercase tracking-widest mt-1 opacity-80">{pCarName}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Empty slot */}
                                        <div className="relative rounded-xl overflow-hidden h-[190px] w-full"
                                            style={{
                                                background: 'rgba(18,26,50,0.5)',
                                                border: '1px dashed rgba(50,80,160,0.3)',
                                            }}>
                                            <div className="flex items-center justify-center px-6 py-5" style={{ minHeight: '150px' }}>
                                                {/* Ghost car SVG */}
                                                <svg viewBox="0 0 180 80" className="w-[160px] h-[70px] opacity-15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <rect x="8" y="28" width="164" height="34" rx="12" stroke="#7090cc" strokeWidth="2"/>
                                                    <rect x="42" y="12" width="96" height="28" rx="9" stroke="#7090cc" strokeWidth="2"/>
                                                    <circle cx="42" cy="66" r="11" stroke="#7090cc" strokeWidth="2"/>
                                                    <circle cx="138" cy="66" r="11" stroke="#7090cc" strokeWidth="2"/>
                                                    <line x1="8" y1="42" x2="172" y2="42" stroke="#7090cc" strokeWidth="1" strokeDasharray="6 4"/>
                                                </svg>
                                            </div>
                                            <div className="text-center pb-3 px-3">
                                                <p className="text-[10px] uppercase tracking-widest font-mono" style={{ color: 'rgba(120,140,180,0.45)' }}>
                                                    {t("player_waiting.waiting_player")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Right Panel Area ── */}
                            {isSelectingCharacter ? (
                                <div className="absolute z-10 flex flex-col items-center justify-center right-0 md:left-[340px] lg:left-[500px] xl:left-[700px]" style={{ top: '60px', bottom: '64px', right: '20px' }}>
                                    <h2 className="font-display text-2xl font-black text-white uppercase tracking-wider mb-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                                        {t("player_waiting.choose_racer")}
                                    </h2>
                                    <div className="flex items-center gap-6 w-full justify-center px-4 overflow-hidden relative">
                                        {/* Left Arrow */}
                                        <button className="z-20 w-10 h-10 flex items-center justify-center bg-[#151f38] rounded-xl hover:bg-[#1c294a] transition-colors shadow-lg flex-shrink-0">
                                            <ChevronLeft className="w-5 h-5 text-white" />
                                        </button>
                                        
                                        {/* Cards Container */}
                                        <div className="flex justify-center gap-5 items-center overflow-x-auto no-scrollbar py-6 px-4">
                                            {PLAYER_CHARACTERS.map((c) => {
                                                const isSel = pendingCharacterId === c.id;
                                                return (
                                                    <div key={c.id} onClick={() => setPendingCharacterId(c.id)} 
                                                        className={`relative flex flex-col items-center pt-10 pb-5 px-5 rounded-[16px] transition-all cursor-pointer ${isSel ? 'bg-[#182136] border-2 border-[#e6fdff]' : 'bg-[#111726] border border-[#2d4060]'}`} 
                                                        style={{ 
                                                            width: '280px', 
                                                            height: '380px',
                                                            boxShadow: isSel ? '0 0 25px rgba(120,240,255,0.4), inset 0 0 20px rgba(120,240,255,0.15)' : 'none'
                                                        }}>
                                                        
                                                        {/* Car Image */}
                                                        <img src={c.imageSrc} alt={c.name} 
                                                            className="w-full aspect-[4/3] object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] mb-8" />
                                                        
                                                        {/* Name */}
                                                        <h3 className="font-display text-[15px] font-bold text-white uppercase tracking-[0.1em] text-center mb-auto">
                                                            {c.name}
                                                        </h3>
                                                        

                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Right Arrow */}
                                        <button className="z-20 w-10 h-10 flex items-center justify-center bg-[#151f38] rounded-xl hover:bg-[#1c294a] transition-colors shadow-lg flex-shrink-0">
                                            <ChevronRight className="w-5 h-5 text-white" />
                                        </button>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-6 mt-8">
                                        <button onClick={() => { setIsSelectingCharacter(false); setPendingCharacterId(assignedCarId); }} 
                                            className="w-[160px] py-3.5 rounded-full font-display text-[14px] font-bold uppercase tracking-widest text-white bg-[#22b7ca] hover:bg-[#1fa1b2] transition-colors shadow-[0_4px_15px_rgba(34,183,202,0.4)]">
                                            {t("player_waiting.back")}
                                        </button>
                                        <button onClick={handleSelectCharacter} 
                                            className="w-[160px] py-3.5 rounded-full font-display text-[14px] font-bold uppercase tracking-widest text-white bg-[#22b7ca] hover:bg-[#1fa1b2] transition-colors shadow-[0_4px_15px_rgba(34,183,202,0.4)]">
                                            {t("player_waiting.select")}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="absolute z-10 text-left md:left-[360px] lg:left-[520px] xl:left-[720px]"
                                        style={{ top: '80px' }}>
                                        <h2 className="font-display text-2xl font-black text-white uppercase tracking-wider leading-none">
                                            {assignedChar.name}
                                        </h2>
                                        <p className="text-[#8899bb] text-xs font-mono mt-1 tracking-widest">{assignedChar.name}</p>
                                    </div>

                                    <div className="absolute z-10 flex flex-col gap-6 items-center justify-center right-0 md:left-[340px] lg:left-[500px] xl:left-[700px]"
                                        style={{ top: '60px', bottom: '64px' }}>
                                        <motion.div className="relative flex items-center justify-center"
                                            style={{ width: 'clamp(300px, 45vw, 560px)', height: '52vh' }}
                                            animate={{ y: [0, -14, 0] }}
                                            transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}>
                                            {isLoadingVisual && <Loader2 className="absolute z-0 w-12 h-12 text-[#00ff9d] animate-spin drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]" />}
                                            {(assignedChar as any).sequenceFolder ? (
                                                <SequencePlayer folder={(assignedChar as any).sequenceFolder} count={(assignedChar as any).sequenceCount} isLoading={isLoadingVisual} onLoad={() => setIsLoadingVisual(false)} />
                                            ) : (
                                                <img src={displayVisual} alt="Your Car"
                                                    className={`object-contain drop-shadow-[0_28px_60px_rgba(40,70,200,0.22)] transition-opacity duration-300 relative z-10 ${isLoadingVisual ? 'opacity-0' : 'opacity-100'}`}
                                                    style={{ width: '100%', maxHeight: '100%' }} 
                                                    onLoad={() => setIsLoadingVisual(false)}
                                                />
                                            )}
                                            {/* Ground shadow */}
                                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-3/4 h-3 bg-black/40 blur-xl rounded-full" />
                                        </motion.div>

                                        <button onClick={() => { setPendingCharacterId(assignedCarId); setIsSelectingCharacter(true); }}
                                            className="flex items-center gap-2 px-10 py-3 rounded-full font-display text-[13px] font-bold uppercase tracking-[0.2em] text-white active:scale-95 transition-all outline-none"
                                            style={{
                                                background: 'linear-gradient(135deg, #0fa8c4, #0880b8)',
                                                boxShadow: '0 0 22px rgba(15,168,196,0.4)',
                                                border: '1px solid rgba(0,255,255,0.2)',
                                            }}>
                                            {t("player_waiting.choose_character")}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ── Bottom bar ── */}
                            <div className="absolute bottom-0 inset-x-0 z-20 flex items-center px-6 py-3"
                                style={{ background: 'rgba(14,18,30,0.8)', backdropFilter: 'blur(14px)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                {/* Back — rounded square icon, bottom-left */}
                                <button onClick={() => router.push('/')}
                                    className="w-11 h-11 flex items-center justify-center rounded-xl active:scale-95 transition-all flex-shrink-0"
                                    style={{
                                        background: 'rgba(180,30,50,0.15)',
                                        border: '1px solid rgba(200,40,60,0.35)',
                                        color: '#f87171',
                                    }}>
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}

                {/* COUNTDOWN */}
                {status === "countdown" && (
                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
                        style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        {/* 3 traffic light dots */}
                        <div className="flex gap-4 mb-8">
                            {[
                                { color: "#ef4444", activeAt: 3 },
                                { color: "#facc15", activeAt: 2 },
                                { color: "#00ff9d", activeAt: 1 },
                            ].map((light, i) => {
                                const isGo = countdownValue <= 0;
                                const isLit = isGo || countdownValue <= light.activeAt;
                                const displayColor = isGo ? "#00ff9d" : light.color;
                                return (
                                    <div key={i} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2" style={{
                                        borderColor: isLit ? displayColor : '#374151',
                                        backgroundColor: isLit ? displayColor : 'rgba(55,65,81,0.3)',
                                        boxShadow: isLit ? `0 0 25px ${displayColor}` : 'none',
                                        transform: isLit ? 'scale(1.15)' : 'scale(1)',
                                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }} />
                                );
                            })}
                        </div>
                        <span key={countdownValue}
                            className={`font-display text-[120px] md:text-[160px] font-black leading-none tracking-tighter ${getCountdownColor(countdownValue)} drop-shadow-[0_0_40px_currentColor]`}
                            style={{ animation: 'countdown-pop 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)', willChange: 'transform, opacity', display: 'block' }}>
                            {countdownValue > 0 ? countdownValue : t("player_waiting.go")}
                        </span>
                        <p className="font-display text-lg tracking-[0.3em] uppercase text-gray-400 mt-6" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                            {getCountdownLabel(countdownValue)}
                        </p>
                        <div className="absolute w-64 h-64 rounded-full border border-[#2d6af2]/20" style={{ animation: 'pulseRing 2s ease-in-out infinite' }} />
                        <style>{`
                            @keyframes fadeIn{from{opacity:0}to{opacity:1}}
                            @keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
                            @keyframes countdown-pop{0%{transform:scale(1.5) translateY(-30px);opacity:0}60%{transform:scale(0.95) translateY(5px);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
                            @keyframes pulseRing{0%{transform:scale(1);opacity:0.3}50%{transform:scale(1.5);opacity:0}100%{transform:scale(1);opacity:0.3}}
                        `}</style>
                    </div>
                )}

                {/* GO! */}
                {status === "go" && (
                    <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                        <motion.h1 animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}
                            className="font-display text-[100px] md:text-[140px] text-transparent bg-clip-text bg-gradient-to-b from-[#00ff9d] to-[#2d6af2] uppercase tracking-tighter leading-none font-black drop-shadow-[0_0_50px_rgba(0,255,157,0.6)]">
                            {t("player_waiting.go")}
                        </motion.h1>
                        <p className="font-display text-[#00ff9d] text-sm uppercase tracking-[0.3em] mt-4 animate-pulse">{t("player_waiting.launching")}</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}