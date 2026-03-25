'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSelectedCharacter, saveGameSettings, saveQuizSession } from '@/lib/storage';
import { getRandomQuestions, categoryNames, categoryIcons } from '@/lib/questions';
import { Character, QuizCategory, GameSettings, QuizSession } from '@/types';

const timeOptions = [
    { label: '30 detik', value: 30 },
    { label: '1 menit', value: 60 },
    { label: '2 menit', value: 120 },
    { label: '3 menit', value: 180 },
];

const difficultyOptions = [
    { label: 'Mudah', value: 'easy' as const, color: 'from-emerald-500 to-teal-500', icon: '🌱' },
    { label: 'Sedang', value: 'medium' as const, color: 'from-amber-500 to-orange-500', icon: '⚡' },
    { label: 'Sulit', value: 'hard' as const, color: 'from-rose-500 to-pink-500', icon: '🔥' },
];

function GameSettingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const category = searchParams.get('category') as QuizCategory;

    const [character, setCharacter] = useState<Character | null>(null);
    const [selectedTime, setSelectedTime] = useState(60);
    const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [isStarting, setIsStarting] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);

    useEffect(() => {
        const savedCharacter = getSelectedCharacter();
        if (!savedCharacter || !category) {
            router.push('/home');
            return;
        }
        setCharacter(savedCharacter);
    }, [category, router]);

    const handleStart = () => {
        setIsStarting(true);
        setCountdown(3);

        // Save game settings
        const settings: GameSettings = {
            timeLimit: selectedTime,
            selectedCharacter: character,
            difficulty: selectedDifficulty,
        };
        saveGameSettings(settings);

        // Save difficulty to localStorage for quiz return flow
        localStorage.setItem('nitroquiz_game_difficulty', selectedDifficulty);

        // Generate quiz session
        const questions = getRandomQuestions(category, 5);
        const session: QuizSession = {
            id: `quiz-${Date.now()}`,
            category,
            questions,
            currentQuestionIndex: 0,
            answers: [],
            startTime: new Date().toISOString(),
            totalPoints: 0,
            status: 'in-progress',
        };
        saveQuizSession(session);

        // Save questions to localStorage for gamespeed → quiz flow
        localStorage.setItem('nitroquiz_game_questions', JSON.stringify(questions));
        localStorage.setItem('nitroquiz_game_questionIndex', '0');
        localStorage.setItem('nitroquiz_game_score', '0');

        // Countdown animation
        const countdownInterval = setInterval(() => {
            setCountdown((prev) => {
                if (prev === 1) {
                    clearInterval(countdownInterval);
                    return 0; // Set to 0 to indicate finish
                }
                return prev ? prev - 1 : null;
            });
        }, 1000);
    };

    // Handle navigation when countdown reaches 0 — go to game, not quiz
    useEffect(() => {
        if (countdown === 0) {
            const route = selectedDifficulty === 'medium' ? '/gamespeed-medium' : '/gamespeed';
            router.push(route);
        }
    }, [countdown, router, selectedDifficulty]);

    if (countdown !== null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#04060f] relative overflow-hidden font-display text-white">
                <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(0,255,157,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.022)_1px,transparent_1px)] bg-[length:80px_80px]" />
                <div className="absolute bottom-0 left-0 right-0 h-52 z-0 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px)] bg-[length:80px_40px] [transform:perspective(400px)_rotateX(60deg)] origin-bottom pointer-events-none opacity-60" />
                <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(45,106,242,0.07),transparent)] pointer-events-none" />
                <div className="text-center relative z-10">
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#1a45c4] via-[#2d6af2] to-[#00ff9d] flex items-center justify-center mx-auto mb-8 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_50px_rgba(45,106,242,0.6)] border-4 border-[#00ff9d]/30">
                        <span className="text-7xl font-bold font-display text-white drop-shadow-lg">{countdown}</span>
                    </div>
                    <h2 className="text-3xl font-bold text-white uppercase tracking-widest drop-shadow-[0_0_10px_rgba(45,106,242,0.5)]">Bersiap-siap...</h2>
                    <p className="text-[#00ff9d] mt-2 tracking-widest font-mono text-sm uppercase">Permainan akan segera dimulai</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-8 px-4 bg-[#04060f] relative overflow-hidden font-body text-white selection:bg-[#2d6af2] selection:text-white">
            <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(0,255,157,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.022)_1px,transparent_1px)] bg-[length:80px_80px]" />
            <div className="fixed bottom-0 left-0 right-0 h-52 z-0 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px)] bg-[length:80px_40px] [transform:perspective(400px)_rotateX(60deg)] origin-bottom pointer-events-none opacity-60" />
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(45,106,242,0.07),transparent)] pointer-events-none" />
            <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#04060f] via-[#04060f]/50 to-[#2d6af2]/10 pointer-events-none" />


            <div className="container mx-auto max-w-3xl relative z-10">
                {/* Header */}
                <div className="text-center mb-10 fade-in">
                    <button
                        onClick={() => router.back()}
                        className="absolute left-4 top-8 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#00ff9d]/50 hover:bg-white/5 transition-colors text-gray-400 hover:text-[#00ff9d]"
                    >
                        <span className="text-xl">←</span>
                    </button>

                    <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#2d6af2]/10 border border-[#2d6af2]/30 mb-6 shadow-[0_0_20px_rgba(45,106,242,0.2)]">
                        <span className="text-2xl">{categoryIcons[category]}</span>
                        <span className="font-semibold text-[#64b5f6] font-display tracking-widest uppercase">{categoryNames[category]}</span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
                        <span className="bg-gradient-to-r from-[#1a45c4] via-[#2d6af2] to-[#00ff9d] bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(45,106,242,0.4)] uppercase tracking-tight">
                            Pengaturan Permainan
                        </span>
                    </h1>
                </div>

                {/* Selected Character Preview */}
                <div className="bg-[#080d1a]/80 backdrop-blur-2xl border border-[#2d6af2]/30 shadow-[0_0_30px_rgba(45,106,242,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-8 flex items-center gap-6 slide-up">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a45c4] to-[#2d6af2] border border-[#64b5f6]/30 shadow-[0_0_15px_rgba(45,106,242,0.4)] flex items-center justify-center text-4xl">
                        🏎️
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-display font-bold text-white tracking-widest uppercase text-[#00ff9d]">{character?.name}</h3>
                        <p className="text-gray-400 font-mono text-xs uppercase mt-1">Karakter Terpilih</p>
                    </div>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 hover:border-[#00ff9d]/50 hover:text-[#00ff9d] text-sm transition-colors text-gray-300 font-display uppercase tracking-widest"
                    >
                        Ganti
                    </button>
                </div>

                {/* Time Selection */}
                <div className="bg-[#080d1a]/80 backdrop-blur-2xl border border-[#2d6af2]/30 shadow-[0_0_30px_rgba(45,106,242,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6 slide-up" style={{ animationDelay: '0.1s' }}>
                    <h3 className="text-lg font-display uppercase font-bold text-[#64b5f6] mb-4 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(100,181,246,0.3)]">
                        <span className="text-2xl">⏱️</span>
                        Waktu per Soal
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {timeOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedTime(option.value)}
                                className={`p-4 rounded-xl text-center transition-all border ${selectedTime === option.value
                                    ? 'bg-[#2d6af2]/20 border-[#00ff9d] text-[#00ff9d] shadow-[0_0_20px_rgba(0,255,157,0.3)]'
                                    : 'bg-white/[0.03] border-white/10 hover:border-[#2d6af2]/50 text-gray-400'
                                    }`}
                            >
                                <span className="text-xl font-display font-bold block mb-1">{option.value}</span>
                                <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Difficulty Selection */}
                <div className="bg-[#080d1a]/80 backdrop-blur-2xl border border-[#2d6af2]/30 shadow-[0_0_30px_rgba(45,106,242,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-8 slide-up" style={{ animationDelay: '0.2s' }}>
                    <h3 className="text-lg font-display uppercase font-bold text-[#64b5f6] mb-4 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(100,181,246,0.3)]">
                        <span className="text-2xl">🎯</span>
                        Tingkat Kesulitan
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        {difficultyOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedDifficulty(option.value)}
                                className={`p-5 rounded-xl border text-center transition-all ${selectedDifficulty === option.value
                                    ? `bg-[#00ff9d]/10 border-[#00ff9d] text-[#00ff9d] shadow-[0_0_20px_rgba(0,255,157,0.3)] scale-[1.02]`
                                    : 'bg-white/[0.03] border-white/10 hover:border-[#00ff9d]/30 text-gray-400'
                                    }`}
                            >
                                <span className="text-3xl block mb-2">{option.icon}</span>
                                <span className="font-display text-xs tracking-widest uppercase font-bold">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Game Rules */}
                <div className="bg-[#080d1a]/80 backdrop-blur-2xl border border-[#2d6af2]/30 shadow-[0_0_30px_rgba(45,106,242,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-8 slide-up" style={{ animationDelay: '0.3s' }}>
                    <h3 className="text-lg font-display uppercase font-bold text-[#64b5f6] mb-4 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(100,181,246,0.3)]">
                        <span className="text-2xl">📋</span>
                        Aturan Permainan
                    </h3>
                    <ul className="space-y-3 text-sm font-mono text-gray-300 tracking-wide">
                        <li className="flex items-start gap-3">
                            <span className="text-[#00ff9d]">✓</span>
                            <span>Jawab 5 soal quiz, dengan mini-game balapan di tengah</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#00ff9d]">✓</span>
                            <span>Setelah soal ke-3, kamu akan bermain balapan untuk bonus poin</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#00ff9d]">✓</span>
                            <span>Selesaikan 1 lap untuk mendapat bonus +200 poin</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-[#ff0055]">!</span>
                            <span>Game over jika nabrak penghalang atau keluar jalur</span>
                        </li>
                    </ul>
                </div>

                {/* Start Button */}
                <div className="text-center slide-up mb-12" style={{ animationDelay: '0.4s' }}>
                    <button
                        onClick={handleStart}
                        disabled={isStarting}
                        className="relative px-16 py-6 font-display text-sm tracking-[0.2em] font-bold text-white uppercase overflow-hidden group transition-all active:scale-[0.98] rounded-xl border-none disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(45,106,242,0.6)]"
                        style={{ background: 'linear-gradient(135deg, #1a45c4, #2d6af2, #1a45c4)' }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <span className="relative flex items-center gap-3">
                            <span className="text-2xl">🚀</span>
                            MULAI PERMAINAN
                            <span className="text-2xl">🏁</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function GameSettingsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#04060f]">
                <div className="w-16 h-16 border-4 border-[#2d6af2]/30 border-t-[#00ff9d] rounded-full animate-[spin_1s_cubic-bezier(0.68,-0.55,0.265,1.55)_infinite]" />
            </div>
        }>
            <GameSettingsContent />
        </Suspense>
    );
}
