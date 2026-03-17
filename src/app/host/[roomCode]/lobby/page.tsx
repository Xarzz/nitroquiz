"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Copy,
    Users,
    Play,
    ArrowLeft,
    VolumeX,
    Volume2,
    Maximize2,
    Check,
    X,
    Plus,
    LogOut,
    Share2,
    CheckSquare,
    Square,
    Trash2
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogOverlay, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/ui/logo";

// Mock Translation (same as before)
const t = (key: string, params?: any) => {
    const translations: Record<string, string> = {
        "hostroom.title": "LOBBY",
        "hostroom.start": "START",
        "hostroom.playerCount": `PLAYERS: ${params?.count || 0}`,
        "hostroom.waiting": "WAITING FOR PLAYERS...",
        "hostroom.kickconfirmation": `KICK ${params?.name}?`,
        "hostroom.cancel": "CANCEL",
        "hostroom.kick": "KICK",
        "hostroom.loadingMore": "LOADING DATA..."
    };
    return translations[key] || key;
};

// Utils inline
const breakOnCaps = (str: string) => str;
const formatUrlBreakable = (url: string) => url.replace(/https?:\/\//, "");

// Car mappings (Keep for now, maybe replace with avatars later if requested, but for now just style the container)
const carGifMap: Record<string, string> = {
    purple: "/assets/car/car1_v2.webp",
    white: "/assets/car/car2_v2.webp",
    black: "/assets/car/car3_v2.webp",
    aqua: "/assets/car/car4_v2.webp",
    blue: "/assets/car/car5_v2.webp",
};

interface Participant {
    id: string;
    nickname: string;
    car: string;
    joined_at: string;
    avatar_url?: string | null;
}

const logoImageMap: Record<string, string> = {
    purple: "/assets/characters/scloski/logo/logo1.png",
    white: "/assets/characters/scloski/logo/logo1.png",
    black: "/assets/characters/scloski/logo/logo1.png",
    aqua: "/assets/characters/scloski/logo/logo1.png",
    blue: "/assets/characters/scloski/logo/logo1.png",
};

export default function HostRoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomCode = params.roomCode as string;

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isLoadingRoom, setIsLoadingRoom] = useState(true);
    const [logosLoaded, setLogosLoaded] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);

    // Preload logos
    useEffect(() => {
        const logos = ['/assets/logo/logo1.png', '/assets/logo/logo2.png'];
        let loaded = 0;
        logos.forEach(src => {
            const img = new Image();
            img.onload = img.onerror = () => {
                loaded++;
                if (loaded >= logos.length) setLogosLoaded(true);
            };
            img.src = src;
        });
    }, []);

    const audioRef = useRef<HTMLAudioElement>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [hasInteracted, setHasInteracted] = useState(false);

    const [open, setOpen] = useState(false);
    const [joinLink, setJoinLink] = useState("https://nitroquiz.com");
    const [copiedRoom, setCopiedRoom] = useState(false);
    const [copiedJoin, setCopiedJoin] = useState(false);

    const [kickDialogOpen, setKickDialogOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<Participant | null>(null);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [isBulkKickMode, setIsBulkKickMode] = useState(false);

    useEffect(() => {
        const savedMuted = localStorage.getItem("settings_muted");
        if (savedMuted !== null) {
            setIsMuted(savedMuted === "true");
        }

        if (typeof window !== "undefined") {
            setJoinLink(`${window.location.origin}/?room=${roomCode}`);
        }

        // Fetch session ID and load initial participants
        const loadSessionAndParticipants = async () => {
            try {
                // Get Session ID from roomCode (game_pin)
                const { data: sessionData, error: sessionError } = await supabase
                    .from("sessions")
                    .select("id")
                    .eq("game_pin", roomCode)
                    .single();

                if (sessionError) {
                    console.error("Error fetching session:", sessionError);

                    // Fallback using LocalStorage if not completely synced
                    const localData = localStorage.getItem(`session_${roomCode}`);
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            if (parsed.sessionId) {
                                setSessionId(parsed.sessionId);
                            }
                        } catch (e) { }
                    }
                    return;
                }

                if (sessionData) {
                    setSessionId(sessionData.id);

                    // Fetch existing participants
                    const { data: participantsData, error: pError } = await supabase
                        .from("participants")
                        .select("id, nickname, car_character, joined_at, avatar_url")
                        .eq("session_id", sessionData.id);

                    if (!pError && participantsData) {
                        const mappedPlayers: Participant[] = participantsData.map(p => ({
                            id: p.id,
                            nickname: p.nickname,
                            car: p.car_character || "purple",
                            joined_at: p.joined_at,
                            avatar_url: p.avatar_url
                        }));
                        setParticipants(mappedPlayers);
                    }
                }
            } catch (err) {
                console.error("Failed to initialize lobby realtime:", err);
            } finally {
                setIsLoadingRoom(false);
            }
        };

        loadSessionAndParticipants();
    }, [roomCode]);

    // Real-time subscription for new players + polling fallback
    useEffect(() => {
        if (!sessionId) return;

        // Polling fallback: refresh participants every 3 seconds
        const pollParticipants = async () => {
            try {
                const { data, error } = await supabase
                    .from("participants")
                    .select("id, nickname, car_character, joined_at, avatar_url")
                    .eq("session_id", sessionId);

                if (!error && data) {
                    setParticipants(data.map(p => ({
                        id: p.id,
                        nickname: p.nickname,
                        car: p.car_character || "purple",
                        joined_at: p.joined_at,
                        avatar_url: p.avatar_url
                    })));
                }
            } catch (e) {
                console.error("Poll error:", e);
            }
        };

        const pollInterval = setInterval(pollParticipants, 3000);

        // Also set up realtime as primary (faster when it works)
        const channel = supabase
            .channel(`lobby-participants-${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
                (payload) => {
                    const newP = payload.new;
                    setParticipants(prev => {
                        // Avoid duplicates from polling
                        if (prev.some(p => p.id === newP.id)) return prev;
                        return [...prev, {
                            id: newP.id,
                            nickname: newP.nickname,
                            car: newP.car_character || "purple",
                            joined_at: newP.joined_at,
                            avatar_url: newP.avatar_url
                        }];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
                (payload) => {
                    const deletedId = payload.old.id;
                    setParticipants(prev => prev.filter(p => p.id !== deletedId));
                }
            )
            .subscribe((status) => {
                console.log(`[Host Lobby] Realtime status: ${status}`);
            });

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

    // Audio control
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = 0.5;

        const playAudio = async () => {
            try {
                await audio.play();
                setHasInteracted(true);
            } catch (err) {
                console.warn("Audio play blocked:", err);
            }
        };

        if (isMuted) {
            audio.pause();
        } else {
            playAudio();
        }
    }, [isMuted]);

    const copyToClipboard = async (
        text: string,
        setFeedback: (val: boolean) => void
    ) => {
        try {
            await navigator.clipboard.writeText(text);
            setFeedback(true);
            setTimeout(() => setFeedback(false), 2000);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const startGame = async () => {
        // 1. Update session status to "active" so players start their countdown
        if (sessionId) {
            try {
                await supabase
                    .from("sessions")
                    .update({ status: "active", started_at: new Date().toISOString() })
                    .eq("id", sessionId);
            } catch (err) {
                console.error("Failed to update session status:", err);
            }
        }
        // 2. Start host-side countdown
        setCountdown(10);
    };

    useEffect(() => {
        if (countdown !== null && countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown((prev) => (prev !== null ? prev - 1 : null));
            }, 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            router.push(`/host/${roomCode}/game`);
        }
    }, [countdown, router, roomCode]);

    const confirmKick = async () => {
        try {
            if (isBulkKickMode && selectedPlayerIds.length > 0) {
                await supabase
                    .from("participants")
                    .delete()
                    .in("id", selectedPlayerIds);
                setParticipants(prev => prev.filter(p => !selectedPlayerIds.includes(p.id)));
                setSelectedPlayerIds([]);
            } else if (selectedPlayer) {
                await supabase
                    .from("participants")
                    .delete()
                    .eq("id", selectedPlayer.id);
                setParticipants(prev => prev.filter(p => p.id !== selectedPlayer.id));
            }
        } catch (e) {
            console.error("Could not kick player(s)", e);
        }

        setKickDialogOpen(false);
        setSelectedPlayer(null);
        setIsBulkKickMode(false);
    };

    const toggleSelectPlayer = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedPlayerIds(prev =>
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedPlayerIds.length === participants.length) {
            setSelectedPlayerIds([]);
        } else {
            setSelectedPlayerIds(participants.map(p => p.id));
        }
    };

    const simulateJoin = async () => {
        if (!sessionId) {
            alert("Session not ready yet. Please wait a moment and try again.");
            console.warn("simulateJoin: sessionId is null, cannot insert bots.");
            return;
        }

        const cars = Object.keys(carGifMap);
        const indonesianNames = [
            "Budi", "Siti", "Agus", "Wati", "Asep", "Ani", "Ucok", "Ratna", "Joko", "Putri",
            "Bambang", "Rini", "Rudi", "Dewi", "Tono", "Sri", "Hendra", "Nurul", "Rizky", "Dian",
            "Fajar", "Ayu", "Ilham", "Intan", "Yoga", "Sari", "Gilang", "Lestari", "Galih", "Maya"
        ];

        const botsToInsert = [];
        for (let i = 0; i < 10; i++) {
            const randomCar = cars[Math.floor(Math.random() * cars.length)];
            const randomName = indonesianNames[Math.floor(Math.random() * indonesianNames.length)];
            const nickname = `${randomName}${Math.floor(Math.random() * 999)}`;
            botsToInsert.push({
                session_id: sessionId,
                nickname: nickname,
                car_character: randomCar + "-bot",
                score: 0,
                minigame: false
            });
        }

        const { error } = await supabase
            .from("participants")
            .insert(botsToInsert);

        if (error) {
            console.error("Simulation insert error:", JSON.stringify(error));
            alert(`Failed to add bots: ${error.message || JSON.stringify(error)}`);
        }
    };

    if (isLoadingRoom || !logosLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f] relative overflow-hidden font-display text-white">
                <div className="text-center z-10">
                    <div className="w-16 h-16 border-4 border-[#2d6af2]/30 border-t-[#2d6af2] rounded-full animate-spin mx-auto mb-6"></div>
                    <p className="mt-4 text-[#2d6af2] text-xl tracking-[0.2em] uppercase animate-pulse">Establishing Signal...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-[#0a0a0f] relative overflow-hidden font-body text-white flex flex-col"
            onClick={() => setHasInteracted(true)}
        >
            {/* Background Layers */}
            <div className="fixed inset-0 z-0 city-silhouette pointer-events-none"></div>
            <div className="fixed inset-0 z-0 bg-gradient-to-t from-background-dark via-transparent to-blue-900/10 pointer-events-none"></div>
            <div className="fixed bottom-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-background-dark/50 to-background-dark pointer-events-none z-0"></div>
            <div className="fixed bottom-0 w-full h-1/2 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px)] bg-[length:60px_60px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom z-0 pointer-events-none opacity-20"></div>
            <div className="scanlines"></div>

            {/* Main Content */}
            <div className="relative z-20 flex flex-col h-full w-full mx-auto p-4 md:p-8">

                {/* Header */}
                <div className="w-full flex items-center justify-between mb-6">
                    <img src="/assets/logo/logo1.png" alt="Logo 1" className="h-12 object-contain opacity-70 hover:opacity-100 transition-opacity" />
                    <img src="/assets/logo/logo2.png" alt="Logo 2" className="h-12 object-contain opacity-70 hover:opacity-100 transition-opacity" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative">

                    {/* Left Column: Room Details (4 cols) */}
                    <div className="lg:col-span-4 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 100, damping: 12 }}
                            className="flex flex-col gap-4 bg-black/60 backdrop-blur-md rounded-[2rem] p-8 shadow-[0_0_30px_rgba(45,106,242,0.15)] border border-[#2d6af2]/50 relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#2d6af2]/20 to-transparent rounded-bl-full pointer-events-none"></div>

                            <div className="text-center relative z-10">
                                <div
                                    className="relative group/code cursor-pointer bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-[#2d6af2]/50 transition-all"
                                    onClick={() => copyToClipboard(roomCode, setCopiedRoom)}
                                >
                                    <h1 className="font-display text-5xl sm:text-6xl text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                        {roomCode}
                                    </h1>
                                    <div className="absolute top-2 right-2">
                                        {copiedRoom ? <Check size={14} className="text-[#00ff9d]" /> : <Copy size={14} className="text-gray-500 group-hover/code:text-[#2d6af2]" />}
                                    </div>
                                </div>
                            </div>

                            <div
                                className="flex justify-center bg-white p-4 rounded-2xl w-[220px] sm:w-[260px] md:w-[300px] lg:w-[20vw] xl:w-[22vw] mx-auto shadow-[0_0_20px_rgba(45,106,242,0.3)] relative group/qr cursor-pointer"
                                onClick={() => setOpen(true)}
                            >
                                <QRCode
                                    value={joinLink}
                                    style={{ width: "100%", height: "auto" }}
                                />
                            </div>


                            <div
                                className="relative group/link cursor-pointer bg-[#0a101f] p-4 rounded-xl border border-[#2d6af2]/20 hover:border-[#2d6af2] transition-all"
                                onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
                            >
                                <p className="text-center text-[#2d6af2] text-xs font-display tracking-wider truncate px-6">
                                    {formatUrlBreakable(joinLink)}
                                </p>
                                <div className="absolute top-1/2 -translate-y-1/2 right-3">
                                    {copiedJoin ? <Check size={14} className="text-[#00ff9d]" /> : <Copy size={14} className="text-gray-500 group-hover/link:text-[#2d6af2]" />}
                                </div>
                            </div>

                            <Button
                                onClick={startGame}
                                disabled={participants.length === 0 || countdown !== null}
                                className="w-full bg-gradient-to-r from-[#2d6af2] to-[#00ff9d] hover:from-[#3b7bf5] hover:to-[#33ffb0] text-black font-display text-lg py-6 rounded-xl shadow-[0_0_20px_rgba(45,106,242,0.4)] hover:shadow-[0_0_30px_rgba(45,106,242,0.6)] transition-all uppercase tracking-widest transform active:scale-[0.98] disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:shadow-none border-none relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-[#00ff9d]/20 blur-xl opacity-0 hover:opacity-100 transition-opacity"></div>
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    <Play className="fill-current w-5 h-5" />
                                    {countdown !== null ? "STARTING..." : t("hostroom.start")}
                                </span>
                            </Button>

                            <div className="flex gap-4">
                                <Button
                                    onClick={() => router.push("/host/select-quiz")}
                                    className="flex-1 bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 hover:border-red-500 font-display text-xs uppercase tracking-wider h-12 rounded-xl transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Exit
                                </Button>

                                <Button
                                    onClick={() => setShareOpen(true)}
                                    className="flex-1 bg-[#2d6af2]/10 border border-[#2d6af2]/30 text-[#2d6af2] hover:bg-[#2d6af2]/20 hover:text-white font-display text-xs uppercase tracking-wider h-12 rounded-xl transition-all shadow-[0_0_10px_rgba(45,106,242,0.2)]"
                                >
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Invite
                                </Button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: Players (8 cols) */}
                    <div className="lg:col-span-8 h-full min-h-[500px]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: 30 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 100, damping: 14 }}
                            className="bg-black/60 backdrop-blur-md rounded-[2rem] p-4 h-full shadow-[0_0_30px_rgba(0,255,157,0.1)] border border-[#00ff9d]/30 relative overflow-hidden flex flex-col"
                        >
                            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-[#00ff9d]/10 to-transparent rounded-br-full pointer-events-none"></div>

                            <div className="flex items-center justify-between gap-1 relative z-10 border-b border-[#00ff9d]/10 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-3">
                                        <Users size={24} />
                                    </div>
                                    <h2 className="font-display text-2xl text-white tracking-wide">
                                        Players: {participants.length}
                                    </h2>
                                </div>

                                {/* Add Bot, Select All, Delete & Mute — inside player header */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={simulateJoin}
                                        variant="outline"
                                        size="sm"
                                        className="bg-[#00ff9d]/5 border-[#00ff9d]/30 text-[#00ff9d] hover:bg-[#00ff9d]/10 font-display text-[10px] uppercase tracking-wider rounded-lg h-8 px-3"
                                    >
                                        <Plus className="mr-1 h-3 w-3" /> Bot
                                    </Button>

                                    {selectedPlayerIds.length > 0 && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleSelectAll}
                                                className="text-[10px] font-display tracking-widest uppercase text-gray-400 hover:text-white h-8 px-2"
                                            >
                                                {selectedPlayerIds.length === participants.length ? (
                                                    <><CheckSquare className="mr-1 h-3 w-3 text-[#00ff9d]" /> Deselect</>
                                                ) : (
                                                    <><Square className="mr-1 h-3 w-3" /> All</>
                                                )}
                                            </Button>

                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setIsBulkKickMode(true);
                                                    setSelectedPlayer(null);
                                                    setKickDialogOpen(true);
                                                }}
                                                className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white font-display text-[10px] tracking-widest uppercase border border-red-500/50 h-8 px-3"
                                            >
                                                <Trash2 className="mr-1 h-3 w-3" />
                                                {selectedPlayerIds.length}
                                            </Button>
                                        </>
                                    )}

                                    <button
                                        onClick={() => setIsMuted((p) => !p)}
                                        className={`p-1.5 border rounded-lg transition-all ${isMuted
                                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                                            : "bg-[#2d6af2]/10 border-[#2d6af2]/30 text-[#2d6af2]"
                                            }`}
                                    >
                                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
                                {participants.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-6 opacity-60">
                                        <div className="w-24 h-24 rounded-full bg-[#00ff9d]/5 border border-[#00ff9d]/20 flex items-center justify-center animate-pulse">
                                            <Users size={40} className="text-[#00ff9d]/50" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-display tracking-[0.2em] text-sm uppercase text-[#00ff9d]">{t("hostroom.waiting")}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4 pt-5">
                                        <AnimatePresence >
                                            {participants.map((player) => (
                                                <motion.div
                                                    key={player.id}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    className={`group relative bg-[#0a101f] border ${selectedPlayerIds.includes(player.id) ? 'border-[#00ff9d] bg-[#00ff9d]/5 shadow-[0_0_15px_rgba(0,255,157,0.3)]' : 'border-[#2d6af2]/20 hover:border-[#2d6af2] hover:shadow-[0_0_20px_rgba(45,106,242,0.3)]'} rounded-xl p-4 flex flex-col items-center transition-all hover:-translate-y-1 cursor-pointer overflow-hidden`}
                                                    onClick={(e) => toggleSelectPlayer(player.id, e)}
                                                >
                                                    {/* Selection Checkbox — visible on hover or when selected */}
                                                    <div className={`absolute top-2 left-2 z-20 transition-opacity ${selectedPlayerIds.includes(player.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedPlayerIds.includes(player.id) ? 'bg-[#00ff9d] border-[#00ff9d] text-black' : 'border-[#2d6af2]/50 bg-black/50 text-transparent'}`}>
                                                            <Check className="w-3 h-3" strokeWidth={3} />
                                                        </div>
                                                    </div>

                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#2d6af2]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                                    <div className="relative mb-3 w-full flex justify-center">
                                                        <div className="absolute inset-0 bg-[#2d6af2]/20 blur-xl rounded-full scale-50 group-hover:scale-100 transition-transform duration-500"></div>
                                                        <div className="w-20 h-20 rounded-full border-2 border-[#2d6af2]/40 bg-black/40 overflow-hidden flex items-center justify-center p-0 shadow-[0_0_15px_rgba(45,106,242,0.2)] relative z-10 transition-transform group-hover:scale-110">
                                                            {player.avatar_url ? (
                                                                <img src={player.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <img 
                                                                    src={logoImageMap[player.car.replace("-bot", "")] || "/assets/characters/scloski/logo/logo1.png"} 
                                                                    alt="Logo" 
                                                                    className="w-full h-full object-contain p-0 scale-150 group-hover:scale-[1.65] transition-transform" 
                                                                />
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="w-full text-center relative z-10 max-w-full">
                                                        <div className="bg-[#2d6af2]/10 border border-[#2d6af2]/20 rounded px-2 py-1 mb-1 max-w-full overflow-hidden">
                                                            <p
                                                                className="font-display text-white text-xs tracking-wide truncate w-full"
                                                                title={player.nickname}
                                                            >
                                                                {player.nickname}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="absolute top-2 right-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity z-20">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsBulkKickMode(false);
                                                                setSelectedPlayer(player);
                                                                setKickDialogOpen(true);
                                                            }}
                                                            className="bg-red-500/10 border border-red-500/30 p-1.5 rounded-lg hover:bg-red-500/80 hover:text-white text-red-500 transition-colors cursor-pointer"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Kick Dialog */}
            <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
                <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
                <DialogContent className="bg-[#0a101f] border border-[#2d6af2]/50 text-white p-0 gap-0 overflow-hidden rounded-2xl max-w-sm shadow-[0_0_30px_rgba(45,106,242,0.15)]">
                    <div className="h-1.5 bg-gradient-to-r from-[#2d6af2] to-[#00ff9d] w-full"></div>
                    <DialogHeader className="flex p-6 justify-center text-center">
                        <p className="text-6xl text-center pb-5">🏎️</p>
                        <DialogTitle className="font-display text-xl uppercase tracking-widest text-white text-center drop-shadow-[0_0_10px_rgba(45,106,242,0.5)]">
                            {isBulkKickMode ? (
                                <>
                                    KICK <span className="text-[#00ff9d] font-bold text-xl font-display tracking-wider drop-shadow-[0_0_8px_rgba(0,255,157,0.5)]">{selectedPlayerIds.length} PLAYERS</span>?
                                </>
                            ) : (
                                <>
                                    KICK {" "}
                                    <span className="text-[#00ff9d] font-bold text-xl font-display tracking-wider drop-shadow-[0_0_8px_rgba(0,255,157,0.5)]">
                                        {selectedPlayer?.nickname}
                                    </span>
                                    ?
                                </>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pt-2 text-center">
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setKickDialogOpen(false)}
                                variant="ghost"
                                className="flex-1 bg-transparent border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white font-display text-xs uppercase tracking-wider h-12 rounded-xl transition-all"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmKick}
                                className="flex-1 bg-gradient-to-r from-[#2d6af2] to-[#00ff9d] hover:from-[#3b7bf5] hover:to-[#33ffb0] text-black border-none font-display text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(45,106,242,0.4)] h-12 rounded-xl transition-all"
                            >
                                Kick
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* QR Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogOverlay className="bg-black/90 backdrop-blur-md" />
                <DialogContent className="bg-transparent border-none p-0 flex flex-col items-center justify-center shadow-none max-w-none w-auto [&>button]:top-4 [&>button]:right-4 [&>button]:bg-white/10 [&>button]:hover:bg-white/20 [&>button]:text-white [&>button]:rounded-full [&>button]:w-10 [&>button]:h-10">
                    <VisuallyHidden>
                        <DialogTitle>QR Code Invitation</DialogTitle>
                    </VisuallyHidden>
                    <div className="bg-white p-6 rounded-3xl shadow-[0_0_50px_rgba(45,106,242,0.5)] transform transition-transform duration-300">
                        <QRCode value={joinLink} size={550} />
                    </div>
                </DialogContent>
            </Dialog>
            {/* Share Dialog */}
            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                <DialogContent className="bg-black/80 border border-[#2d6af2]/30 backdrop-blur-xl w-11/12 max-w-md rounded-2xl overflow-hidden p-0 shadow-[0_0_50px_rgba(45,106,242,0.2)]">
                    <VisuallyHidden>
                        <DialogTitle>Invite Players</DialogTitle>
                    </VisuallyHidden>

                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#2d6af2]/10 blur-[50px] pointer-events-none"></div>

                    <div className="p-6 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-display text-white tracking-widest uppercase">INVITE RACERS</h3>
                                <p className="text-sm text-gray-400 font-body">Share this room via social platforms</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShareOpen(false)}
                                className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
                            >
                                <X size={20} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <a
                                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Ayo balap quiz bareng di NitroQuiz! Join room: ${joinLink}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center p-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl transition-all group"
                            >
                                <div className="w-10 h-10 mb-2 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-xl group-hover:scale-110 transition-transform">
                                    W
                                </div>
                                <span className="text-[#25D366] text-xs font-display tracking-wider">WhatsApp</span>
                            </a>

                            <a
                                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Ayo balap quiz bareng di NitroQuiz! Join room ${roomCode} sekarang: ${joinLink}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                            >
                                <div className="w-10 h-10 mb-2 rounded-full bg-black flex items-center justify-center text-white font-bold text-xl group-hover:scale-110 transition-transform border border-white/20">
                                    X
                                </div>
                                <span className="text-white text-xs font-display tracking-wider">X (Twitter)</span>
                            </a>

                            <a
                                href={`https://t.me/share/url?url=${encodeURIComponent(joinLink)}&text=${encodeURIComponent('Ayo balap quiz bareng di NitroQuiz!')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center p-4 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 rounded-xl transition-all group"
                            >
                                <div className="w-10 h-10 mb-2 rounded-full bg-[#0088cc] flex items-center justify-center text-white font-bold text-xl group-hover:scale-110 transition-transform">
                                    T
                                </div>
                                <span className="text-[#0088cc] text-xs font-display tracking-wider">Telegram</span>
                            </a>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Share2 className="text-gray-500 w-4 h-4" />
                            </div>
                            <input
                                readOnly
                                value={joinLink}
                                className="w-full bg-black/40 border border-white/10 text-white text-sm py-3 pl-10 pr-24 rounded-lg outline-none font-mono focus:border-[#2d6af2] transition-colors"
                            />
                            <div className="absolute inset-y-1 right-1">
                                <Button
                                    onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
                                    className="h-full bg-[#2d6af2] hover:bg-[#4da6ff] text-white font-display text-xs px-4 rounded-md uppercase tracking-wider"
                                >
                                    {copiedJoin ? "Copied" : "Copy"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Countdown Overlay — dark bg, smooth CSS transitions */}
            {countdown !== null && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center"
                    style={{ willChange: 'opacity', animation: 'fadeIn 0.3s ease-out' }}
                >
                    {/* Racing lights */}
                    <div className="flex gap-4 mb-10">
                        {[0, 1, 2, 3, 4].map((i) => {
                            const isLit = countdown <= (10 - i * 2);
                            const isGo = countdown <= 0;
                            return (
                                <div
                                    key={i}
                                    className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2"
                                    style={{
                                        borderColor: isGo ? '#00ff9d' : isLit ? '#ef4444' : '#374151',
                                        backgroundColor: isGo ? '#00ff9d' : isLit ? '#ef4444' : 'rgba(55, 65, 81, 0.3)',
                                        boxShadow: isGo ? '0 0 30px rgba(0,255,157,0.8)' : isLit ? '0 0 25px rgba(239,68,68,0.7)' : 'none',
                                        transform: isLit ? 'scale(1.1)' : 'scale(1)',
                                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Countdown number - CSS animation only */}
                    <span
                        key={countdown}
                        className={`font-display text-[150px] md:text-[220px] font-black leading-none tracking-tighter ${
                            countdown > 6 ? 'text-[#2d6af2]' : countdown > 3 ? 'text-yellow-400' : 'text-[#00ff9d]'
                        } drop-shadow-[0_0_50px_currentColor]`}
                        style={{
                            animation: 'countdown-pop 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
                            willChange: 'transform, opacity',
                        }}
                    >
                        {countdown > 0 ? countdown : "GO!"}
                    </span>

                    {countdown > 0 && (
                        <p className="font-display text-xl md:text-2xl tracking-[0.3em] uppercase text-gray-500 mt-6">
                            RACE STARTING
                        </p>
                    )}

                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes countdown-pop {
                            0% { transform: scale(1.5); opacity: 0; }
                            60% { transform: scale(0.95); opacity: 1; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
