'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Timer, Trophy, ArrowRight, Loader2 } from 'lucide-react';
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
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    // const [timeLeft, setTimeLeft] = useState(15);
    const [roomCode, setRoomCode] = useState<string | null>(roomCodeFromParams || null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [statusText, setStatusText] = useState("ROUND COMPLETE!");

    // const timerRef = useRef<NodeJS.Timeout | null>(null);
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
                // The questions might need normalization if they are in the DB format
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

        // Preload the game route so going back is instant
        const customDiff = localStorage.getItem('nitroquiz_game_difficulty') || 'easy';
        const route = (customDiff === 'normal' || customDiff === 'medium') ? '/gamespeed-medium' : '/gamespeed';
        router.prefetch(route);
    }, [router]);

    /* const startTimer = useCallback(() => {
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
    }, []); */

    /* useEffect(() => {
        if (questions.length > 0 && !isAnswered && questionsAnsweredInRound < QUESTIONS_PER_ROUND && currentIndex < questions.length) {
            startTimer();
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [questions.length, currentIndex, isAnswered, questionsAnsweredInRound, startTimer]); */

    const handleAnswer = async (optionIndex: number) => {
        if (isAnswered) return;
        // if (timerRef.current) clearInterval(timerRef.current);

        const currentQ = questions[currentIndex];
        const correct = optionIndex === currentQ.correctAnswer;
        
        setSelectedOption(optionIndex);
        setIsCorrect(correct);
        setIsAnswered(true);

        const earnedPoints = correct ? 10 : 0;
        const newScore = score + earnedPoints;
        setScore(newScore);
        
        // Save score immediately to localStorage
        localStorage.setItem('nitroquiz_game_score', newScore.toString());

        // Update participant score in Supabase
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
        }, 1500);
    };

    const nextQuestion = () => {
        const nextIdx = currentIndex + 1;
        const nextRoundCount = questionsAnsweredInRound + 1;
        
        setCurrentIndex(nextIdx);
        setQuestionsAnsweredInRound(nextRoundCount);
        setIsAnswered(false);
        setSelectedOption(null);
        setIsCorrect(null);
        
        localStorage.setItem('nitroquiz_game_questionIndex', nextIdx.toString());

        // Check if round or game is finished
        if (nextRoundCount >= QUESTIONS_PER_ROUND || nextIdx >= questions.length) {
            if (nextIdx >= questions.length) {
                setStatusText("QUIZ FINISHED!");
            } else {
                setStatusText("ROUND COMPLETE!");
            }
        }
    };

    // Auto-redirect effect when round or quiz is ended
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
            }, 2500); // Wait 2.5 seconds to show the status screen

            return () => clearTimeout(timer);
        }
    }, [questionsAnsweredInRound, currentIndex, questions.length, mounted, router, roomCode, roomCodeFromParams]);

    const handleBackToGame = () => {
        // Redirection now handled by useEffect
    };

    if (!mounted || questions.length === 0 || currentIndex >= questions.length && questionsAnsweredInRound < QUESTIONS_PER_ROUND) {
        if (currentIndex >= questions.length && questions.length > 0) {
            // Handled by the check below
        } else {
            // Render a simple blank dark background instead of a spinning loader.
            // This prevents a jarring "loading" flash during the split-second Next.js hydration, 
            // making the transition from the racing screen feel instant.
            return <div className="min-h-screen bg-[#020617]" />;
        }
    }

    // Round or Game complete screen
    if (questionsAnsweredInRound >= QUESTIONS_PER_ROUND || currentIndex >= questions.length) {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white px-6 font-rajdhani">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-md bg-[#0f172a] border border-blue-500/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(59,130,246,0.2)]"
                >
                    <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
                    <h1 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                        {statusText}
                    </h1>
                    <p className="text-gray-400 mb-8 uppercase tracking-[0.2em]">Total Score: {score}</p>
                    
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-blue-400 text-sm font-bold uppercase tracking-widest animate-pulse">
                        {currentIndex >= questions.length ? "PREPARING RESULTS..." : "RETURNING TO RACE..."}
                      </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    return (
        <div className="min-h-screen bg-[#020617] text-white font-rajdhani overflow-hidden relative flex flex-col items-center justify-center p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(59,130,246,0.15),_transparent_50%)]" />
            
            <div className="w-full max-w-2xl relative z-10">
                {/* Header Info */}
                <div className="flex justify-between items-end mb-8 px-2">
                    <div>
                        <p className="text-blue-400 text-sm uppercase tracking-widest mb-1">Question</p>
                        <h2 className="text-3xl font-black italic">{currentIndex + 1}<span className="text-blue-500/50 not-italic mx-1">/</span>{questions.length}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-emerald-400 text-sm uppercase tracking-widest mb-1">Current Score</p>
                        <h2 className="text-3xl font-black italic">{score}</h2>
                    </div>
                </div>

                {/* Question Box */}
                <motion.div 
                    key={currentIndex}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="bg-[#0f172a] border-l-4 border-blue-500 p-8 rounded-2xl mb-8 shadow-xl"
                >
                    <h3 className="text-2xl font-bold leading-tight">{currentQ.question}</h3>
                </motion.div>

                {/* Timer Bar */}
                {/* <div className="w-full h-1.5 bg-gray-800 rounded-full mb-8 overflow-hidden">
                    <motion.div 
                        className={`h-full ${timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
                        initial={{ width: '100%' }}
                        animate={{ width: `${(timeLeft / 15) * 100}%` }}
                        transition={{ duration: 1, ease: "linear" }}
                    />
                </div> */}

                {/* Options */}
                <div className="grid grid-cols-1 gap-4">
                    <AnimatePresence mode="wait">
                        {currentQ.options.map((option, idx) => {
                            const isSelected = selectedOption === idx;
                            const isCorrectOption = idx === currentQ.correctAnswer;
                            
                            let bgColor = "bg-[#1e293b]";
                            let borderColor = "border-transparent";
                            
                            if (isAnswered) {
                                if (isCorrectOption) {
                                    bgColor = "bg-emerald-500/20";
                                    borderColor = "border-emerald-500";
                                } else if (isSelected) {
                                    bgColor = "bg-red-500/20";
                                    borderColor = "border-red-500";
                                }
                            } else {
                                bgColor = "hover:bg-blue-500/10 hover:border-blue-500/50";
                            }

                            return (
                                <motion.button
                                    key={`${currentIndex}-${idx}`}
                                    whileHover={!isAnswered ? { x: 10 } : {}}
                                    whileTap={!isAnswered ? { scale: 0.98 } : {}}
                                    onClick={() => handleAnswer(idx)}
                                    disabled={isAnswered}
                                    className={`w-full p-5 rounded-xl border-2 text-left flex items-center gap-4 transition-all ${bgColor} ${borderColor}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-black/20 text-blue-400'}`}>
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <span className="text-lg font-medium flex-1">{option}</span>
                                    {isAnswered && isCorrectOption && <Check className="text-emerald-500 w-6 h-6" />}
                                    {isAnswered && isSelected && !isCorrectOption && <X className="text-red-500 w-6 h-6" />}
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Background elements */}
            <div className="fixed bottom-0 left-0 w-full h-1/2 bg-[linear-gradient(transparent_0%,rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[length:50px_50px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom -z-10" />
        </div>
    );
}
