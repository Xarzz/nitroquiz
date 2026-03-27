'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getUser } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Loader2, Zap, Users, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const carGifs = [
    "/assets/characters/scloski/showroom/showroom1.png",
    "/assets/characters/scloski/showroom/showroom2.png",
    "/assets/characters/scloski/showroom/showroom1.png",
    "/assets/characters/scloski/showroom/showroom2.png",
    "/assets/characters/scloski/showroom/showroom1.png",
];
const carNames = ["SCHLOSKI RACER", "SCHLOSKI ELITE", "SCHLOSKI RACER", "SCHLOSKI ELITE", "SCHLOSKI RACER"];
const carMap = ["purple", "white", "black", "aqua", "blue"];

export default function PlayerWaitingPage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.roomCode as string;

    const [status, setStatus] = useState<"loading" | "waiting" | "countdown" | "go" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [assignedCar, setAssignedCar] = useState<string>("/assets/characters/scloski/showroom/showroom1.png");
    const [assignedCarIndex, setAssignedCarIndex] = useState<number>(0);
    const [countdownValue, setCountdownValue] = useState(5);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [participantCount, setParticipantCount] = useState(1);
    const [username, setUsername] = useState("");
    const [allParticipants, setAllParticipants] = useState<{ nickname: string; car_character: string }[]>([]);

    useEffect(() => {
        const user = getUser();
        if (!user) { router.push(`/player/${roomCode}/login`); return; }
        setUsername(user.username || "");
        let cleanup: (() => void) | undefined;

        const joinRoom = async () => {
            try {
                const { data: sessionData, error: sessionError } = await supabase
                    .from("sessions").select("id, status").eq("game_pin", roomCode).single();
                if (sessionError || !sessionData) { setStatus("error"); setErrorMessage("Room not found or invalid."); return; }
                if (sessionData.status === "active") { setStatus("countdown"); return; }

                const randIndex = Math.floor(Math.random() * carMap.length);
                const carChoice = carMap[randIndex];
                setAssignedCar(carGifs[randIndex]);
                setAssignedCarIndex(randIndex);

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
                }

                const { data: pList, count } = await supabase.from("participants")
                    .select("nickname, car_character", { count: "exact" }).eq("session_id", sessionData.id);
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
                                .select("nickname, car_character", { count: "exact" }).eq("session_id", sessionData.id);
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
            }
            
            const difficulty = data?.difficulty || 'easy';
            let route = `/gamespeed/${roomCode}`;
            if (difficulty === 'normal' || difficulty === 'medium') {
                route = `/gamespeed-medium/${roomCode}`;
            } else if (difficulty === 'coba') {
                route = `/gamespeed-coba/${roomCode}`;
            }
            
            const link = document.createElement('link'); link.rel = 'prefetch'; link.href = route; document.head.appendChild(link);
        } catch (err) { console.error('Failed to preload quiz:', err); }
    };

    useEffect(() => {
        if (status !== "countdown") return;
        if (countdownValue <= 0) { 
            setStatus("go"); 
            setTimeout(() => {
                const diff = localStorage.getItem('nitroquiz_game_difficulty') || 'easy';
                let route = `/gamespeed/${roomCode}`;
                if (diff === 'normal' || diff === 'medium') {
                    route = `/gamespeed-medium/${roomCode}`;
                } else if (diff === 'coba') {
                    route = `/gamespeed-coba/${roomCode}`;
                }
                router.push(route);
            }, 1500); 
            return; 
        }
        const timer = setTimeout(() => setCountdownValue(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [status, countdownValue, router]);

    const getCountdownLabel = (val: number) => {
        if (val >= 4) return "GET READY"; 
        if (val === 3) return "READY"; 
        if (val === 2) return "STEADY"; 
        if (val === 1) return "GO RACE"; 
        return "GO!";
    };
    const getCountdownColor = (val: number) => {
        if (val >= 4) return "text-blue-500"; 
        if (val === 3) return "text-red-500"; 
        if (val === 2) return "text-yellow-400"; 
        return "text-[#00ff9d]";
    };

    const carImageMap: Record<string, string> = {
        purple: "/assets/characters/scloski/showroom/showroom1.png", 
        white: "/assets/characters/scloski/showroom/showroom2.png",
        black: "/assets/characters/scloski/showroom/showroom1.png", 
        aqua: "/assets/characters/scloski/showroom/showroom2.png", 
        blue: "/assets/characters/scloski/showroom/showroom1.png",
    };

    const changeCar = () => {
        const randIndex = Math.floor(Math.random() * carMap.length);
        setAssignedCar(carGifs[randIndex]);
        setAssignedCarIndex(randIndex);
    };

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
                        <h2 className="font-display text-2xl tracking-widest text-[#00ff9d] uppercase glow-text">CONNECTING...</h2>
                    </motion.div>
                )}

                {/* ERROR */}
                {status === "error" && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl backdrop-blur-md">
                        <Zap className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="font-display text-xl text-red-400 mb-2 uppercase tracking-widest">CONNECTION LOST</h2>
                        <p className="text-gray-400 text-sm font-mono">{errorMessage}</p>
                        <button onClick={() => router.push('/')} className="mt-6 px-6 py-2 bg-red-500/20 hover:bg-red-500 text-white rounded-xl transition-colors font-display text-xs uppercase tracking-wider">
                            Back to Home
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
                                        <div className="absolute -top-3 right-0 z-10 bg-[#00ff9d] text-black text-xs font-display font-black px-3 py-1 rounded-md tracking-widest shadow-[0_0_15px_rgba(0,255,157,0.5)]">YOU</div>
                                        <div className="bg-[#080e1a] border border-[#00ff9d]/40 rounded-2xl p-4 flex flex-col items-center" style={{ minHeight: '220px' }}>
                                            <div className="flex-1 flex items-center justify-center w-full py-6">
                                                <img src={assignedCar} alt="Your Car" className="w-[130px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" />
                                            </div>
                                            <p className="font-display text-white text-sm uppercase tracking-widest font-bold mt-1">{username}</p>
                                        </div>
                                    </div>
                                    <div className="mt-5 w-full h-0.5 bg-[#2d6af2]/20 rounded-full overflow-hidden">
                                        <motion.div className="h-full bg-gradient-to-r from-[#2d6af2] to-[#00ff9d]"
                                            animate={{ x: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} />
                                    </div>
                                    <p className="font-display text-[#00ff9d]/60 text-[10px] uppercase tracking-[0.2em] mt-2 animate-pulse">Waiting for host to start...</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-5 pb-10 pt-4 flex-shrink-0">
                                <button onClick={() => router.push('/')} className="w-14 h-14 flex items-center justify-center rounded-full bg-[#1a0a12] border border-red-500/50 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all flex-shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                    <LogOut className="w-5 h-5" />
                                </button>
                                <button onClick={changeCar} className="flex-1 h-14 flex items-center justify-center rounded-full border border-[#00ff9d]/60 text-[#00ff9d] font-display text-sm uppercase tracking-widest hover:bg-[#00ff9d]/10 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,157,0.1)]">
                                    CHANGE CAR
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
                                    <img src="/assets/logo/logo1.png" alt="Logo" className="h-7 object-contain" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-display text-[11px] text-gray-300 uppercase tracking-[0.22em]">
                                        WAITING FOR HOST TO START THE RACE...
                                    </span>
                                    <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
                                </div>
                                <div className="font-display text-[11px] text-gray-400 uppercase tracking-widest">
                                    {roomCode}
                                </div>
                            </div>

                            {/* ── Left panel — floats over the showroom ── */}
                            <div className="absolute top-[60px] left-5 bottom-[64px] z-10 flex flex-col w-[320px] lg:w-[480px] xl:w-[680px]">
                                {/* Outer panel */}
                                <div className="flex-1 flex flex-col rounded-2xl overflow-hidden"
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
                                        <div className="flex flex-col">
                                            <span className="font-display text-white text-sm font-bold tracking-widest">
                                                PLAYER ROSTER ({participantCount})
                                            </span>
                                            <span className="font-display text-blue-300 text-[9px] uppercase tracking-[0.2em] opacity-80">
                                                Connected Participants & Vehicles
                                            </span>
                                        </div>
                                    </div>

                                    {/* Scrollable cards */}
                                    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 content-start"
                                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(45,106,242,0.25) transparent' }}>

                                        {/* YOU card */}
                                        <div className="relative rounded-xl overflow-hidden flex-shrink-0"
                                            style={{
                                                background: 'linear-gradient(160deg, rgba(28,42,80,0.95), rgba(22,34,68,0.98))',
                                                border: '1.5px solid rgba(60,110,220,0.6)',
                                                boxShadow: 'inset 0 0 24px rgba(40,80,180,0.1)',
                                            }}>
                                            {/* YOU badge */}
                                            <div className="absolute top-2 right-2 z-10 font-display font-black text-[10px] tracking-widest px-2 py-0.5 rounded"
                                                style={{ background: '#00d4ff', color: '#000' }}>
                                                YOU
                                            </div>
                                            {/* Car image */}
                                            <div className="flex items-center justify-center px-6 py-5"
                                                style={{ minHeight: '150px' }}>
                                                <img src={assignedCar} alt="car"
                                                    className="w-full max-h-[110px] object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.8)]" />
                                            </div>
                                            {/* Name */}
                                            <div className="text-center pb-3 px-3">
                                                <p className="font-display text-white text-xs font-bold uppercase tracking-[0.18em] truncate">{username}</p>
                                                <p className="font-display text-[#00ff9d] text-[9px] uppercase tracking-widest mt-1 opacity-80">{carNames[assignedCarIndex]}</p>
                                            </div>
                                        </div>

                                        {/* Other players */}
                                        {allParticipants.filter(p => p.nickname !== username).map((p, i) => {
                                            const key = p.car_character?.replace('-bot', '') || 'purple';
                                            const carSrc = carImageMap[key] || carGifs[0];
                                            const carIdx = carMap.indexOf(key);
                                            const pCarName = carIdx >= 0 ? carNames[carIdx] : "RACER";
                                            return (
                                                <div key={i} className="relative rounded-xl overflow-hidden flex-shrink-0"
                                                    style={{
                                                        background: 'linear-gradient(160deg, rgba(24,34,62,0.92), rgba(18,26,50,0.95))',
                                                        border: '1px solid rgba(50,80,160,0.45)',
                                                    }}>
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
                                        <div className="relative rounded-xl overflow-hidden flex-shrink-0"
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
                                                    WAITING FOR PLAYER...
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Car name (right side) ── */}
                            <div className="absolute z-10 text-left md:left-[360px] lg:left-[520px] xl:left-[720px]"
                                style={{ top: '80px' }}>
                                <h2 className="font-display text-2xl font-black text-white uppercase tracking-wider leading-none">
                                    {carNames[assignedCarIndex]}
                                </h2>
                                <p className="text-[#8899bb] text-xs font-mono mt-1 tracking-widest">{carNames[assignedCarIndex]}</p>
                            </div>

                            {/* ── Big car showcase (right, vertical center) ── */}
                            <div className="absolute z-10 flex items-center justify-center right-0 md:left-[340px] lg:left-[500px] xl:left-[700px]"
                                style={{ top: '60px', bottom: '64px' }}>
                                <motion.div className="relative"
                                    animate={{ y: [0, -14, 0] }}
                                    transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}>
                                    <img src={assignedCar} alt="Your Car"
                                        className="object-contain drop-shadow-[0_28px_60px_rgba(40,70,200,0.22)]"
                                        style={{ width: 'clamp(300px, 45vw, 560px)', maxHeight: '58vh' }} />
                                    {/* Ground shadow */}
                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-3/4 h-3 bg-black/40 blur-xl rounded-full" />
                                </motion.div>
                            </div>

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

                                {/* CHANGE CAR — absolute center */}
                                <div className="absolute left-1/2 -translate-x-1/2">
                                    <button onClick={changeCar}
                                        className="flex items-center gap-2 px-10 py-2.5 rounded-full font-display text-sm font-bold uppercase tracking-widest text-white active:scale-95 transition-all"
                                        style={{
                                            background: 'linear-gradient(135deg, #0fa8c4, #0880b8)',
                                            boxShadow: '0 0 22px rgba(15,168,196,0.35)',
                                        }}>
                                        CHANGE CAR
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}

                {/* COUNTDOWN */}
                {status === "countdown" && (
                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
                        style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        <div className="flex gap-4 mb-10">
                            {[0, 1, 2, 3, 4].map((i) => {
                                const val = 5 - i; // Map 5s to 5 dots
                                const isLit = countdownValue <= val; 
                                const isGo = countdownValue <= 0;
                                let color = "#3b82f6"; // Blue for 5, 4
                                if (val === 3) color = "#ef4444";
                                if (val === 2) color = "#facc15";
                                if (val === 1 || isGo) color = "#00ff9d";

                                return <div key={i} className="w-8 h-8 rounded-full border-2" style={{
                                    borderColor: isGo ? '#00ff9d' : isLit ? color : '#4b5563',
                                    backgroundColor: isGo ? '#00ff9d' : isLit ? color : '#1f2937',
                                    boxShadow: isGo ? '0 0 25px rgba(0,255,157,0.8)' : isLit ? `0 0 20px ${color}` : 'none',
                                    transform: isLit ? 'scale(1.2)' : 'scale(1)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                }} />;
                            })}
                        </div>
                        <span key={countdownValue}
                            className={`font-display text-[120px] md:text-[160px] font-black leading-none tracking-tighter ${getCountdownColor(countdownValue)} drop-shadow-[0_0_40px_currentColor]`}
                            style={{ animation: 'countdown-pop 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)', willChange: 'transform, opacity', display: 'block' }}>
                            {countdownValue > 0 ? countdownValue : "GO!"}
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
                            GO!
                        </motion.h1>
                        <p className="font-display text-[#00ff9d] text-sm uppercase tracking-[0.3em] mt-4 animate-pulse">LAUNCHING RACE...</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}