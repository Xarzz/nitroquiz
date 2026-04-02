'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Timer, Trophy, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from "react-i18next";

// Reuse QuizQuestion type
export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    imageUrl?: string;
}

export default function QuizPage() {
    const router = useRouter();
    const params = useParams();
    const { t } = useTranslation();
    const roomCodeFromParams = params?.roomCode as string;
    const [mounted, setMounted] = useState(false);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [questionsAnsweredInRound, setQuestionsAnsweredInRound] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(roomCodeFromParams || null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [statusText, setStatusText] = useState(t("player_quiz.round_complete"));

    const QUESTIONS_PER_ROUND = 3;

    useEffect(() => {
        setMounted(true);
        const storedQuestions = localStorage.getItem('nitroquiz_game_questions');
        const storedIndex = localStorage.getItem('nitroquiz_game_questionIndex');
        const storedScore = localStorage.getItem('nitroquiz_game_score');
        const storedRoom = localStorage.getItem('nitroquiz_game_roomCode');
        const storedSession = localStorage.getItem('nitroquiz_game_sessionId');

        if (storedQuestions) {
            try {
                const parsed = JSON.parse(storedQuestions);
                const normalized: QuizQuestion[] = parsed.map((q: any, idx: number) => {
                    if (q.options && typeof q.correctAnswer === 'number') return q as QuizQuestion;
                    
                    let options: string[] = [];
                    let correctAnswer = 0;
                    if (Array.isArray(q.answers)) {
                        options = q.answers.map((a: any) => a.answer || '');
                        const correctId = String(q.correct);
                        const correctIdx = q.answers.findIndex((a: any) => String(a.id) === correctId);
                        correctAnswer = correctIdx >= 0 ? correctIdx : 0;
                    } else if (Array.isArray(q.options)) {
                        options = q.options;
                        correctAnswer = q.correctAnswer ?? 0;
                    }
                    return {
                        id: q.id || `q-${idx}`,
                        question: q.question || q.text || '',
                        options,
                        correctAnswer,
                        imageUrl: q.image_url || undefined
                    };
                });
                setQuestions(normalized);
            } catch (e) {
                console.error("Failed to parse questions", e);
            }
        } else {
            router.push('/');
        }

        if (storedIndex) setCurrentIndex(parseInt(storedIndex, 10));
        if (storedScore) setScore(parseInt(storedScore, 10));
        setRoomCode(storedRoom);
        setSessionId(storedSession);

        const route = `/player/${roomCode || roomCodeFromParams}/game`;
        router.prefetch(route);

        // Notify Monitor that player is in Quiz mode
        const participantId = localStorage.getItem('nitroquiz_game_participantId');
        if (participantId) {
            supabase.from('participants').update({ minigame: true }).eq('id', participantId).then();
        }
    }, [router]);

    useEffect(() => {
        // No auto timer needed anymore, progress is completely player-driven
    }, [questions.length, currentIndex, isAnswered, questionsAnsweredInRound]);

    const handleAnswer = async (optionIndex: number) => {
        if (isAnswered) return;

        const currentQ = questions[currentIndex];
        const correct = optionIndex === currentQ.correctAnswer;
        
        setSelectedOption(optionIndex);
        setIsAnswered(true);

        const earnedPoints = correct ? Math.ceil(100 / questions.length) : 0;
        const newScore = Math.min(100, score + earnedPoints);
        setScore(newScore);
        
        localStorage.setItem('nitroquiz_game_score', newScore.toString());

        const participantId = localStorage.getItem('nitroquiz_game_participantId');
        if (participantId) {
            try {
                await supabase
                    .from('participants')
                    .update({ 
                        score: newScore,
                        current_question: currentIndex + 1
                    })
                    .eq('id', participantId);
            } catch (e) {
                console.error("Failed to update score/lap in DB", e);
            }
        }

        setTimeout(() => {
            nextQuestion();
        }, 800); // Shorter transition for more competitive feel
    };

    const nextQuestion = () => {
        const nextIdx = currentIndex + 1;
        const nextRoundCount = questionsAnsweredInRound + 1;
        
        setCurrentIndex(nextIdx);
        setQuestionsAnsweredInRound(nextRoundCount);
        setIsAnswered(false);
        setSelectedOption(null);
        
        localStorage.setItem('nitroquiz_game_questionIndex', nextIdx.toString());

        if (nextRoundCount >= QUESTIONS_PER_ROUND || nextIdx >= questions.length) {
            if (nextIdx >= questions.length) {
                setStatusText(t("player_quiz.quiz_finished"));
            } else {
                setStatusText(t("player_quiz.round_complete"));
            }
        }
    };

    // Listen for Host ending the game
    useEffect(() => {
        const sessId = typeof window !== 'undefined' ? localStorage.getItem('nitroquiz_game_sessionId') : null;
        if (!sessId) return;

        const channel = supabase
            .channel(`player_quiz_session_${sessId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessId}` },
                (payload) => {
                    if (payload.new.status === 'finished' || payload.new.status === 'completed') {
                        router.push(`/player/${roomCode || roomCodeFromParams}/result`);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [router, roomCode, roomCodeFromParams]);

    // Auto-redirect
    useEffect(() => {
        if (!mounted || questions.length === 0) return;

        const isFinished = currentIndex >= questions.length;
        const isRoundEnd = questionsAnsweredInRound >= QUESTIONS_PER_ROUND;

        if (isFinished || isRoundEnd) {
            const finalizeStatus = async () => {
                if (isFinished && sessionId) {
                    const participantId = localStorage.getItem('nitroquiz_game_participantId');
                    if (participantId) {
                        try {
                            await supabase.from('participants').update({
                                finished_at: new Date().toISOString()
                            }).eq('id', participantId);
                        } catch (e) {
                            console.error("Failed to set finished_at", e);
                        }
                    }
                }
            };
            finalizeStatus();

            const timer = setTimeout(() => {
                if (isFinished) {
                    router.push(`/player/${roomCode || roomCodeFromParams}/result`);
                } else {
                    router.push(`/player/${roomCode || roomCodeFromParams}/game`);
                }
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [questionsAnsweredInRound, currentIndex, questions.length, mounted, router, roomCode, roomCodeFromParams]);

    if (!mounted || questions.length === 0 || currentIndex >= questions.length && questionsAnsweredInRound < QUESTIONS_PER_ROUND) {
        return <div className="min-h-screen bg-[#04060f]" />;
    }

    if (questionsAnsweredInRound >= QUESTIONS_PER_ROUND || currentIndex >= questions.length) {
        return (
            <div className="min-h-screen bg-[#04060f] flex items-center justify-center text-white font-rajdhani">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                         <div className="w-16 h-16 border-4 border-[#2d6af2]/10 border-t-[#2d6af2] rounded-full animate-spin" />
                         <Trophy className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-[#2d6af2]/40" />
                    </div>
                    <p className="text-[#2d6af2] text-base font-bold uppercase tracking-[0.4em] animate-pulse">
                        {t("player_quiz.establishing_signal")}
                    </p>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const progressPercent = ((currentIndex) / questions.length) * 100;

    const OPTION_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']; // A=blue, B=amber, C=red, D=purple

    return (
        <div className="min-h-[100dvh] w-full bg-[#04060f] text-white font-rajdhani overflow-hidden relative flex flex-col items-center justify-center p-2 sm:p-5">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 bg-transparent blur-[120px] pointer-events-none" />
            
            <div className="w-full max-w-3xl mx-auto relative z-10 flex flex-col items-center justify-center">
                {/* Main Card */}
                <div className="w-full bg-[#0c1225]/80 backdrop-blur-3xl border border-[#1e2d4d]/50 rounded-xl md:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    
                    {/* Progress Bar Top */}
                    <div className="w-full h-1.5 bg-[#0a0f1e]">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-[#00ff9d] to-[#3b82f6]"
                            style={{ boxShadow: '0 0 10px rgba(0,255,157,0.5)' }}
                            initial={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                        />
                    </div>

                    {/* Card Header: Question X/Y | SCORE */}
                    <div className="flex items-center justify-between px-3 md:px-7 pt-3 md:pt-6 pb-1 md:pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[#00ff9d] text-sm md:text-xl font-black uppercase tracking-widest">{t("player_quiz.question", { current: currentIndex + 1 })}</span>
                            <span className="text-gray-500 text-xs md:text-base font-bold">/ {questions.length}</span>
                        </div>

                        <div className="flex items-baseline gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                            <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">{t("player_quiz.score")}</span>
                            <span className="text-white text-sm md:text-base font-black">{score}</span>
                        </div>
                    </div>

                    <div className="px-3 md:px-7 pb-3 md:pb-8 pt-2 md:pt-3">
                        {/* Question Text & Image */}
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={currentIndex}
                                initial={{ y: 15, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -15, opacity: 0 }}
                                className="mb-3 md:mb-6"
                            >
                                {currentQ.imageUrl && (
                                    <div className="w-full rounded-xl overflow-hidden mb-3 md:mb-5 border border-white/10 relative pb-[40%] md:pb-[56.25%]">
                                        <img src={currentQ.imageUrl} alt="Quiz visual" className="absolute inset-0 w-full h-full object-cover" />
                                    </div>
                                )}
                                <h3 className="text-sm md:text-xl font-bold leading-snug text-gray-100 text-center text-balance">
                                    {currentQ.question}
                                </h3>
                            </motion.div>
                        </AnimatePresence>

                        {/* Options Grid - always 2 columns on all screens */}
                        <div className="grid grid-cols-2 gap-2 md:gap-3">
                            {currentQ.options.map((option, idx) => {
                                const isSelected = selectedOption === idx;
                                const optionColor = OPTION_COLORS[idx] || OPTION_COLORS[0];
                                const letter = String.fromCharCode(65 + idx);
                                
                                return (
                                    <motion.button
                                        key={`${currentIndex}-${idx}`}
                                        whileHover={!isAnswered ? { scale: 1.02 } : {}}
                                        whileTap={!isAnswered ? { scale: 0.98 } : {}}
                                        onClick={() => handleAnswer(idx)}
                                        disabled={isAnswered}
                                        className={`w-full group relative py-2 md:py-4 px-3 md:px-5 rounded-lg md:rounded-xl border text-left flex items-center gap-2 md:gap-4 transition-all duration-200 ${
                                            isSelected 
                                            ? 'bg-[#1a2744] border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-[1.02]' 
                                            : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-white/5'
                                        }`}
                                    >
                                        {/* Letter Badge */}
                                        <div 
                                            className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center font-black text-sm md:text-lg flex-shrink-0 text-white shadow-lg"
                                            style={{ backgroundColor: optionColor }}
                                        >
                                            {letter}
                                        </div>
                                        
                                        {/* Option Text */}
                                        <span className={`text-xs md:text-base font-medium flex-1 ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                            {option}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

