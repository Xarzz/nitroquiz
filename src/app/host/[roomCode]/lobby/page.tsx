"use client";

import { useState, useEffect } from "react";
import {
  Users, Play, LogOut, Copy, Check, Maximize2,
  Volume2, VolumeX, X, UserPlus, Users2, Bot
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
  const [qrOpen, setQrOpen] = useState(false);
  const [inviteFriendOpen, setInviteFriendOpen] = useState(false);
  const [inviteGroupOpen, setInviteGroupOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setJoinLink(`${window.location.origin}/join/${roomCode}`);
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
        async () => {
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

  const handleAddBot = async () => {
    if (!session) return;
    const botCount = participants.filter((p) => p.car_character?.endsWith("-bot")).length;
    const botNickname = `CPU_${botCount + 1}`;
    const botCharacters = ['rico-bot', 'roadhog-bot', 'gecho-bot'];
    const selectedChar = botCharacters[Math.floor(Math.random() * botCharacters.length)];
    
    try {
      await supabase.from("participants").insert({
          session_id: session.id,
          nickname: botNickname,
          car_character: selectedChar,
          score: 0,
          current_question: 0
      });
    } catch (e) {
      console.error("Failed to add bot", e);
    }
  };

  const confirmKick = async () => {
    if (selectedPlayer) {
      await supabase.from("participants").delete().eq("id", selectedPlayer.id);
    }
    setKickDialogOpen(false);
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
    <div className="min-h-screen bg-[#06080d] relative font-body text-white flex flex-col">
      {/* Background Layers */}
      <div className="fixed inset-0 z-0 city-silhouette pointer-events-none opacity-40"></div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-blue-900/10 via-transparent to-black pointer-events-none"></div>
      <div className="fixed bottom-0 w-full h-[60%] bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px)] bg-[length:60px_60px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom z-0 pointer-events-none opacity-20"></div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-[1400px] mx-auto px-3 sm:px-6 md:px-8 pt-3 sm:pt-4 pb-4 sm:pb-6 gap-3 sm:gap-4">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <img src="/assets/logo/logo1.png" alt="Logo" className="h-8 sm:h-10 object-contain" />
          <img src="/assets/logo/logo2.png" alt="NitroQuiz" className="h-7 sm:h-9 object-contain brightness-125" />
        </div>

        {/* Main Layout */}
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 flex-1">

          {/* ═══ LEFT CARD: Room Info ═══ */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full md:w-[340px] lg:w-[390px] shrink-0 flex flex-col bg-black/60 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(45,106,242,0.15)] overflow-hidden relative"
          >
            <div className="absolute top-0 end-0 w-48 h-48 bg-gradient-to-bl from-[#2d6af2]/10 to-transparent rounded-bl-full pointer-events-none z-0"></div>

            {/* MOBILE: compact top row */}
            <div className="flex md:hidden items-center gap-3 p-4 border-b border-white/5">
              <div
                className="flex-1 group/code cursor-pointer bg-white/5 rounded-xl py-3 px-4 border border-white/10 hover:border-[#2d6af2]/50 transition-all flex items-center justify-between relative overflow-hidden"
                onClick={() => copyToClipboard(roomCode, setCopiedRoom)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#2d6af2]/5 to-transparent opacity-0 group-hover/code:opacity-100 transition-opacity"></div>
                <h1 className="font-display text-2xl font-black text-white tracking-wider">{roomCode}</h1>
                <div>{copiedRoom ? <Check size={16} className="text-[#00ff9d]" /> : <Copy size={16} className="text-white/20 group-hover/code:text-[#2d6af2]" />}</div>
              </div>
              <button
                onClick={() => setQrOpen(true)}
                className="shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
              >
                <QRCode value={joinLink} size={36} bgColor="transparent" fgColor="#000000" />
              </button>
            </div>

            {/* MOBILE: join link */}
            <div
              className="flex md:hidden items-center gap-2 px-4 py-2.5 border-b border-white/5 cursor-pointer group/link"
              onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
            >
              <p className="flex-1 text-white/60 text-[11px] font-mono truncate">{joinLink}</p>
              {copiedJoin ? <Check size={14} className="text-[#00ff9d] shrink-0" /> : <Copy size={14} className="text-white/20 group-hover/link:text-[#2d6af2] shrink-0" />}
            </div>

            {/* DESKTOP: full vertical layout */}
            <div className="hidden md:flex flex-col gap-4 p-5 flex-1 relative z-10">
              {/* Room Code */}
              <div
                className="group/code cursor-pointer bg-white/5 rounded-xl py-5 border border-white/10 hover:border-[#2d6af2]/50 transition-all flex items-center justify-center relative overflow-hidden"
                onClick={() => copyToClipboard(roomCode, setCopiedRoom)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#2d6af2]/5 to-transparent opacity-0 group-hover/code:opacity-100 transition-opacity"></div>
                <h1 className="font-display text-5xl lg:text-6xl font-black text-white text-center drop-shadow-[0_0_15px_rgba(45,106,242,0.5)] tracking-widest">
                  {roomCode}
                </h1>
                <div className="absolute top-1/2 -translate-y-1/2 end-5">
                  {copiedRoom ? <Check size={20} className="text-[#00ff9d]" /> : <Copy size={20} className="text-white/20 group-hover/code:text-[#2d6af2]" />}
                </div>
              </div>

              {/* QR Code — full width */}
              <div
                className="group/qr cursor-pointer bg-white rounded-2xl p-2 shadow-[0_0_40px_rgba(255,255,255,0.08)] transition-all hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] relative overflow-hidden flex items-center justify-center"
                onClick={() => setQrOpen(true)}
              >
                <QRCode value={joinLink} style={{ width: '100%', height: 'auto', maxWidth: 320 }} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/qr:opacity-100 transition-opacity rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Maximize2 size={36} className="text-white" />
                </div>
              </div>

              {/* Join Link */}
              <div
                className="bg-white/5 rounded-xl py-3 px-4 border border-white/10 hover:border-[#2d6af2]/30 transition-all cursor-pointer group/link flex items-center gap-2"
                onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
              >
                <p className="flex-1 text-white/70 text-xs font-mono tracking-wide truncate">{joinLink}</p>
                <div className="shrink-0">
                  {copiedJoin ? <Check size={14} className="text-[#00ff9d]" /> : <Copy size={14} className="text-white/20 group-hover/link:text-[#2d6af2]" />}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 border-t border-white/5 bg-gradient-to-t from-black/40 to-transparent relative z-10">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setExitDialogOpen(true)}
                    className="bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl h-12 px-3 sm:px-4 font-display text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <LogOut size={16} className="rtl:rotate-180" />
                    <span className="hidden sm:inline text-[11px]">{t('host_lobby.exit')}</span>
                  </Button>

                  <Button
                    onClick={startGame}
                    disabled={participants.length === 0 || countdown !== null}
                    className="flex-1 bg-gradient-to-r from-[#2d6af2] to-[#00ff9d] hover:brightness-110 text-black font-display font-black h-12 rounded-xl shadow-[0_10px_25px_rgba(45,106,242,0.3)] tracking-[0.15em] uppercase text-sm transition-all disabled:opacity-50"
                  >
                    <Play className="fill-current w-4 h-4 me-2" />
                    {countdown !== null ? t('host_lobby.starting') : t('host_lobby.start')}
                  </Button>
                </div>
              </div>
            </div>


          </motion.div>

          {/* ═══ RIGHT CARD: Players List ═══ */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex flex-col bg-black/60 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden min-h-[300px] md:min-h-0 relative"
          >
            <div className="absolute top-0 end-0 w-80 h-80 bg-gradient-to-bl from-[#00ff9d]/5 to-transparent rounded-bl-full pointer-events-none z-0"></div>

            {/* Players Header */}
            <div className="px-4 sm:px-5 py-4 flex items-center justify-between border-b border-white/5 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#00ff9d]/10 rounded-xl">
                  <Users size={20} className="text-[#00ff9d]" />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">{participants.length}</h2>
                  <p className="text-[#00ff9d] text-[9px] uppercase font-display tracking-[0.3em] opacity-80">{t('host_lobby.players')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Invite Friends */}
                <button
                  onClick={() => setInviteFriendOpen(true)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border bg-[#2d6af2]/10 border-[#2d6af2]/30 text-[#2d6af2] hover:bg-[#2d6af2]/20 transition-all font-display text-[10px] uppercase tracking-wider"
                >
                  <UserPlus size={14} />
                  <span className="hidden sm:inline">{t('host_lobby.invite_friends') ?? 'Invite Friends'}</span>
                </button>

                {/* Invite Groups */}
                <button
                  onClick={() => setInviteGroupOpen(true)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all font-display text-[10px] uppercase tracking-wider"
                >
                  <Users2 size={14} />
                  <span className="hidden sm:inline">{t('host_lobby.invite_groups') ?? 'Invite Groups'}</span>
                </button>

                {/* Add Bot */}
                <button
                  onClick={handleAddBot}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all font-display text-[10px] uppercase tracking-wider"
                >
                  <Bot size={14} />
                  <span className="hidden sm:inline">Add Bot</span>
                </button>

                {/* Sound */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${isMuted ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"}`}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            </div>

            {/* Players Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 relative z-10">
              {participants.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
                  <Users size={80} className="text-white mb-6 animate-pulse" />
                  <p className="font-display tracking-[0.4em] text-sm uppercase text-white">{t('host_lobby.waiting')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  <AnimatePresence>
                    {participants.map((player) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="group relative bg-[#11111a] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center transition-all hover:border-[#2d6af2]/50 hover:bg-[#1a1c2e] hover:shadow-[0_10px_30px_rgba(45,106,242,0.15)] hover:-translate-y-1 overflow-hidden"
                      >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-[#2d6af2]/30 bg-black/40 overflow-hidden mb-3 flex items-center justify-center shadow-inner">
                          {player.avatar_url ? (
                            <img src={player.avatar_url} alt="Ava" className="w-full h-full object-cover" />
                          ) : (
                            <InitialsAvatar name={player.nickname} size="md" />
                          )}
                        </div>
                        <div className="bg-white/5 rounded-lg px-2 py-1 w-full text-center">
                          <p className="font-display text-white text-[10px] sm:text-xs font-bold truncate tracking-widest">{player.nickname}</p>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); setKickDialogOpen(true); }}
                          className="absolute top-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20 text-red-500 p-2 rounded-full hover:bg-red-500 hover:text-white"
                        >
                          <X size={14} />
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

      {/* ═══ KICK DIALOG ═══ */}
      <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <DialogOverlay className="bg-black/90 backdrop-blur-md" />
        <DialogContent className="bg-[#11111a] border border-red-500/30 text-white p-8 max-w-sm rounded-[2rem] shadow-[0_0_100px_rgba(239,68,68,0.2)]">
          <DialogTitle className="text-xl font-display uppercase tracking-[0.2em] text-center mb-6">
            {t('host_lobby.kick')} {selectedPlayer?.nickname}?
          </DialogTitle>
          <div className="flex gap-4">
            <Button onClick={() => setKickDialogOpen(false)} variant="ghost" className="flex-1 border border-white/10 h-12 rounded-xl font-display uppercase text-[10px] tracking-widest text-gray-400">
              {t('host_lobby.cancel') ?? 'Cancel'}
            </Button>
            <Button onClick={confirmKick} className="flex-1 bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl font-display uppercase text-[10px] tracking-widest">
              KICK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ EXIT CONFIRMATION DIALOG ═══ */}
      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogOverlay className="bg-black/90 backdrop-blur-md" />
        <DialogContent className="bg-[#11111a] border border-red-500/30 text-white p-8 max-w-sm rounded-[2rem] shadow-[0_0_100px_rgba(239,68,68,0.2)]">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
              <LogOut size={32} className="text-red-500" />
            </div>
            <DialogTitle className="text-xl font-display uppercase tracking-[0.2em] text-center mb-2">
              {t('host_lobby.exit_dialog_title')}
            </DialogTitle>
            <p className="text-white/40 text-[11px] text-center font-display tracking-widest uppercase mb-8">
              {t('host_lobby.exit_dialog_desc')}
            </p>
            <div className="flex gap-4 w-full">
              <Button onClick={() => setExitDialogOpen(false)} variant="ghost" className="flex-1 border border-white/10 h-12 rounded-xl font-display uppercase text-[10px] tracking-widest text-gray-400 hover:bg-white/5 hover:text-white">
                {t('host_lobby.cancel')}
              </Button>
              <Button 
                onClick={() => router.push("/host/select-quiz")} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl font-display uppercase text-[10px] tracking-widest shadow-[0_5px_15px_rgba(239,68,68,0.3)] transition-all hover:scale-105 active:scale-95"
              >
                {t('host_lobby.confirm_exit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ QR FULLSCREEN — klik luar untuk tutup ═══ */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center cursor-pointer"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 shadow-[0_0_80px_rgba(255,255,255,0.15)] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <QRCode value={joinLink} style={{ width: 'min(80vw, 80vh)', height: 'auto', maxWidth: 500 }} />
          </div>
        </div>
      )}

      {/* ═══ INVITE FRIENDS DIALOG ═══ */}
      <Dialog open={inviteFriendOpen} onOpenChange={setInviteFriendOpen}>
        <DialogOverlay className="bg-black/80 backdrop-blur-md" />
        <DialogContent className="bg-[#0f1220] border border-[#2d6af2]/30 text-white p-8 max-w-md rounded-[2rem] shadow-[0_0_80px_rgba(45,106,242,0.2)]">
          <DialogTitle className="text-xl font-display uppercase tracking-[0.2em] text-center mb-2 text-white">
            {t('host_lobby.invite_friends') ?? 'Invite Friends'}
          </DialogTitle>
          <p className="text-white/40 text-xs text-center font-display tracking-widest uppercase mb-6">{t('host_lobby.share_link') ?? 'Share Link'}</p>
          <div className="flex gap-3">
            <input
              readOnly
              value={joinLink}
              className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl font-mono text-xs outline-none focus:border-[#2d6af2] text-white/70"
            />
            <Button
              onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
              className="bg-[#2d6af2] hover:bg-[#2d6af2]/80 px-5 rounded-xl font-display uppercase text-[10px] tracking-widest"
            >
              {copiedJoin ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ INVITE GROUPS DIALOG ═══ */}
      <Dialog open={inviteGroupOpen} onOpenChange={setInviteGroupOpen}>
        <DialogOverlay className="bg-black/80 backdrop-blur-md" />
        <DialogContent className="bg-[#0f1220] border border-purple-500/30 text-white p-8 max-w-md rounded-[2rem] shadow-[0_0_80px_rgba(168,85,247,0.2)]">
          <DialogTitle className="text-xl font-display uppercase tracking-[0.2em] text-center mb-2 text-white">
            {t('host_lobby.invite_groups') ?? 'Invite Groups'}
          </DialogTitle>
          <p className="text-white/40 text-xs text-center font-display tracking-widest uppercase mb-6">{t('host_lobby.share_link') ?? 'Share Link'}</p>
          <div className="flex gap-3">
            <input
              readOnly
              value={joinLink}
              className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl font-mono text-xs outline-none focus:border-purple-400 text-white/70"
            />
            <Button
              onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
              className="bg-purple-600 hover:bg-purple-700 px-5 rounded-xl font-display uppercase text-[10px] tracking-widest"
            >
              {copiedJoin ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ COUNTDOWN OVERLAY ═══ */}
      {countdown !== null && (
        <div
          className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {/* Traffic Lights */}
          <div className="flex gap-4 mb-8">
            {[
              { color: "#ef4444", activeAt: 3 },
              { color: "#facc15", activeAt: 2 },
              { color: "#00ff9d", activeAt: 1 },
            ].map((light, i) => {
              const isGo = countdown <= 0;
              const isLit = isGo || countdown <= light.activeAt;
              const displayColor = isGo ? "#00ff9d" : light.color;
              return (
                <div key={i} className="w-10 h-10 md:w-14 md:h-14 rounded-full border-2" style={{
                  borderColor: isLit ? displayColor : '#374151',
                  backgroundColor: isLit ? displayColor : 'rgba(55,65,81,0.3)',
                  boxShadow: isLit ? `0 0 30px ${displayColor}, 0 0 60px ${displayColor}55` : 'none',
                  transform: isLit ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              );
            })}
          </div>

          {/* Number */}
          <span
            key={countdown}
            className={`font-display font-black py-2 drop-shadow-[0_0_40px_currentColor] ${countdown === 3 ? 'text-red-500' :
              countdown === 2 ? 'text-yellow-400' :
                'text-[#00ff9d]'
              }`}
            style={{
              fontSize: 'clamp(120px, 22vw, 220px)',
              lineHeight: '1.1',
              display: 'block',
              animation: 'countdown-pop 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
            }}
          >
            {countdown > 0 ? countdown : t('host_lobby.go') ?? 'GO!'}
          </span>

          {/* Label */}
          <p
            className="font-display text-xl text-gray-400 mt-4 tracking-[0.3em] uppercase"
            style={{ animation: 'fadeInUp 0.3s ease-out' }}
          >
            {countdown === 3
              ? (t('player_waiting.ready') ?? 'READY')
              : countdown === 2
                ? (t('player_waiting.steady') ?? 'STEADY')
                : (t('player_waiting.go_race') ?? 'GO RACE!')}
          </p>

          {/* Pulse ring */}
          <div
            className="absolute w-72 h-72 rounded-full border border-[#2d6af2]/30"
            style={{ animation: 'pulseRing 2s ease-in-out infinite' }}
          />

          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
            @keyframes countdown-pop { 0% { transform: scale(1.6) translateY(-20px); opacity: 0 } 60% { transform: scale(0.95) translateY(4px); opacity: 1 } 100% { transform: scale(1) translateY(0); opacity: 1 } }
            @keyframes pulseRing { 0% { transform: scale(1); opacity: 0.3 } 50% { transform: scale(1.8); opacity: 0 } 100% { transform: scale(1); opacity: 0.3 } }
          `}</style>
        </div>
      )}

      <style jsx>{`
        .city-silhouette {
          background: url('/assets/bg/city_silhouette.png') bottom center no-repeat;
          background-size: cover;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
