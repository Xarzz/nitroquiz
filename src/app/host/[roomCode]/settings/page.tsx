"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Clock, ListOrdered, Play, Settings, Volume2, VolumeX } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Image from "next/image"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { supabase, supabaseCentral } from "@/lib/supabase"
import { Question } from "@/types"
import { Logo } from "@/components/ui/logo"
import { useTranslation } from "react-i18next"

const backgroundGif = "/assets/background/2_v2.webp"

export default function SettingsPage() {
    const router = useRouter()
    const { t } = useTranslation()
    const params = useParams()
    const searchParams = useSearchParams()

    const roomCode = Array.isArray(params.roomCode) ? params.roomCode[0] : params.roomCode;

    const [quizId, setQuizId] = useState<string | null>(null);
    const [duration, setDuration] = useState("300")
    const [questionCount, setQuestionCount] = useState("5")
    const [selectedDifficulty, setSelectedDifficulty] = useState("easy")

    const [quizDetail, setQuizDetail] = useState<{
        title: string;
        description: string;
        totalQuestions: number;
        questions: any[];
    } | null>(null)

    const [saving, setSaving] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isMuted, setIsMuted] = useState(true)
    const audioRef = useRef<HTMLAudioElement>(null)

    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled
    }

    useEffect(() => {
        const fetchQuizFromCentral = async () => {
            const storedQuizId = localStorage.getItem("currentQuizId");
            if (!storedQuizId) { console.error("No quiz ID found in storage"); router.push('/host/select-quiz'); return; }
            setQuizId(storedQuizId);
            try {
                const { data, error } = await supabaseCentral.from('quizzes').select('*').eq('id', storedQuizId).single();
                if (error) { console.error("Failed to load quiz metadata", error); return; }
                if (data) {
                    let qs = data.questions || [];
                    if (typeof qs === 'string') { try { qs = JSON.parse(qs); } catch (e) { } }
                    setQuizDetail({ title: data.title || "Untitled Quiz", description: data.description || "No description provided.", totalQuestions: qs.length, questions: qs });
                }
            } catch (err) { console.error("Error fetching quiz from central:", err); }
        };
        fetchQuizFromCentral();
    }, [router]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = 0.5;
        if (isMuted) { audio.pause(); } else { audio.play().catch(() => console.warn("Audio play blocked")); }
    }, [isMuted]);

    const questionCountOptions = useMemo(() => {
        const totalQuestions = quizDetail?.totalQuestions || 0;
        if (totalQuestions === 0) return [5];
        const baseOptions = [5, 10, 20];
        const validOptions = baseOptions.filter((count) => count <= totalQuestions);
        return validOptions.length > 0 ? validOptions : [totalQuestions];
    }, [quizDetail]);

    useEffect(() => {
        if (!quizDetail) return;
        if (quizDetail.totalQuestions > 0) {
            if (questionCountOptions.includes(5)) { setQuestionCount("5"); }
            else if (questionCountOptions.length > 0) { setQuestionCount(questionCountOptions[0].toString()); }
            else { setQuestionCount(quizDetail.totalQuestions.toString()); }
        }
    }, [quizDetail, questionCountOptions]);

    const handleCreateRoom = async () => {
        if (saving || !quizDetail || !quizId) return;
        setSaving(true);
        try {
            const limit = parseInt(questionCount);
            const selectedQuestions = shuffleArray(quizDetail.questions).slice(0, limit);
            
            // 1. Clean up any existing session with the same game_pin (Idempotency)
            // This prevents unique constraint violations if the host re-enters this flow.
            console.log(`[handleCreateRoom] Cleaning up existing sessions for pin: ${roomCode}`);
            await supabase.from('sessions').delete().eq('game_pin', roomCode);

            const sessionPayload = {
                game_pin: roomCode,
                quiz_id: quizId,
                status: 'waiting',
                question_limit: limit,
                total_time_minutes: parseInt(duration) / 60,
                difficulty: selectedDifficulty,
                current_questions: selectedQuestions,
            };

            console.log("[handleCreateRoom] Inserting session payload:", sessionPayload);

            const { data: sessionData, error } = await supabase
                .from('sessions')
                .insert(sessionPayload)
                .select()
                .single();

            if (error) { 
                console.error("Error creating session in Supabase:", {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    entireError: error
                });
                setSaving(false);
                return;
            }

            if (!sessionData) {
                console.error("Session created but no data returned.");
                setSaving(false);
                return;
            }

            console.log("[handleCreateRoom] Session created successfully:", sessionData.id);

            const settings = {
                sessionId: sessionData.id, gamePin: roomCode, quizId: quizId, quizTitle: quizDetail.title,
                totalTimeMinutes: parseInt(duration) / 60, questionLimit: limit, difficulty: selectedDifficulty,
                questions: selectedQuestions, status: 'waiting', players: []
            };
            localStorage.setItem(`session_${roomCode}`, JSON.stringify(settings));
            localStorage.setItem("hostroomCode", roomCode as string);
            localStorage.setItem("settings_muted", isMuted.toString());
            router.push(`/host/${roomCode}/lobby`);
        } catch (err) { 
            console.error("Unexpected error creating session:", err); 
            setSaving(false); 
        }
    };

    const handleCancelSession = async () => {
        setIsDeleting(true);
        try { localStorage.removeItem(`session_${roomCode}`); router.push('/host/select-quiz'); }
        catch (err) { console.error("Error deleting session:", err); router.push('/host/select-quiz'); }
    };

    if (!quizDetail) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0d1b3e] relative overflow-hidden font-display text-white">
                <div className="text-center z-10">
                    <div className="w-16 h-16 border-4 border-[#4a3d8f]/30 border-t-[#a98dc5] rounded-full animate-spin mx-auto mb-6"></div>
                    <p className="mt-4 text-[#a98dc5] text-xl tracking-[0.2em] uppercase animate-pulse">{t('room_settings.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#04060f] relative overflow-hidden font-body selection:bg-[#2d6af2] selection:text-white">
            <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(0,255,157,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.022)_1px,transparent_1px)] bg-[length:80px_80px]" />
            <div className="fixed bottom-0 left-0 right-0 h-52 z-0 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px)] bg-[length:80px_40px] [transform:perspective(400px)_rotateX(60deg)] origin-bottom pointer-events-none opacity-60" />
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(45,106,242,0.07),transparent)] pointer-events-none" />
            <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#04060f] via-[#04060f]/50 to-[#2d6af2]/10 pointer-events-none" />
            <div className="scanlines" />
            <div className="hidden"><audio ref={audioRef} loop /></div>

            <div className="absolute inset-0 overflow-y-auto z-10 flex flex-col">
                {/* Top Bar */}
                <div className="w-full px-4 md:px-6 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <motion.button
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} whileHover={{ scale: 1.05 }}
                            className="p-3 bg-[#080d1a]/60 border border-[#2d6af2]/50 hover:bg-[#2d6af2]/20 hover:border-[#00ff9d] text-[#2d6af2] rounded-xl transition-all shadow-[0_0_15px_rgba(45,106,242,0.3)] flex items-center justify-center group"
                            aria-label="Back to Host"
                            onClick={() => setShowCancelDialog(true)}
                        >
                            <ArrowLeft size={20} className="group-hover:text-white transition-colors" />
                        </motion.button>
                        <Logo width={140} height={40} withText={false} animated={false} />
                    </div>
                    <Image src="/assets/logo/logo2.png" alt="GameForSmart.com" width={240} height={60}
                        className="object-contain opacity-70 hover:opacity-100 transition-opacity duration-300 drop-shadow-[0_0_10px_rgba(169,141,197,0.4)]" />
                </div>

                <div className="relative container mx-auto px-4 sm:px-6 pb-6 max-w-3xl flex-1 flex flex-col justify-center py-4">
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 100, damping: 12 }}>
                        <Card className="bg-[#080d1a]/80 border border-[#2d6af2]/40 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-[2rem] relative overflow-hidden p-0">
                            {/* Aurora accent bar */}
                            <div className="h-[4px] w-full" style={{ background: 'linear-gradient(90deg,#1a45c4,#2d6af2,#00ff9d,#2d6af2,#1a45c4)' }} />

                            <div className="p-6 sm:p-8 flex flex-col gap-7 relative z-10">
                                {/* Ambient glow */}
                                <div className="absolute top-0 right-0 w-40 h-40 bg-[#2d6af2]/10 blur-[60px] pointer-events-none" />

                                {/* Quiz Title */}
                                <div className="p-4 bg-white/[0.03] border border-[#2d6af2]/30 rounded-xl">
                                    <h2 className="text-lg sm:text-xl text-white font-display font-bold uppercase tracking-widest text-center drop-shadow-[0_0_10px_rgba(45,106,242,0.5)]">
                                        {quizDetail.title}
                                    </h2>
                                </div>

                                {/* ── Row 1: Duration + Questions + Sound ── */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">                                    {/* Duration */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-display uppercase tracking-[0.2em] flex items-center gap-1.5 pl-0.5" style={{ color: '#2d6af2' }}>
                                            <Clock className="h-3 w-3" /><span>{t('room_settings.duration')}</span>
                                        </Label>
                                        <Select value={duration} onValueChange={setDuration}>
                                            <SelectTrigger className="h-10 bg-white/[0.03] border border-[#2d6af2]/30 text-white font-display text-xs uppercase tracking-wider focus:border-[#00ff9d] focus:ring-1 focus:ring-[#00ff9d]/50 rounded-xl transition-all">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#04060f] border border-[#2d6af2]/30 text-white font-display uppercase tracking-wider">
                                                {Array.from({ length: 6 }, (_, i) => (i + 1) * 5).map((min) => (
                                                    <SelectItem key={min} value={(min * 60).toString()} className="focus:bg-[#2d6af2]/20 focus:text-white cursor-pointer">
                                                        {min} {t('room_settings.min')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Questions */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-display uppercase tracking-[0.2em] flex items-center gap-1.5 pl-0.5" style={{ color: '#2d6af2' }}>
                                            <ListOrdered className="h-3 w-3" /><span>{t('room_settings.questions')}</span>
                                        </Label>
                                        <Select value={questionCount} onValueChange={setQuestionCount}>
                                            <SelectTrigger className="h-10 bg-white/[0.03] border border-[#2d6af2]/30 text-white font-display text-xs uppercase tracking-wider focus:border-[#00ff9d] focus:ring-1 focus:ring-[#00ff9d]/50 rounded-xl transition-all">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#04060f] border border-[#2d6af2]/30 text-white font-display uppercase tracking-wider">
                                                {questionCountOptions.map((count) => (
                                                    <SelectItem key={count} value={count.toString()} className="focus:bg-[#2d6af2]/20 focus:text-white cursor-pointer">
                                                        {count}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Sound */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-display uppercase tracking-[0.2em] flex items-center gap-1.5 pl-0.5" style={{ color: '#2d6af2' }}>
                                            {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                                            <span>{t('room_settings.sound')}</span>
                                        </Label>
                                        <div className="flex items-center justify-center gap-3 h-10 bg-white/[0.03] border border-[#2d6af2]/30 rounded-xl">
                                            <VolumeX className={`h-3.5 w-3.5 ${isMuted ? "text-red-500" : "text-gray-600"}`} />
                                            <Switch
                                                checked={!isMuted}
                                                onCheckedChange={(checked: boolean) => setIsMuted(!checked)}
                                                className="data-[state=checked]:bg-[#00ff9d] data-[state=unchecked]:bg-[#333] border border-white/10"
                                            />
                                            <Volume2 className={`h-3.5 w-3.5 ${!isMuted ? "text-[#00ff9d]" : "text-gray-600"}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Row 2: Difficulty ── */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-display uppercase tracking-[0.2em] flex items-center gap-1.5 pl-0.5" style={{ color: '#2d6af2' }}>
                                        <Settings className="h-3 w-3" /><span>{t('room_settings.difficulty.title')}</span>
                                    </Label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {(["Easy", "Normal", "Hard"] as const).map((diff) => (
                                            <button
                                                key={diff}
                                                onClick={() => setSelectedDifficulty(diff.toLowerCase())}
                                                className={`h-11 text-xs font-display uppercase tracking-wider transition-all duration-200 rounded-xl border ${
                                                    selectedDifficulty === diff.toLowerCase()
                                                        ? diff === "Easy"
                                                            ? "bg-emerald-500/20 text-[#00ff9d] border-[#00ff9d] shadow-[0_0_14px_rgba(0,255,157,0.5)]"
                                                            : diff === "Normal"
                                                            ? "bg-amber-500/20 text-amber-400 border-amber-500/60 shadow-[0_0_14px_rgba(245,158,11,0.3)]"
                                                            : "bg-red-500/20 text-red-400 border-red-500/60 shadow-[0_0_14px_rgba(239,68,68,0.3)]"
                                                        : diff === "Easy"
                                                        ? "bg-white/[0.03] border-emerald-500/20 text-emerald-500/50 hover:border-[#00ff9d]/60 hover:text-[#00ff9d]"
                                                        : diff === "Normal"
                                                        ? "bg-white/[0.03] border-amber-500/20 text-amber-500/50 hover:border-amber-500/50 hover:text-amber-400"
                                                        : "bg-white/[0.03] border-red-500/20 text-red-500/50 hover:border-red-500/50 hover:text-red-400"
                                                }`}
                                            >
                                                {t(`room_settings.difficulty.${diff.toLowerCase()}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Continue button with glow ── */}
                                <Button
                                    onClick={handleCreateRoom}
                                    disabled={saving}
                                    className="w-full text-sm py-6 font-display uppercase tracking-widest disabled:cursor-not-allowed cursor-pointer transition-all rounded-xl border-none"
                                    style={{
                                        background: saving ? 'rgba(30,40,60,0.8)' : 'linear-gradient(135deg,#1a45c4,#2d6af2,#1a45c4)',
                                        boxShadow: saving ? 'none' : '0 0 28px rgba(45,106,242,0.4), 0 0 10px rgba(0,255,157,0.35)',
                                    }}
                                >
                                    {saving ? (
                                        <span className="flex items-center gap-2 text-gray-500">
                                            <div className="h-4 w-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                                            {t('room_settings.button.loading')}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2 text-white font-bold">
                                            <Play className="fill-white h-4 w-4" />
                                            {t('room_settings.button.continue')}
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </Card>
                    </motion.div>

                    <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                        <DialogOverlay className="bg-black/80 backdrop-blur-sm fixed inset-0 z-50" />
                        <DialogContent className="bg-[#04060f] border border-[#2d6af2]/50 p-0 overflow-hidden rounded-2xl max-w-sm shadow-[0_0_30px_rgba(45,106,242,0.2)]">
                            <div className="h-1.5 bg-gradient-to-r from-[#1a45c4] to-[#00ff9d] w-full" />
                            <div className="p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl text-white font-display uppercase tracking-widest text-center drop-shadow-[0_0_10px_rgba(45,106,242,0.5)]">{t('room_settings.delete_dialog.title')}</DialogTitle>
                                    <DialogDescription className="text-center text-gray-400 font-display text-xs tracking-wider mt-4 uppercase">{t('room_settings.delete_dialog.description')}</DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="flex gap-3 mt-8">
                                    <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isDeleting}
                                        className="flex-1 bg-transparent border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white font-display text-xs uppercase tracking-wider h-12 rounded-xl transition-all">
                                        {t('room_settings.delete_dialog.cancel')}
                                    </Button>
                                    <Button onClick={handleCancelSession} disabled={isDeleting}
                                        className="flex-1 bg-gradient-to-r from-red-600 to-red-400 hover:from-red-700 hover:to-red-500 text-white border-none font-display text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.4)] h-12 rounded-xl transition-all">
                                        {isDeleting ? t('room_settings.delete_dialog.deleting') : t('room_settings.delete_dialog.delete')}
                                    </Button>
                                </DialogFooter>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    )
}