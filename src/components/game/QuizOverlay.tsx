'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number; // index of the correct option
}

interface QuizOverlayProps {
    questions: QuizQuestion[];
    onComplete: (results: { correct: number; total: number; score: number }) => void;
    roundNumber: number;
}

export default function QuizOverlay({ questions, onComplete, roundNumber }: QuizOverlayProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [totalScore, setTotalScore] = useState(0);

    const currentQ = questions[currentIndex];
    const total = questions.length;

    // Timer countdown
    useEffect(() => {
        if (isConfirmed || !currentQ) return;

        if (timeLeft <= 0) {
            handleConfirm(-1);
            return;
        }

        const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [timeLeft, isConfirmed, currentQ]);

    // Reset state on new question
    useEffect(() => {
        setTimeLeft(15);
        setSelectedAnswer(null);
        setIsConfirmed(false);
    }, [currentIndex]);

    const handleConfirm = useCallback((answerIdx: number) => {
        if (isConfirmed) return;
        setSelectedAnswer(answerIdx);
        setIsConfirmed(true);

        const isCorrect = answerIdx === currentQ.correctAnswer;
        const currentPoints = isCorrect ? 100 + Math.floor(timeLeft * 3.33) : 0;
        
        if (isCorrect) {
            setCorrectCount(prev => prev + 1);
            setTotalScore(prev => prev + currentPoints);
        }

        // Move to the next question after a very short delay for the "selected" animation
        setTimeout(() => {
            if (currentIndex < total - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                // Final calculation for completion
                const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
                const finalScore = isCorrect ? totalScore + currentPoints : totalScore;
                onComplete({ correct: finalCorrect, total, score: finalScore });
            }
        }, 600); // Shorter delay since we don't show feedback
    }, [isConfirmed, currentQ, currentIndex, total, correctCount, totalScore, timeLeft, onComplete]);

    if (!currentQ) return null;

    const timerColor = timeLeft > 10 ? '#00ff9d' : timeLeft > 5 ? '#fbbf24' : '#ef4444';
    const timerPercent = (timeLeft / 15) * 100;
    const labels = ['A', 'B', 'C', 'D'];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            backgroundColor: 'rgba(2, 6, 23, 0.9)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-rajdhani), sans-serif',
            padding: '1rem',
            overflow: 'hidden',
        }}>
            {/* Background decorative elements */}
            <div style={{
                position: 'absolute', top: -100, left: -100, width: 300, height: 300,
                background: 'radial-gradient(circle, rgba(45,106,242,0.15) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute', bottom: -100, right: -100, width: 400, height: 400,
                background: 'radial-gradient(circle, rgba(0,255,157,0.1) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none'
            }} />

            <div style={{ 
                maxWidth: '42rem', width: '100%', 
                display: 'flex', flexDirection: 'column', gap: '1.5rem',
                position: 'relative', zIndex: 1
            }}>
                
                {/* Header: Progress & Timer */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{
                            fontSize: '0.75rem', fontWeight: 700, color: '#2d6af2',
                            letterSpacing: '0.2em', textTransform: 'uppercase'
                        }}>
                            Question {currentIndex + 1} of {total}
                        </span>
                        <div style={{
                            fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)',
                            padding: '0.15rem 0.5rem', background: 'rgba(255,255,255,0.05)',
                            borderRadius: '0.3rem', border: '1px solid rgba(255,255,255,0.1)',
                            alignSelf: 'flex-start'
                        }}>
                            ROUND {roundNumber}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                         <span style={{
                            fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8',
                            letterSpacing: '0.2em', textTransform: 'uppercase'
                        }}>
                           Time Remaining
                        </span>
                        <motion.span 
                            key={timeLeft}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            style={{
                                fontSize: '2.5rem', fontWeight: 900, color: timerColor,
                                textShadow: `0 0 20px ${timerColor}40`,
                                lineHeight: 0.9,
                            }}
                        >
                            {timeLeft}
                        </motion.span>
                    </div>
                </div>

                {/* Main Quiz Card */}
                <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '1.5rem',
                    padding: '2.5rem',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Progress Bar Top */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '4px',
                        backgroundColor: 'rgba(255,255,255,0.05)'
                    }}>
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: `${timerPercent}%` }}
                            transition={{ duration: 1, ease: 'linear' }}
                            style={{
                                height: '100%', backgroundColor: timerColor,
                                boxShadow: `0 0 10px ${timerColor}`
                            }}
                        />
                    </div>

                    {/* Question Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            style={{ marginBottom: '2.5rem' }}
                        >
                            <h2 style={{
                                fontSize: 'clamp(1.2rem, 4vw, 1.75rem)', 
                                fontWeight: 800, 
                                color: 'white',
                                lineHeight: 1.4,
                                textAlign: 'center',
                                margin: 0,
                                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                            }}>
                                {currentQ.question}
                            </h2>
                        </motion.div>
                    </AnimatePresence>

                    {/* Options Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1rem',
                    }}>
                        {currentQ.options.map((option, idx) => (
                            <motion.button
                                key={idx}
                                whileHover={!isConfirmed ? { scale: 1.02, backgroundColor: 'rgba(45, 106, 242, 0.15)', borderColor: 'rgba(45, 106, 242, 0.5)' } : {}}
                                whileTap={!isConfirmed ? { scale: 0.98 } : {}}
                                onClick={() => !isConfirmed && handleConfirm(idx)}
                                disabled={isConfirmed}
                                style={{
                                    background: selectedAnswer === idx ? 'rgba(45, 106, 242, 0.3)' : 'rgba(255, 255, 255, 0.03)',
                                    border: selectedAnswer === idx ? '2px solid #2d6af2' : '2px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '1rem',
                                    padding: '1.25rem 1.5rem',
                                    textAlign: 'left',
                                    cursor: isConfirmed ? 'default' : 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    color: 'white',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <span style={{
                                    width: '2.5rem', height: '2.5rem', borderRadius: '0.6rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1rem', fontWeight: 900,
                                    backgroundColor: selectedAnswer === idx ? '#2d6af2' : 'rgba(255,255,255,0.05)',
                                    color: selectedAnswer === idx ? 'white' : 'rgba(255,255,255,0.4)',
                                    flexShrink: 0,
                                    transition: 'all 0.3s'
                                }}>
                                    {labels[idx]}
                                </span>
                                <span style={{
                                    fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', 
                                    fontWeight: 600,
                                    lineHeight: 1.3
                                }}>
                                    {option}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Footer stats: Minimalized */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '2rem',
                    fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.2em', textTransform: 'uppercase'
                }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        SCORE <span style={{ color: '#00ff9d', fontSize: '1rem' }}>{totalScore}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
