"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Users, Play, LogOut, Share2, Copy, Check, Maximize2, 
  Trash2, Plus, Volume2, VolumeX, X, CheckSquare, Square 
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Helper: Generate initials from a name
const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#f97316'];
const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const InitialsAvatar = ({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const fontSize = size === 'lg' ? 'text-[20px]' : size === 'md' ? 'text-[16px]' : 'text-[10px]';
  return (
    <div 
      className="w-full h-full rounded-full flex items-center justify-center font-black text-white"
      style={{ backgroundColor: getAvatarColor(name), fontSize }}
    >
      {getInitials(name)}
    </div>
  );
};

export default function HostLobby() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const roomCode = params.roomCode as string;

  const [participants, setParticipants] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [joinLink, setJoinLink] = useState("");
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedJoin, setCopiedJoin] = useState(false);
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isBulkKickMode, setIsBulkKickMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setJoinLink(`${window.location.origin}/player/${roomCode}/join`);
    }

    const loadSession = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("game_pin", roomCode)
        .single();
      if (error || !data) return;
      setSession(data);

      const { data: pData } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", data.id);
      if (pData) setParticipants(pData);
    };

    loadSession();

    const channel = supabase
      .channel(`lobby-${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        async (payload) => {
          const { data: sessionData } = await supabase
            .from("sessions")
            .select("id")
            .eq("game_pin", roomCode)
            .single();
          if (!sessionData) return;
          const { data: pData } = await supabase
            .from("participants")
            .select("*")
            .eq("session_id", sessionData.id);
          if (pData) setParticipants(pData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  const copyToClipboard = (text: string, setCopied: any) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    if (!session || participants.length === 0) return;
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setTimeout(async () => {
        await supabase
          .from("sessions")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("id", session.id);
        router.push(`/host/${roomCode}/monitor`);
      }, 1000);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, session, roomCode, router]);

  const confirmKick = async () => {
    if (isBulkKickMode) {
      await supabase.from("participants").delete().in("id", selectedPlayerIds);
      setSelectedPlayerIds([]);
    } else if (selectedPlayer) {
      await supabase.from("participants").delete().eq("id", selectedPlayer.id);
    }
    setKickDialogOpen(false);
  };

  const toggleSelectPlayer = (id: string, e: any) => {
    e.stopPropagation();
    setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedPlayerIds.length === participants.length) setSelectedPlayerIds([]);
    else setSelectedPlayerIds(participants.map(p => p.id));
  };

  const simulateJoin = async () => {
    if (!session) return;
    const botName = `Bot ${Math.floor(Math.random() * 1000)}`;
    const cars = ['rico', 'gecho', 'roadhog'];
    await supabase.from("participants").insert({
      session_id: session.id,
      nickname: botName,
      car_character: cars[Math.floor(Math.random() * cars.length)],
      score: 0,
      minigame: false
    });
  };

  const formatUrlBreakable = (url: string) => {
    return url.replace('https://', '').replace('http://', '');
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#2d6af2]/30 border-t-[#2d6af2] rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-[#2d6af2] text-xl tracking-widest uppercase animate-pulse">{t('host_lobby.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#06080d] relative overflow-hidden font-body text-white flex flex-col" onClick={() => setHasInteracted(true)}>
      {/* Cityscape Background Layer */}
      <div className="fixed inset-0 z-0 city-silhouette pointer-events-none opacity-40"></div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-blue-900/10 via-transparent to-black pointer-events-none"></div>
      
      {/* Grid Floor */}
      <div className="fixed bottom-0 w-full h-[60%] bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px)] bg-[length:60px_60px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom z-0 pointer-events-none opacity-20"></div>

      <div className="relative z-10 flex flex-col h-full w-full max-w-[1800px] mx-auto px-6 md:px-10 lg:px-16 pt-6 pb-10">
        
        {/* Header - Corner Logos */}
        <div className="flex items-center justify-between mb-8 shrink-0">
          <img src="/assets/logo/logo1.png" alt="Logo" className="h-12 object-contain" />
          <div className="flex flex-col items-end">
            <img src="/assets/logo/logo2.png" alt="NitroQuiz" className="h-12 object-contain brightness-125" />
          </div>
        </div>

        {/* Main Grid: Split Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch flex-1 min-h-0">
          
          {/* Left: Registration Card */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-5 lg:col-span-4 flex flex-col bg-black/60 backdrop-blur-3xl rounded-[4rem] border border-white/10 shadow-[0_40px_80px_rgba(45,106,242,0.15)] overflow-hidden relative group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#2d6af2]/10 to-transparent rounded-bl-full pointer-events-none"></div>
            
            {/* Scrollable Upper Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 lg:p-12 relative z-10">
              <div className="flex flex-col gap-10">
                {/* ROOM PIN */}
                <div 
                  className="group/code cursor-pointer bg-white/5 rounded-[3rem] py-8 border border-white/10 hover:border-[#2d6af2]/50 transition-all flex flex-col items-center relative overflow-hidden"
                  onClick={() => copyToClipboard(roomCode, setCopiedRoom)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#2d6af2]/5 to-transparent opacity-0 group-hover/code:opacity-100 transition-opacity"></div>
                  <span className="text-white/40 text-[10px] font-display uppercase tracking-[0.4em] mb-2">{t('host_lobby.join_code')}</span>
                  <h1 className="font-display text-6xl lg:text-7xl font-black text-white tracking-widest drop-shadow-[0_0_30px_rgba(45,106,242,0.5)]">
                    {roomCode}
                  </h1>
                  <div className="absolute top-4 right-8">
                    {copiedRoom ? <Check size={20} className="text-[#00ff9d]" /> : <Copy size={20} className="text-white/20 group-hover/code:text-[#2d6af2]" />}
                  </div>
                </div>

                {/* QR COMPONENT */}
                <div className="flex items-center justify-center">
                  <div 
                    className="p-4 bg-white rounded-[3.5rem] shadow-[0_0_50px_rgba(255,255,255,0.1)] group/qr cursor-pointer transition-transform hover:scale-[1.03] relative"
                    onClick={() => setOpen(true)}
                  >
                    <QRCode value={joinLink} size={260} bgColor="transparent" fgColor="#000000" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/qr:opacity-100 transition-opacity rounded-[3.5rem] flex items-center justify-center backdrop-blur-sm">
                      <Maximize2 size={48} className="text-white" />
                    </div>
                  </div>
                </div>

                {/* LINK DISPLAY */}
                <div 
                  className="bg-white/5 rounded-[2.5rem] py-5 px-8 border border-white/10 hover:border-[#2d6af2]/30 transition-all cursor-pointer text-center group/link relative overflow-hidden"
                  onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
                >
                  <p className="text-white/30 text-[9px] uppercase tracking-[0.3em] font-display mb-1">{t('host_lobby.join_url')}</p>
                  <p className="text-white text-base font-display font-medium tracking-wide truncate">{formatUrlBreakable(joinLink)}</p>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {copiedJoin ? <Check size={16} className="text-[#00ff9d]" /> : <Copy size={16} className="text-white/10 group-hover/link:text-[#2d6af2]" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-10 lg:p-12 pt-0 shrink-0 relative z-10 bg-gradient-to-t from-black/40 to-transparent">
              <div className="flex flex-col gap-4">
                <Button 
                  onClick={startGame}
                  disabled={participants.length === 0 || countdown !== null}
                  className="w-full bg-gradient-to-r from-[#2d6af2] to-[#00ff9d] hover:brightness-110 text-black font-display text-xl font-black py-8 rounded-[2rem] shadow-[0_20px_40px_rgba(45,106,242,0.3)] tracking-[0.2em] uppercase"
                >
                  <Play className="fill-current w-6 h-6 mr-3" />
                  {countdown !== null ? t('host_lobby.starting') : t('host_lobby.start')}
                </Button>
                
                <div className="flex gap-4">
                  <Button onClick={() => router.push("/host/select-quiz")} className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-[1.5rem] h-14 font-display uppercase tracking-widest text-[11px] transition-all">
                    <LogOut size={18} className="mr-2" /> {t('host_lobby.exit')}
                  </Button>
                  <Button onClick={() => setShareOpen(true)} className="flex-1 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-[1.5rem] h-14 font-display uppercase tracking-widest text-[11px] transition-all">
                    <Share2 size={18} className="mr-2" /> {t('host_lobby.invite')}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Players List */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-7 lg:col-span-8 flex flex-col bg-black/60 backdrop-blur-3xl rounded-[4rem] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.5)] overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#00ff9d]/5 to-transparent rounded-bl-full pointer-events-none"></div>

            {/* Header Area */}
            <div className="px-10 py-8 flex items-center justify-between border-b border-white/5 relative z-10 shrink-0">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-[#00ff9d]/10 rounded-[1.5rem] shadow-[0_0_30px_rgba(0,255,157,0.1)]">
                  <Users size={32} className="text-[#00ff9d]" />
                </div>
                <div>
                  <h2 className="font-display text-4xl font-bold text-white tracking-wide">{participants.length}</h2>
                  <p className="text-[#00ff9d] text-[10px] uppercase font-display tracking-[0.3em] opacity-80">{t('host_lobby.players')}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={simulateJoin} variant="outline" className="bg-[#00ff9d]/5 border-[#00ff9d]/20 text-[#00ff9d] rounded-2xl px-6 h-12 font-display text-[12px] uppercase tracking-widest hover:bg-[#00ff9d]/15 transition-all">
                  <Plus size={18} className="mr-2" /> {t('host_lobby.bot')}
                </Button>
                <button onClick={() => setIsMuted(!isMuted)} className={`w-12 h-12 flex items-center justify-center rounded-2xl border transition-all ${isMuted ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-[#2d6af2]/10 border-[#2d6af2]/30 text-[#2d6af2]"}`}>
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>
            </div>

            {/* Players Grid Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 relative z-10">
              {participants.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <Users size={120} className="text-white mb-10 animate-pulse" />
                  <p className="font-display tracking-[0.5em] text-lg uppercase text-white">{t('host_lobby.waiting')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence>
                    {participants.map((player) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="group relative bg-[#11111a] border border-white/10 rounded-[2.5rem] p-6 flex flex-col items-center justify-center transition-all hover:border-[#2d6af2]/50 hover:bg-[#1a1c2e] hover:shadow-[0_15px_40px_rgba(45,106,242,0.15)] hover:-translate-y-2 overflow-hidden"
                      >
                        <div className="w-20 h-20 rounded-full border-[3px] border-[#2d6af2]/30 bg-black/40 overflow-hidden mb-5 items-center justify-center flex shadow-inner">
                          {player.avatar_url ? (
                            <img src={player.avatar_url} alt="Ava" className="w-full h-full object-cover" />
                          ) : (
                            <InitialsAvatar name={player.nickname} size="lg" />
                          )}
                        </div>
                        <div className="bg-white/5 rounded-2xl px-5 py-2 w-full text-center">
                          <p className="font-display text-white text-sm font-bold truncate tracking-widest">{player.nickname}</p>
                        </div>
                        
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); setKickDialogOpen(true); }}
                          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20 text-red-500 p-2.5 rounded-full hover:bg-red-500 hover:text-white"
                        >
                          <X size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <DialogOverlay className="bg-black/90 backdrop-blur-md" />
        <DialogContent className="bg-[#11111a] border border-red-500/30 text-white p-10 max-w-md rounded-[3rem] shadow-[0_0_100px_rgba(239,68,68,0.2)]">
          <DialogTitle className="text-3xl font-display uppercase tracking-[0.2em] text-center mb-8">{t('host_lobby.kick')} {selectedPlayer?.nickname}?</DialogTitle>
          <div className="flex gap-5">
            <Button onClick={() => setKickDialogOpen(false)} variant="ghost" className="flex-1 border border-white/10 h-16 rounded-2xl font-display uppercase text-xs tracking-widest text-gray-400">Cancel</Button>
            <Button onClick={confirmKick} className="flex-1 bg-red-500 hover:bg-red-600 text-white h-16 rounded-2xl font-display uppercase text-xs tracking-widest">KICK</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogOverlay className="bg-black/95 backdrop-blur-2xl" />
        <DialogContent className="bg-white p-12 md:p-20 rounded-[4rem] shadow-[0_0_150px_rgba(255,255,255,0.2)] max-w-none w-auto outline-none">
          <VisuallyHidden><DialogTitle>QR</DialogTitle></VisuallyHidden>
          <QRCode value={joinLink} size={600} />
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="bg-[#11111a] border border-white/10 backdrop-blur-3xl rounded-[3rem] p-10 max-w-lg">
           <DialogHeader className="mb-8">
             <DialogTitle className="text-2xl font-display uppercase tracking-[0.3em] font-black">{t('host_lobby.invite_title')}</DialogTitle>
           </DialogHeader>
           <div className="flex flex-col gap-6">
             <div className="flex gap-4">
                <input readOnly value={joinLink} className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl font-mono text-sm outline-none focus:border-[#2d6af2]" />
                <Button onClick={() => copyToClipboard(joinLink, setCopiedJoin)} className="bg-[#2d6af2] px-8 rounded-xl font-display uppercase text-xs tracking-widest">
                  {copiedJoin ? "COPIED" : "COPY"}
                </Button>
             </div>
             <p className="text-gray-500 text-[10px] text-center uppercase tracking-widest">{t('host_lobby.invite_desc')}</p>
           </div>
        </DialogContent>
      </Dialog>

      {/* Styles & Animation */}
      {countdown !== null && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="flex gap-6 mb-16">
              {[3, 2, 1].map(v => (
                <div key={v} className={`w-14 h-14 rounded-full border-2 transition-all duration-500 ${countdown <= v ? "bg-white scale-125 shadow-[0_0_40px_white]" : "bg-white/10 opacity-20"}`} />
              ))}
           </div>
           <motion.span key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[250px] font-display font-black text-white glow-text">
             {countdown > 0 ? countdown : "GO!"}
           </motion.span>
        </div>
      )}

      <style jsx>{`
        .glow-text {
          text-shadow: 0 0 50px rgba(45,100,242,0.8), 0 0 100px rgba(45,106,242,0.4);
        }
        .city-silhouette {
          background: url('/assets/bg/city_silhouette.png') bottom center no-repeat;
          background-size: cover;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}
