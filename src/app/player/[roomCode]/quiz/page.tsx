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
    const [timeLeft, setTimeLeft] = useState(15);
    const [roomCode, setRoomCode] = useState<string | null>(roomCodeFromParams || null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [statusText, setStatusText] = useState(t("player_quiz.round_complete"));

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

        const route = `/player/${roomCode || roomCodeFromParams}/game`;
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
                setStatusText(t("player_quiz.quiz_finished"));
            } else {
                setStatusText(t("player_quiz.round_complete"));
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
    const timerColor = timeLeft > 10 ? '#00ff9d' : timeLeft > 5 ? '#fbbf24' : '#ef4444';
    const timerPercent = (timeLeft / 15) * 100;

    const OPTION_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']; // A=blue, B=amber, C=red, D=purple

    return (
        <div className="min-h-screen bg-[#04060f] text-white font-rajdhani overflow-hidden relative flex flex-col items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(45,106,242,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(45,106,242,0.05)_1px,transparent_1px)] bg-[length:50px_50px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="w-full max-w-3xl relative z-10 flex flex-col gap-4">
                {/* Main Card */}
                <div className="bg-[#0c1225]/90 backdrop-blur-2xl border border-[#1e2d4d] rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
                    
                    {/* Card Header: Question X/Y | Timer | SCORE */}
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-white text-lg font-bold">{t("player_quiz.question", { current: currentIndex + 1 })}</span>
                            <span className="text-gray-500 text-lg font-bold">/{questions.length}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-[#0a0f1e] border border-[#1e2d4d] rounded-full">
                            <Timer className="w-4 h-4 text-gray-400" />
                            <span className={`text-base font-bold font-mono ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}>
                                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                            </span>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[#ef4444] text-lg font-bold uppercase tracking-wider">{t("player_quiz.score")}</span>
                            <span className="text-[#ef4444] text-lg font-bold">{score}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-[#0a0f1e]">
                        <motion.div 
                            className="h-full bg-[#3b82f6]"
                            style={{ boxShadow: '0 0 10px rgba(59,130,246,0.5)' }}
                            initial={{ width: '100%' }}
                            animate={{ width: `${timerPercent}%` }}
                            transition={{ duration: 1, ease: "linear" }}
                        />
                    </div>

                    <div className="p-6 md:p-8">
                        {/* Question Text */}
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={currentIndex}
                                initial={{ y: 15, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -15, opacity: 0 }}
                                className="mb-8"
                            >
                                <h3 className="text-xl md:text-2xl font-semibold leading-relaxed text-gray-200">
                                    {currentQ.question}
                                </h3>
                            </motion.div>
                        </AnimatePresence>

                        {/* Options Grid - 2x2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        className={`w-full group relative py-4 px-5 rounded-xl border text-left flex items-center gap-4 transition-all duration-200 ${
                                            isSelected 
                                            ? 'bg-[#1a2744] border-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                                            : 'bg-[#111a2e] border-[#1e2d4d] hover:border-[#2d4060] hover:bg-[#152035]'
                                        }`}
                                    >
                                        {/* Letter Badge */}
                                        <div 
                                            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0 text-white"
                                            style={{ backgroundColor: optionColor }}
                                        >
                                            {letter}
                                        </div>
                                        
                                        {/* Option Text */}
                                        <span className={`text-base font-medium flex-1 ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                            {option}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Perspective Grid */}
            <div className="fixed bottom-0 left-0 w-full h-[30vh] bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px)] bg-[length:60px_60px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom -z-10" />
        </div>
    );
}

