'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Timer, Trophy, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Reuse QuizQuestion type
export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
}

export default function QuizPage() {
    const router = useRouter();
    const params = useParams();
    const roomCodeFromParams = params?.roomCode as string;
    const [mounted, setMounted] = useState(false);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [questionsAnsweredInRound, setQuestionsAnsweredInRound] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [timeLeft, setTimeLeft] = useState(15);
    const [roomCode, setRoomCode] = useState<string | null>(roomCodeFromParams || null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [statusText, setStatusText] = useState("ROUND COMPLETE!");

    const timerRef = useRef<NodeJS.Timeout | null>(null);
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
                        correctAnswer
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

        const customDiff = localStorage.getItem('nitroquiz_game_difficulty') || 'easy';
        const route = (customDiff === 'normal' || customDiff === 'medium') ? '/gamespeed-medium' : '/gamespeed';
        router.prefetch(route);
    }, [router]);

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(15);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    handleAnswer(-1); // Timeout
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => {
        if (questions.length > 0 && !isAnswered && questionsAnsweredInRound < QUESTIONS_PER_ROUND && currentIndex < questions.length) {
            startTimer();
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [questions.length, currentIndex, isAnswered, questionsAnsweredInRound, startTimer]);

    const handleAnswer = async (optionIndex: number) => {
        if (isAnswered) return;
        if (timerRef.current) clearInterval(timerRef.current);

        const currentQ = questions[currentIndex];
        const correct = optionIndex === currentQ.correctAnswer;
        
        setSelectedOption(optionIndex);
        setIsAnswered(true);

        const earnedPoints = correct ? (10 + Math.floor(timeLeft / 2)) : 0;
        const newScore = score + earnedPoints;
        setScore(newScore);
        
        localStorage.setItem('nitroquiz_game_score', newScore.toString());

        if (sessionId && localStorage.getItem('nitroquiz_user')) {
            try {
                const user = JSON.parse(localStorage.getItem('nitroquiz_user') || '{}');
                await supabase
                    .from('participants')
                    .update({ score: newScore })
                    .eq('session_id', sessionId)
                    .eq('nickname', user.nickname);
            } catch (e) {
                console.error("Failed to update score in DB", e);
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
                setStatusText("QUIZ FINISHED!");
            } else {
                setStatusText("ROUND COMPLETE!");
            }
        }
    };

    // Auto-redirect
    useEffect(() => {
        if (!mounted || questions.length === 0) return;

        const isFinished = currentIndex >= questions.length;
        const isRoundEnd = questionsAnsweredInRound >= QUESTIONS_PER_ROUND;

        if (isFinished || isRoundEnd) {
            const timer = setTimeout(() => {
                if (isFinished) {
                    router.push(`/player/${roomCode || roomCodeFromParams}/result`);
                } else {
                    let customDiff = localStorage.getItem('nitroquiz_game_difficulty');
                    if (!customDiff) {
                        try {
                            const settingsStr = localStorage.getItem('edurace_game_settings');
                            if (settingsStr) {
                                const settings = JSON.parse(settingsStr);
                                customDiff = settings.difficulty;
                            }
                        } catch (e) {}
                    }
                    const diff = customDiff || 'easy';
                    let route = `/gamespeed/${roomCode || roomCodeFromParams}`;
                    if (diff === 'normal' || diff === 'medium') {
                        route = `/gamespeed-medium/${roomCode || roomCodeFromParams}`;
                    } else if (diff === 'coba') {
                        route = `/gamespeed-coba/${roomCode || roomCodeFromParams}`;
                    }
                    router.push(route);
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
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                         <Loader2 className="w-16 h-16 text-[#2d6af2] animate-spin" />
                         <Trophy className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-[#00ff9d]" />
                    </div>
                    <p className="text-[#2d6af2] text-sm font-bold uppercase tracking-[0.3em] animate-pulse">
                        {currentIndex >= questions.length ? "FINALIZING RESULTS" : "SYNCING DATA"}
                    </p>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const timerColor = timeLeft > 10 ? '#00ff9d' : timeLeft > 5 ? '#fbbf24' : '#ef4444';
    const timerPercent = (timeLeft / 15) * 100;

    return (
        <div className="min-h-screen bg-[#04060f] text-white font-rajdhani overflow-hidden relative flex flex-col items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(45,106,242,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(45,106,242,0.05)_1px,transparent_1px)] bg-[length:50px_50px]" />
            <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[#2d6af2]/10 to-transparent pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="w-full max-w-2xl relative z-10 flex flex-col gap-6">
                {/* Header Stats */}
                <div className="flex justify-between items-end px-1">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                             <Sparkles className="w-4 h-4 text-[#2d6af2]" />
                             <span className="text-[#2d6af2] text-[10px] font-bold uppercase tracking-[0.3em]">Lap Progress</span>
                        </div>
                        <h2 className="text-4xl font-black italic tracking-tighter text-white">
                            {currentIndex + 1}<span className="text-[#2d6af2]/30 not-italic mx-1">/</span>{questions.length}
                        </h2>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                            <Timer className={`w-3.5 h-3.5 ${timeLeft <= 5 ? 'text-red-500' : 'text-[#00ff9d]'}`} />
                            <span className={`text-[11px] font-bold font-mono ${timeLeft <= 5 ? 'text-red-500' : 'text-[#00ff9d]'}`}>
                                {timeLeft}S
                            </span>
                        </div>
                        <div className="text-right">
                             <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">Total Score</p>
                             <h2 className="text-3xl font-black italic tracking-tighter text-[#00ff9d] drop-shadow-[0_0_15px_rgba(0,255,157,0.3)]">
                                {score}
                             </h2>
                        </div>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-[#080d1a]/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
                    {/* Timer Bar */}
                    <div className="w-full h-1.5 bg-white/5 overflow-hidden">
                        <motion.div 
                            className="h-full"
                            style={{ backgroundColor: timerColor, boxShadow: `0 0 15px ${timerColor}80` }}
                            initial={{ width: '100%' }}
                            animate={{ width: `${timerPercent}%` }}
                            transition={{ duration: 1, ease: "linear" }}
                        />
                    </div>

                    <div className="p-8 md:p-12">
                        {/* Question Box */}
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={currentIndex}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                className="mb-10 text-center"
                            >
                                <h3 className="text-2xl md:text-3xl font-bold leading-tight text-white tracking-tight">
                                    {currentQ.question}
                                </h3>
                            </motion.div>
                        </AnimatePresence>

                        {/* Options */}
                        <div className="grid grid-cols-1 gap-4">
                            {currentQ.options.map((option, idx) => {
                                const isSelected = selectedOption === idx;
                                
                                return (
                                    <motion.button
                                        key={`${currentIndex}-${idx}`}
                                        whileHover={!isAnswered ? { x: 8, backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                                        whileTap={!isAnswered ? { scale: 0.98 } : {}}
                                        onClick={() => handleAnswer(idx)}
                                        disabled={isAnswered}
                                        className={`w-full group relative p-5 rounded-2xl border-2 text-left flex items-center gap-5 transition-all duration-300 ${
                                            isSelected 
                                            ? 'bg-[#2d6af2]/20 border-[#2d6af2] shadow-[0_0_20px_rgba(45,106,242,0.2)]' 
                                            : 'bg-white/5 border-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 transition-all ${
                                            isSelected ? 'bg-[#2d6af2] text-white' : 'bg-white/5 text-blue-400 group-hover:bg-[#2d6af2]/10'
                                        }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <span className={`text-lg font-semibold flex-1 ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                            {option}
                                        </span>
                                        
                                        {isSelected && (
                                             <motion.div 
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="w-2.5 h-2.5 rounded-full bg-[#2d6af2] shadow-[0_0_10px_#2d6af2]" 
                                             />
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Hints / Mini Label */}
                <p className="text-center text-gray-500 text-[10px] uppercase tracking-[0.4em] mt-2">
                    Locked In • Swift Response Bonus Active
                </p>
            </div>

            {/* Bottom Perspective Grid */}
            <div className="fixed bottom-0 left-0 w-full h-[30vh] bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px)] bg-[length:60px_60px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom -z-10" />
        </div>
    );
}

