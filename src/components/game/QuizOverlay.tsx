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
    const [isRevealed, setIsRevealed] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [totalScore, setTotalScore] = useState(0);
    const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

    const currentQ = questions[currentIndex];
    const total = questions.length;

    // Timer countdown
    useEffect(() => {
        if (isRevealed || !currentQ) return;

        if (timeLeft <= 0) {
            handleReveal(-1);
            return;
        }

        const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [timeLeft, isRevealed, currentQ]);

    // Reset timer on new question
    useEffect(() => {
        setTimeLeft(15);
        setSelectedAnswer(null);
        setIsRevealed(false);
        setShowFeedback(null);
    }, [currentIndex]);

    const handleReveal = useCallback((answerIdx: number) => {
        if (isRevealed) return;
        setSelectedAnswer(answerIdx);
        setIsRevealed(true);

        const isCorrect = answerIdx === currentQ.correctAnswer;
        if (isCorrect) {
            setCorrectCount(prev => prev + 1);
            const timeBonus = Math.floor(timeLeft * 3.33);
            setTotalScore(prev => prev + 100 + timeBonus);
            setShowFeedback('correct');
        } else {
            setShowFeedback('wrong');
        }

        // Auto-advance after 1.8 seconds
        setTimeout(() => {
            setShowFeedback(null);
            if (currentIndex < total - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
                const finalScore = isCorrect ? totalScore + 100 + Math.floor(timeLeft * 3.33) : totalScore;
                onComplete({ correct: finalCorrect, total, score: finalScore });
            }
        }, 1800);
    }, [isRevealed, currentQ, currentIndex, total, correctCount, totalScore, timeLeft, onComplete]);

    if (!currentQ) return null;

    const timerColor = timeLeft > 10 ? '#00ff9d' : timeLeft > 5 ? '#fbbf24' : '#ef4444';
    const timerPercent = (timeLeft / 15) * 100;
    const labels = ['A', 'B', 'C', 'D'];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            backgroundColor: 'rgba(2, 6, 23, 0.97)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-rajdhani), sans-serif',
            padding: '0.75rem',
            overflow: 'auto',
        }}>
            {/* Feedback Animation */}
            <AnimatePresence>
                {showFeedback && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 0.4 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 3100,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.5 }}
                            style={{
                                fontSize: '5rem',
                                filter: showFeedback === 'correct'
                                    ? 'drop-shadow(0 0 40px rgba(0, 255, 157, 0.8))'
                                    : 'drop-shadow(0 0 40px rgba(239, 68, 68, 0.8))',
                            }}
                        >
                            {showFeedback === 'correct' ? '✅' : '❌'}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ maxWidth: '36rem', width: '100%' }}>
                {/* Header: Round + Progress + Timer */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '0.75rem',
                }}>
                    <div style={{
                        fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.15em', color: '#2d6af2',
                        padding: '0.2rem 0.6rem', background: 'rgba(45,106,242,0.15)',
                        borderRadius: '0.4rem', border: '1px solid rgba(45,106,242,0.3)'
                    }}>
                        ROUND {roundNumber}
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                    }}>
                        <span style={{
                            fontSize: '1.5rem', fontWeight: 900, color: timerColor,
                            textShadow: `0 0 15px ${timerColor}60`,
                            minWidth: '2.5rem', textAlign: 'center',
                        }}>
                            {timeLeft}s
                        </span>
                        <span style={{
                            fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8',
                            letterSpacing: '0.1em', textTransform: 'uppercase'
                        }}>
                            {currentIndex + 1}/{total}
                        </span>
                    </div>
                </div>

                {/* Timer Bar */}
                <div style={{
                    width: '100%', height: '3px', backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: '9999px', marginBottom: '1rem', overflow: 'hidden'
                }}>
                    <div
                        style={{
                            height: '100%', backgroundColor: timerColor, borderRadius: '9999px',
                            width: `${timerPercent}%`,
                            transition: 'width 0.5s linear, background-color 0.3s',
                        }}
                    />
                </div>

                {/* Question Card */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(45, 106, 242, 0.3)',
                            borderRadius: '1rem',
                            padding: '1.25rem 1.5rem',
                            marginBottom: '0.75rem',
                            boxShadow: '0 0 30px rgba(45, 106, 242, 0.08)'
                        }}
                    >
                        <p style={{
                            fontSize: 'clamp(0.9rem, 3.5vw, 1.2rem)', fontWeight: 700, color: 'white',
                            lineHeight: 1.5, textAlign: 'center', margin: 0,
                        }}>
                            {currentQ.question}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Answer Options - 2x2 grid, responsive */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: currentQ.options.length <= 2 ? '1fr' : '1fr 1fr',
                    gap: '0.5rem',
                }}>
                    {currentQ.options.map((option, idx) => {
                        const isSelected = selectedAnswer === idx;
                        const isCorrectAnswer = idx === currentQ.correctAnswer;
                        const isWrongSelected = isRevealed && isSelected && !isCorrectAnswer;
                        const showCorrect = isRevealed && isCorrectAnswer;

                        let bgColor = 'rgba(15, 23, 42, 0.8)';
                        let borderColor = 'rgba(45, 106, 242, 0.25)';
                        let textColor = 'white';
                        let shadow = 'none';

                        if (showCorrect) {
                            bgColor = 'rgba(0, 255, 157, 0.15)';
                            borderColor = '#00ff9d';
                            shadow = '0 0 20px rgba(0, 255, 157, 0.3)';
                        } else if (isWrongSelected) {
                            bgColor = 'rgba(239, 68, 68, 0.15)';
                            borderColor = '#ef4444';
                            shadow = '0 0 20px rgba(239, 68, 68, 0.3)';
                        } else if (isSelected) {
                            bgColor = 'rgba(45, 106, 242, 0.2)';
                            borderColor = '#2d6af2';
                        }

                        return (
                            <motion.button
                                key={idx}
                                whileHover={!isRevealed ? { scale: 1.02 } : {}}
                                whileTap={!isRevealed ? { scale: 0.96 } : {}}
                                onClick={() => !isRevealed && handleReveal(idx)}
                                disabled={isRevealed}
                                style={{
                                    background: bgColor,
                                    border: `2px solid ${borderColor}`,
                                    borderRadius: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    textAlign: 'left',
                                    cursor: isRevealed ? 'default' : 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: shadow,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    color: textColor,
                                    minHeight: '3rem',
                                }}
                            >
                                <span style={{
                                    width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.8rem', fontWeight: 900,
                                    backgroundColor: showCorrect ? '#00ff9d' : isWrongSelected ? '#ef4444' : 'rgba(45,106,242,0.2)',
                                    color: showCorrect || isWrongSelected ? 'black' : '#2d6af2',
                                    flexShrink: 0,
                                }}>
                                    {showCorrect ? '✓' : isWrongSelected ? '✗' : labels[idx]}
                                </span>
                                <span style={{
                                    fontSize: 'clamp(0.8rem, 3vw, 0.95rem)', fontWeight: 600,
                                    wordBreak: 'break-word',
                                }}>
                                    {option}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Score Display */}
                <div style={{
                    textAlign: 'center', marginTop: '0.75rem',
                    fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8',
                    letterSpacing: '0.15em', textTransform: 'uppercase'
                }}>
                    SCORE: <span style={{ color: '#00ff9d', fontSize: '0.85rem' }}>{totalScore}</span>
                    <span style={{ margin: '0 0.5rem', color: 'rgba(148,163,184,0.3)' }}>|</span>
                    CORRECT: <span style={{ color: '#2d6af2', fontSize: '0.85rem' }}>{correctCount}/{currentIndex + (isRevealed ? 1 : 0)}</span>
                </div>
            </div>
        </div>
    );
}
