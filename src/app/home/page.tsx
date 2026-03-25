'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, removeUser, getGameHistories } from '@/lib/storage';
import { User, GameHistory, QuizCategory } from '@/types';
import { categoryNames, categoryIcons } from '@/lib/questions';

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Trophy,
    Brain,
    Target,
    TrendingUp,
    Gamepad2,
    BarChart3,
    Flame,
    LogOut,
    ChevronRight,
    Star,
    Clock,
    Award,
    Users,
    Zap,
    BookOpen
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function HomePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [history, setHistory] = useState<GameHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [logoLoaded, setLogoLoaded] = useState(false);

    useEffect(() => {
        const currentUser = getUser();
        if (!currentUser) {
            router.push('/login');
            return;
        }
        setUser(currentUser);
        const gameHistories = getGameHistories();
        setHistory(gameHistories);
        setIsLoading(false);
    }, [router]);

    const handleLogout = () => {
        removeUser();
        router.push('/login');
    };

    const handleStartTryout = (category: QuizCategory) => {
        router.push(`/select-character?category=${category}`);
    };

    const categories: QuizCategory[] = [
        'matematika',
        'sejarah',
        'ipa',
        'bahasa-indonesia',
        'bahasa-inggris',
        'umum',
    ];

    if (isLoading || !logoLoaded) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#04060f] relative overflow-hidden font-display selection:bg-[#2d6af2] selection:text-white">
                <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(0,255,157,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.022)_1px,transparent_1px)] bg-[length:80px_80px]" />
                <div className="fixed bottom-0 left-0 right-0 h-52 z-0 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px)] bg-[length:80px_40px] [transform:perspective(400px)_rotateX(60deg)] origin-bottom pointer-events-none opacity-60" />
                <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(45,106,242,0.07),transparent)] pointer-events-none" />
                <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#04060f] via-[#04060f]/50 to-[#2d6af2]/10 pointer-events-none" />
                <div className="text-center space-y-6 flex flex-col items-center relative z-10">
                    <div className={logoLoaded ? "opacity-100" : "opacity-0"}>
                        <Logo width={280} height={80} animated={true} onLoad={() => setLogoLoaded(true)} />
                    </div>
                    {/* Fallback spinner if logo takes too long to load */}
                    {!logoLoaded && (
                        <div className="w-16 h-16 border-4 border-[#2d6af2]/30 border-t-[#00ff9d] shadow-[0_0_15px_rgba(0,255,157,0.5)] rounded-full animate-spin mx-auto absolute"></div>
                    )}
                    <div className="space-y-2 relative mt-16 font-display">
                        <h2 className="text-xl font-bold text-white tracking-widest uppercase drop-shadow-[0_0_10px_rgba(45,106,242,0.5)]">Loading Dashboard</h2>
                        <p className="text-[#00ff9d] text-sm tracking-widest font-mono uppercase">Preparing your racing stats...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    // Calculate stats
    const totalPoints = user.totalPoints || 0;
    const gamesPlayed = user.gamesPlayed || 0;
    const averageScore = history.length > 0
        ? Math.round(history.reduce((a, h) => a + h.totalPoints, 0) / history.length)
        : 0;
    const winRate = history.length > 0
        ? Math.round((history.filter(h => h.finalPosition === 1).length / history.length) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-[#04060f] relative overflow-hidden font-body text-white selection:bg-[#2d6af2] selection:text-white">
            <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(0,255,157,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.022)_1px,transparent_1px)] bg-[length:80px_80px]" />
            <div className="fixed bottom-0 left-0 right-0 h-52 z-0 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px)] bg-[length:80px_40px] [transform:perspective(400px)_rotateX(60deg)] origin-bottom pointer-events-none opacity-60" />
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(45,106,242,0.07),transparent)] pointer-events-none" />
            <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#04060f] via-[#04060f]/50 to-[#2d6af2]/10 pointer-events-none" />
            
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <Logo width={150} height={45} animated={false} withText={false} />
                            <div className="hidden sm:block border-l border-white/10 pl-3">
                                <p className="text-xs text-gray-400">Learning through racing</p>
                            </div>
                        </div>

                        {/* User Profile & Stats */}
                        <div className="flex items-center gap-6">
                            <div className="hidden md:flex items-center gap-4">
                                <div className="text-right">
                                    <p className="font-display font-bold tracking-widest uppercase text-white drop-shadow-[0_0_8px_rgba(45,106,242,0.5)]">{user?.username || 'GUEST'}</p>
                                    <p className="text-xs font-mono tracking-widest text-[#00ff9d] uppercase">Racer Level</p>
                                </div>
                                <Avatar className="h-10 w-10 border-2 border-[#00ff9d]/50 shadow-[0_0_15px_rgba(0,255,157,0.3)]">
                                    <AvatarFallback className="bg-gradient-to-br from-[#1a45c4] to-[#2d6af2] text-white font-display font-bold">
                                        {user?.username?.charAt(0).toUpperCase() || 'G'}
                                    </AvatarFallback>
                                </Avatar>
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                className="text-gray-400 hover:text-[#ff0055] hover:bg-[#ff0055]/10 hover:border-[#ff0055]/30 border border-transparent transition-colors rounded-xl"
                            >
                                <LogOut className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 space-y-8 relative z-10">
                {/* Welcome Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Welcome Card */}
                    <Card className="col-span-1 lg:col-span-2 border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                        <div className="h-[4px] w-full" style={{ background: 'linear-gradient(90deg,#1a45c4,#2d6af2,#00ff9d,#2d6af2,#1a45c4)' }} />
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold font-display uppercase tracking-widest text-white mb-2">
                                        Welcome back, <span className="bg-gradient-to-r from-[#1a45c4] via-[#2d6af2] to-[#00ff9d] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(45,106,242,0.3)]">{user?.username || 'GUEST'}</span>! 🏎️
                                    </h2>
                                    <p className="text-[#64b5f6]/80 font-mono text-sm tracking-wide">
                                        Ready for today's learning adventure? Choose a category and start racing!
                                    </p>
                                </div>
                                <Badge className="bg-[#2d6af2]/20 border border-[#00ff9d]/50 text-[#00ff9d] px-4 py-2 font-display uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,157,0.3)]">
                                    <Trophy className="w-4 h-4 mr-2" />
                                    {totalPoints} Total Points
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Performance Chart Mini */}
                    <Card className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display font-bold uppercase tracking-widest text-[#64b5f6]">Recent Performance</h3>
                                <TrendingUp className="w-5 h-5 text-[#00ff9d] drop-shadow-[0_0_8px_rgba(0,255,157,0.5)]" />
                            </div>
                            <div className="flex items-end justify-between h-24 gap-2">
                                {history.slice(0, 5).reverse().map((h, i) => {
                                    const height = Math.min(100, (h.totalPoints / 500) * 100);
                                    return (
                                        <div key={i} className="flex flex-col items-center flex-1 group relative">
                                            <div
                                                className="w-full rounded-t-lg bg-gradient-to-t from-[#1a45c4] to-[#00ff9d] transition-all duration-300 group-hover:opacity-100 opacity-80 shadow-[0_0_10px_rgba(0,255,157,0.3)]"
                                                style={{ height: `${Math.max(10, height)}%` }}
                                            />
                                            <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mt-2">
                                                {new Date(h.date).toLocaleDateString('en-US', { month: 'short' })}
                                            </div>
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#04060f] text-[#00ff9d] text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-[#00ff9d]/30 font-display shadow-[0_0_10px_rgba(0,255,157,0.2)]">
                                                {h.totalPoints} pts
                                            </div>
                                        </div>
                                    );
                                })}
                                {history.length < 5 && Array(5 - history.length).fill(0).map((_, i) => (
                                    <div key={`empty-${i}`} className="flex flex-col items-center flex-1">
                                        <div className="w-full h-2 bg-white/5 rounded-t-lg border border-white/10" />
                                        <div className="text-[10px] font-mono text-gray-600 mt-2">-</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15)] rounded-2xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <Trophy className="w-5 h-5 text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                                </div>
                                <div className="text-right">
                                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 font-mono tracking-widest border border-amber-500/30">
                                        +12%
                                    </Badge>
                                </div>
                            </div>
                            <h3 className="text-2xl font-display font-bold text-white mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{totalPoints}</h3>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[#64b5f6]">Total Points</p>
                        </CardContent>
                    </Card>

                    <Card className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15)] rounded-2xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-lg bg-[#2d6af2]/10 border border-[#2d6af2]/30">
                                    <Gamepad2 className="w-5 h-5 text-[#2d6af2] drop-shadow-[0_0_5px_rgba(45,106,242,0.5)]" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-display font-bold text-white mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{gamesPlayed}</h3>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[#64b5f6]">Games Played</p>
                        </CardContent>
                    </Card>

                    <Card className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15)] rounded-2xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-lg bg-[#00ff9d]/10 border border-[#00ff9d]/30">
                                    <BarChart3 className="w-5 h-5 text-[#00ff9d] drop-shadow-[0_0_5px_rgba(0,255,157,0.5)]" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-display font-bold text-white mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{averageScore}</h3>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[#64b5f6]">Average Score</p>
                        </CardContent>
                    </Card>

                    <Card className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15)] rounded-2xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/30">
                                    <Flame className="w-5 h-5 text-[#ff0055] drop-shadow-[0_0_5px_rgba(255,0,85,0.5)]" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-display font-bold text-white mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{winRate}%</h3>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-[#64b5f6]">Win Rate</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quiz Categories */}
                <div>
                    <div className="flex items-center justify-between mb-6 mt-8">
                        <div>
                            <h2 className="text-2xl font-bold font-display uppercase tracking-widest text-[#00ff9d] mb-2 drop-shadow-[0_0_8px_rgba(0,255,157,0.3)]">Choose Your Category</h2>
                            <p className="text-[#64b5f6]/80 font-mono text-xs uppercase tracking-wider">Select a subject and start your learning race</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-[#2d6af2] hover:text-[#00ff9d] hover:bg-[#00ff9d]/10 font-display uppercase tracking-widest text-xs">
                            View all <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.map((category) => {
                            const icon = categoryIcons[category];
                            const name = categoryNames[category];

                            return (
                                <Card
                                    key={category}
                                    className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl hover:border-[#00ff9d]/60 hover:shadow-[0_0_30px_rgba(0,255,157,0.2)] transition-all duration-300 cursor-pointer group rounded-2xl overflow-hidden"
                                    onClick={() => handleStartTryout(category)}
                                >
                                    <CardContent className="p-6 relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-[#1a45c4]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <div className="relative z-10">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="p-3 rounded-xl bg-[#2d6af2]/10 border border-[#2d6af2]/30 group-hover:bg-[#00ff9d]/10 group-hover:border-[#00ff9d]/50 group-hover:scale-110 shadow-[0_0_15px_rgba(45,106,242,0.2)] group-hover:shadow-[0_0_20px_rgba(0,255,157,0.3)] transition-all duration-300">
                                                    <div className="text-2xl">{icon}</div>
                                                </div>
                                                <Badge variant="outline" className="bg-[#1a45c4]/20 text-[#64b5f6] border-[#2d6af2]/30 font-mono text-[10px] uppercase tracking-widest">
                                                    5 Questions
                                                </Badge>
                                            </div>

                                            <h3 className="text-xl font-display font-bold uppercase tracking-widest text-white mb-2 group-hover:text-[#00ff9d] transition-colors">{name}</h3>
                                            <p className="text-gray-400 font-mono text-xs mb-4 uppercase tracking-wide opacity-80">
                                                Test your knowledge in {name.toLowerCase()} while racing against time
                                            </p>

                                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5 group-hover:border-[#00ff9d]/20 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <Star className="w-4 h-4 text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                                                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#64b5f6]">+100 pts per correct</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[#2d6af2] group-hover:text-[#00ff9d] transition-colors font-display uppercase tracking-widest text-xs font-bold">
                                                    <span className="text-sm font-medium">Start Race</span>
                                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Game History */}
                <div>
                    <div className="flex items-center justify-between mb-6 mt-8">
                        <div>
                            <h2 className="text-2xl font-bold font-display uppercase tracking-widest text-[#00ff9d] mb-2 drop-shadow-[0_0_8px_rgba(0,255,157,0.3)]">Recent Game History</h2>
                            <p className="text-[#64b5f6]/80 font-mono text-xs uppercase tracking-wider">Track your performance and improvements</p>
                        </div>
                        {history.length > 0 && (
                            <Button variant="ghost" size="sm" className="text-[#2d6af2] hover:text-[#00ff9d] hover:bg-[#00ff9d]/10 font-display uppercase tracking-widest text-xs">
                                View All <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        )}
                    </div>

                    {history.length === 0 ? (
                        <Card className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,106,242,0.15)] rounded-2xl">
                            <CardContent className="p-12 text-center">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#1a45c4]/20 border border-[#2d6af2]/40 shadow-[0_0_20px_rgba(45,106,242,0.3)] mb-6">
                                    <Trophy className="w-10 h-10 text-[#00ff9d] drop-shadow-[0_0_10px_rgba(0,255,157,0.5)]" />
                                </div>
                                <h3 className="text-xl font-display font-bold uppercase tracking-widest text-white mb-2">No Game History Yet</h3>
                                <p className="text-gray-400 font-mono text-sm uppercase mb-6">Start your first race to see your results here!</p>
                                <Button
                                    onClick={() => handleStartTryout('umum')}
                                    className="bg-gradient-to-r from-[#1a45c4] to-[#2d6af2] hover:from-[#2d6af2] hover:to-[#1a45c4] text-white border-none font-display text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(45,106,242,0.4)] transition-all rounded-xl h-12 px-8"
                                >
                                    <Zap className="w-4 h-4 mr-2" />
                                    Start Your First Race
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {history.slice(0, 5).map((game) => {
                                const icon = categoryIcons[game.category];
                                const name = categoryNames[game.category];

                                return (
                                    <Card key={game.id} className="border-[#2d6af2]/30 bg-[#080d1a]/80 backdrop-blur-2xl hover:bg-[#1a45c4]/20 hover:border-[#00ff9d]/50 transition-all duration-300 rounded-2xl">
                                        <CardContent className="p-6">
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                                    <div className="p-3 rounded-xl bg-[#2d6af2]/10 border border-[#2d6af2]/30 shadow-[0_0_15px_rgba(45,106,242,0.2)]">
                                                        <div className="text-xl">{icon}</div>
                                                    </div>
                                                    <div>
                                                        <h3 className="font-display font-bold uppercase tracking-widest text-white">{name}</h3>
                                                        <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                                                            {new Date(game.date).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                                                    <div className="text-right">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <Award className="w-4 h-4 text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                                                            <span className="text-xl font-display font-bold text-amber-300">{game.totalPoints}</span>
                                                        </div>
                                                        <p className="font-mono text-[10px] text-[#64b5f6] uppercase tracking-widest mt-0.5">Points</p>
                                                    </div>

                                                    <div className="hidden sm:block w-px h-8 bg-white/10" />

                                                    <div className="text-right">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <Target className="w-4 h-4 text-[#00ff9d] drop-shadow-[0_0_5px_rgba(0,255,157,0.5)]" />
                                                            <span className="text-xl font-display font-bold text-white">
                                                                {game.correctAnswers}/{game.totalQuestions}
                                                            </span>
                                                        </div>
                                                        <p className="font-mono text-[10px] text-[#64b5f6] uppercase tracking-widest mt-0.5">Correct</p>
                                                    </div>

                                                    <div className="hidden sm:block w-px h-8 bg-white/10" />

                                                    <div>
                                                        <Badge className={
                                                            game.finalPosition === 1
                                                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)] font-display text-sm px-3 py-1"
                                                                : game.finalPosition <= 3
                                                                    ? "bg-[#00ff9d]/20 text-[#00ff9d] border border-[#00ff9d]/50 shadow-[0_0_10px_rgba(0,255,157,0.3)] font-display text-sm px-3 py-1"
                                                                    : "bg-white/5 text-gray-400 border border-white/10 font-display text-sm px-3 py-1"
                                                        }>
                                                            #{game.finalPosition}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}