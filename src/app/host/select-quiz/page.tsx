"use client";

import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowLeft, HelpCircle, Heart, User, Play, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { QuizCategory } from "@/types";
import { supabaseCentral } from "@/lib/supabase";
import { Logo } from "@/components/ui/logo";
import Image from "next/image";
import { getUser } from "@/lib/storage";
import { useTranslation } from "react-i18next";

interface QuizView {
    id: string;
    title: string;
    category: string;
    questionCount: number;
    description: string;
    imageUrl?: string;
    played?: number;
    creatorId?: string;
    isPublic: boolean;
}

// ── Category color map (Opsi A: top bar + badge) ──
const categoryColorMap: Record<string, {
    bar: string;        // top bar bg color
    badge: string;      // badge bg
    badgeBorder: string;
    badgeText: string;
    hoverBorder: string;
}> = {
    // known English keys
    general:    { bar:'#1a5f5f', badge:'rgba(26,95,95,0.22)',    badgeBorder:'rgba(38,166,154,0.4)',  badgeText:'#4db6ac', hoverBorder:'rgba(26,95,95,0.7)' },
    math:       { bar:'#00c853', badge:'rgba(0,200,83,0.15)',    badgeBorder:'rgba(0,230,118,0.35)',  badgeText:'#00e676', hoverBorder:'rgba(0,200,83,0.6)' },
    history:    { bar:'#e91e8c', badge:'rgba(233,30,140,0.15)',  badgeBorder:'rgba(240,98,146,0.35)', badgeText:'#f06292', hoverBorder:'rgba(233,30,140,0.6)' },
    science:    { bar:'#7c3aed', badge:'rgba(124,58,237,0.18)',  badgeBorder:'rgba(167,139,250,0.35)',badgeText:'#a78bfa', hoverBorder:'rgba(124,58,237,0.6)' },
    geography:  { bar:'#1a9e6e', badge:'rgba(26,158,110,0.18)', badgeBorder:'rgba(52,211,153,0.35)', badgeText:'#34d399', hoverBorder:'rgba(26,158,110,0.6)' },
    language:   { bar:'#f59e0b', badge:'rgba(245,158,11,0.15)', badgeBorder:'rgba(251,191,36,0.35)', badgeText:'#fbbf24', hoverBorder:'rgba(245,158,11,0.6)' },
    sport:      { bar:'#ef4444', badge:'rgba(239,68,68,0.15)',   badgeBorder:'rgba(252,165,165,0.35)',badgeText:'#fca5a5', hoverBorder:'rgba(239,68,68,0.6)' },
    technology: { bar:'#2d6af2', badge:'rgba(45,106,242,0.18)', badgeBorder:'rgba(100,181,246,0.35)',badgeText:'#64b5f6', hoverBorder:'rgba(45,106,242,0.6)' },
    art:        { bar:'#d946ef', badge:'rgba(217,70,239,0.15)',  badgeBorder:'rgba(240,171,252,0.35)',badgeText:'#f0abfc', hoverBorder:'rgba(217,70,239,0.6)' },
    music:      { bar:'#ec4899', badge:'rgba(236,72,153,0.15)',  badgeBorder:'rgba(249,168,212,0.35)',badgeText:'#f9a8d4', hoverBorder:'rgba(236,72,153,0.6)' },
    // common Indonesian keys
    umum:       { bar:'#1a5f5f', badge:'rgba(26,95,95,0.22)',    badgeBorder:'rgba(38,166,154,0.4)',  badgeText:'#4db6ac', hoverBorder:'rgba(26,95,95,0.7)' },
    matematika: { bar:'#00c853', badge:'rgba(0,200,83,0.15)',    badgeBorder:'rgba(0,230,118,0.35)',  badgeText:'#00e676', hoverBorder:'rgba(0,200,83,0.6)' },
    sejarah:    { bar:'#e91e8c', badge:'rgba(233,30,140,0.15)',  badgeBorder:'rgba(240,98,146,0.35)', badgeText:'#f06292', hoverBorder:'rgba(233,30,140,0.6)' },
    ipa:        { bar:'#7c3aed', badge:'rgba(124,58,237,0.18)',  badgeBorder:'rgba(167,139,250,0.35)',badgeText:'#a78bfa', hoverBorder:'rgba(124,58,237,0.6)' },
    ips:        { bar:'#1a9e6e', badge:'rgba(26,158,110,0.18)', badgeBorder:'rgba(52,211,153,0.35)', badgeText:'#34d399', hoverBorder:'rgba(26,158,110,0.6)' },
    bahasa:     { bar:'#f59e0b', badge:'rgba(245,158,11,0.15)', badgeBorder:'rgba(251,191,36,0.35)', badgeText:'#fbbf24', hoverBorder:'rgba(245,158,11,0.6)' },
    olahraga:   { bar:'#ef4444', badge:'rgba(239,68,68,0.15)',   badgeBorder:'rgba(252,165,165,0.35)',badgeText:'#fca5a5', hoverBorder:'rgba(239,68,68,0.6)' },
    teknologi:  { bar:'#2d6af2', badge:'rgba(45,106,242,0.18)', badgeBorder:'rgba(100,181,246,0.35)',badgeText:'#64b5f6', hoverBorder:'rgba(45,106,242,0.6)' },
};

// Fallback color for unknown categories — deterministic by string hash
const fallbackColors = [
    { bar:'#1a5f5f', badge:'rgba(26,95,95,0.22)',    badgeBorder:'rgba(38,166,154,0.4)',  badgeText:'#4db6ac', hoverBorder:'rgba(26,95,95,0.7)' },
    { bar:'#7c3aed', badge:'rgba(124,58,237,0.18)',  badgeBorder:'rgba(167,139,250,0.35)',badgeText:'#a78bfa', hoverBorder:'rgba(124,58,237,0.6)' },
    { bar:'#f59e0b', badge:'rgba(245,158,11,0.15)',  badgeBorder:'rgba(251,191,36,0.35)', badgeText:'#fbbf24', hoverBorder:'rgba(245,158,11,0.6)' },
    { bar:'#00c853', badge:'rgba(0,200,83,0.15)',    badgeBorder:'rgba(0,230,118,0.35)',  badgeText:'#00e676', hoverBorder:'rgba(0,200,83,0.6)' },
    { bar:'#e91e8c', badge:'rgba(233,30,140,0.15)',  badgeBorder:'rgba(240,98,146,0.35)', badgeText:'#f06292', hoverBorder:'rgba(233,30,140,0.6)' },
    { bar:'#1a9e6e', badge:'rgba(26,158,110,0.18)',  badgeBorder:'rgba(52,211,153,0.35)', badgeText:'#34d399', hoverBorder:'rgba(26,158,110,0.6)' },
];

const getCategoryColor = (category: string) => {
    const key = category.toLowerCase().trim();
    if (categoryColorMap[key]) return categoryColorMap[key];
    // Hash-based fallback so same unknown category always gets same color
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
    return fallbackColors[hash % fallbackColors.length];
};

export default function SelectQuizPage() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [quizzes, setQuizzes] = useState<QuizView[]>([]);
    const [allItems, setAllItems] = useState<QuizView[]>([]);
    const [creating, setCreating] = useState(false);
    const [creatingQuizId, setCreatingQuizId] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'myquiz'>('all');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUsername, setCurrentUsername] = useState<string | null>(null);
    const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(true);
    const [isReturning, setIsReturning] = useState(false);

    const itemsPerPage = 8;

    useEffect(() => {
        const user = getUser();
        if (user) {
            setCurrentUserId(user.id);
            setCurrentUsername(user.username);
            const fetchProfile = async () => {
                try {
                    if (user.id && user.id.includes('-') && user.id.length > 20) {
                        const { data } = await supabaseCentral.from('profiles').select('id, favorite_quiz').eq('auth_user_id', user.id).single();
                        if (data) {
                            setCurrentProfileId(data.id);
                            if (data.favorite_quiz && (data.favorite_quiz as any).favorites) {
                                setFavorites((data.favorite_quiz as any).favorites);
                            }
                        }
                    } else if (user.username) {
                        const { data } = await supabaseCentral.from('profiles').select('id, favorite_quiz').eq('username', user.username).single();
                        if (data) {
                            setCurrentProfileId(data.id);
                            if (data.favorite_quiz && (data.favorite_quiz as any).favorites) {
                                setFavorites((data.favorite_quiz as any).favorites);
                            }
                        }
                    }
                } catch (err) { console.error('Failed to map profile id', err); }
            };
            fetchProfile();
        }
    }, []);

    useEffect(() => {
        const savedFavorites = localStorage.getItem('quiz_favorites');
        if (savedFavorites) { try { setFavorites(JSON.parse(savedFavorites)); } catch { } }
    }, []);

    const toggleFavorite = async (quizId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        
        const isFav = favorites.includes(quizId);
        const newFavs = isFav ? favorites.filter(id => id !== quizId) : [...favorites, quizId];
        
        // 1. Update local state & localStorage immediately
        setFavorites(newFavs);
        localStorage.setItem('quiz_favorites', JSON.stringify(newFavs));

        // 2. Sync to Database profile
        if (currentProfileId) {
            try {
                const { error } = await supabaseCentral
                    .from('profiles')
                    .update({ 
                        favorite_quiz: { favorites: newFavs } 
                    })
                    .eq('id', currentProfileId);
                
                if (error) throw error;
            } catch (err) {
                console.error("Failed to sync favorites to profile database", err);
            }
        }
    };

    const fetchQuizzes = async () => {
        setIsFetching(true);
        try {
            const { data, error } = await supabaseCentral
                .from("quizzes").select("*").eq("is_hidden", false).eq("status", "active")
                .is("deleted_at", null).order("created_at", { ascending: false });
            if (error) { console.error("Error fetching quizzes:", error); return; }
            if (data) {
                const fetchedQuizzes: QuizView[] = data.map((quiz: any) => {
                    let qCount = 0;
                    if (Array.isArray(quiz.questions)) { qCount = quiz.questions.length; }
                    else if (typeof quiz.questions === 'string') { try { qCount = JSON.parse(quiz.questions).length; } catch (e) { } }
                    return {
                        id: quiz.id, title: quiz.title || "Untitled Quiz",
                        category: quiz.category || "umum", questionCount: qCount,
                        description: quiz.description || "No description provided.",
                        imageUrl: quiz.image_url || quiz.cover_image, played: quiz.played || 0,
                        creatorId: quiz.creator_id || quiz.user_id || null,
                        isPublic: quiz.is_public !== false,
                    };
                });
                setAllItems(fetchedQuizzes);
            }
        } catch (err) { console.error("Failed to fetch quizzes", err); }
        finally { setIsFetching(false); }
    };

    useEffect(() => { fetchQuizzes(); }, []);

    useEffect(() => {
        let filtered = allItems;
        
        // Visibility gate: What kuis are searchable/visible?
        // Must be PUBLIC OR owned by current user (check profile ID, auth ID, or username)
        filtered = filtered.filter(q => {
            const isOwner = (currentProfileId && q.creatorId === currentProfileId) || 
                            (currentUserId && (q.creatorId === currentUserId || q.creatorId === currentUsername));
            return q.isPublic || isOwner;
        });

        // Tab-specific filtering
        if (activeTab === 'favorites') {
            // Show only kuis that are in the user's favorite list
            filtered = filtered.filter(q => favorites.includes(q.id));
        } else if (activeTab === 'myquiz') {
            // Show only kuis owned by the user
            filtered = filtered.filter(q => 
                (currentProfileId && q.creatorId === currentProfileId) || 
                (currentUserId && (q.creatorId === currentUserId || q.creatorId === currentUsername))
            );
        }
        
        if (searchQuery) { 
            filtered = filtered.filter(q => 
                q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                q.description.toLowerCase().includes(searchQuery.toLowerCase())
            ); 
        }
        
        if (selectedCategory !== "All") { 
            filtered = filtered.filter(q => q.category.toLowerCase() === selectedCategory.toLowerCase()); 
        }
        
        setQuizzes(filtered);
        setCurrentPage(1);
    }, [allItems, searchQuery, selectedCategory, activeTab, favorites, currentUserId, currentUsername, currentProfileId]);

    const paginatedQuizzes = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return quizzes.slice(start, start + itemsPerPage);
    }, [quizzes, currentPage]);

    const totalPages = Math.ceil(quizzes.length / itemsPerPage);

    const categories = useMemo(() => {
        const uniqueCategories = Array.from(new Set(allItems.map(q => q.category)));
        return ["All", ...uniqueCategories];
    }, [allItems]);

    const getCategoryDisplayName = (cat: string): string => {
        if (cat === 'All') return t('select_quiz.all_categories');
        
        const key = cat.toLowerCase().trim();
        if (i18n.exists(`categories.${key}`)) {
            return t(`categories.${key}`);
        }

        // Auto-format the string (e.g. "bahasa-inggris" -> "Bahasa Inggris")
        return cat.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const handleSelectQuiz = async (quizId: string) => {
        if (creating) return;
        setCreating(true);
        setCreatingQuizId(quizId);
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockGamePin = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem("currentQuizId", quizId);
        router.push(`/host/${mockGamePin}/settings`);
    };

    return (
        <div className="h-screen bg-[#04060f] relative overflow-hidden font-body text-white selection:bg-[#2d6af2] selection:text-white flex flex-col">
            <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(0,255,157,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.022)_1px,transparent_1px)] bg-[length:80px_80px]" />
            <div className="fixed bottom-0 left-0 right-0 h-52 z-0 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px)] bg-[length:80px_40px] [transform:perspective(400px)_rotateX(60deg)] origin-bottom pointer-events-none opacity-60" />
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(45,106,242,0.07),transparent)] pointer-events-none" />
            <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#04060f] via-[#04060f]/50 to-[#2d6af2]/10 pointer-events-none" />
            <div className="scanlines" />

            <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Bar */}
                <div className="w-full px-4 md:px-6 pt-2 pb-0 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Logo width={100} height={30} withText={false} animated={false} />
                    </div>
                    <Image src="/assets/logo/logo2.png" alt="NitroQuiz" width={150} height={38}
                        className="object-contain opacity-70 hover:opacity-100 transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(169,141,197,0.4)]" />
                </div>

                <div className="flex-1 overflow-y-auto relative w-full pt-0.5">
                    <div className="container mx-auto px-6 pb-8 max-w-6xl">
                        {/* Search & Filter Bar */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                            className="max-w-4xl mx-auto w-full bg-[#080d1a]/80 border border-[#2d6af2]/30 rounded-2xl overflow-hidden mb-3 backdrop-blur-2xl shadow-[0_0_50px_rgba(45,106,242,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] flex-shrink-0">
                            {/* ── Cyan accent bar ── */}
                            <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg,#1a45c4,#2d6af2,#00ff9d,#2d6af2,#1a45c4)' }} />
                            <div className="p-2 sm:p-3">
                            <div className="flex flex-col sm:flex-row gap-3 mb-3 relative">
                                <div className="flex-1">
                                    <div className="relative group/search">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within/search:text-[#00ff9d] transition-colors" />
                                        <Input type="text" placeholder={t('select_quiz.search_placeholder')} value={searchInput}
                                            onChange={(e) => { setSearchInput(e.target.value); setSearchQuery(e.target.value); setCurrentPage(1); }}
                                            className="w-full bg-white/[0.03] border border-white/[0.07] pl-9 h-10 sm:h-9 text-white font-display text-left text-[9px] sm:text-[10px] uppercase tracking-widest placeholder:text-[8px] sm:placeholder:text-gray-600 rounded-lg focus-visible:ring-1 focus-visible:ring-[#00ff9d]/50 focus-visible:border-[#00ff9d]/50 focus-visible:bg-white/[0.05] transition-all !py-0 leading-normal" />
                                    </div>
                                </div>
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger className="w-full sm:w-52 h-10 bg-white/[0.03] border border-white/[0.07] text-white focus:border-[#00ff9d]/50 focus:ring-1 focus:ring-[#00ff9d]/50 rounded-xl font-display text-xs tracking-wider uppercase">
                                        <SelectValue placeholder={t('select_quiz.category_placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#04060f] border border-[#2d6af2]/30 text-white font-display text-[10px] uppercase tracking-wider backdrop-blur-3xl">
                                        {categories.map((cat) => (
                                            <SelectItem key={cat} value={cat} className="focus:bg-[#4a3d8f]/20 focus:text-white cursor-pointer py-1.5">
                                                {getCategoryDisplayName(cat)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 w-full relative">
                                <button onClick={() => setActiveTab('all')}
                                    className={`flex items-center justify-center flex-1 sm:flex-none min-w-max gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-display text-[8px] sm:text-xs tracking-wider uppercase transition-all duration-200 ${activeTab === 'all' ? 'bg-[#2d6af2] text-white' : 'bg-white/[0.03] border border-white/[0.07] text-gray-400 hover:text-white hover:border-[#00ff9d]/50'}`}>
                                    <Search size={12} className="sm:w-3.5 sm:h-3.5" />{t('select_quiz.tabs.quizzes')}
                                </button>
                                <button onClick={() => setActiveTab('favorites')}
                                    className={`flex items-center justify-center flex-1 sm:flex-none min-w-max gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-display text-[8px] sm:text-xs tracking-wider uppercase transition-all duration-200 ${activeTab === 'favorites' ? 'bg-gradient-to-r from-pink-600 to-red-500 text-white' : 'bg-black/40 border border-pink-500/20 text-gray-400 hover:text-pink-400 hover:border-pink-500/50'}`}>
                                    <Heart size={12} className={`sm:w-3.5 sm:h-3.5 ${activeTab === 'favorites' ? 'fill-white' : ''}`} />
                                    {t('select_quiz.tabs.favorites')}
                                </button>
                                <button onClick={() => setActiveTab('myquiz')}
                                    className={`flex items-center justify-center flex-1 sm:flex-none min-w-max gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-display text-[8px] sm:text-xs tracking-wider uppercase transition-all duration-200 ${activeTab === 'myquiz' ? 'bg-[#00ff9d] text-[#04060f] font-bold' : 'bg-white/[0.03] border border-white/[0.07] text-gray-400 hover:text-[#00ff9d] hover:border-[#00ff9d]/50'}`}>
                                    <FileText size={12} className="sm:w-3.5 sm:h-3.5" />{t('select_quiz.tabs.my_quiz')}
                                </button>
                            </div>
                            </div>
                        </motion.div>

                        {/* Grid */}
                        <AnimatePresence mode="wait">
                            {(isFetching || isReturning || creating) ? (
                                <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="bg-[#080d1a]/80 border border-[#2d6af2]/15 rounded-xl overflow-hidden animate-pulse">
                                            <div className="h-1 w-full bg-[#2d6af2]/10" />
                                            <div className="w-full h-24 bg-gradient-to-br from-[#2d6af2]/10 to-[#04060f]" />
                                            <div className="p-2 space-y-1.5">
                                                <div className="h-3 bg-white/5 rounded w-3/4" />
                                                <div className="h-2 bg-white/5 rounded w-1/2" />
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            ) : paginatedQuizzes.length > 0 ? (
                                <motion.div key={`grid-${currentPage}-${activeTab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {paginatedQuizzes.map((quiz, index) => {
                                        const isFavorited = favorites.includes(quiz.id);
                                        const colors = getCategoryColor(quiz.category);

                                        return (
                                            <motion.div key={quiz.id}
                                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.2 }} whileHover={{ scale: 1.01 }}
                                                style={{ willChange: "transform, opacity" }}>
                                                <Card className="h-full flex flex-col bg-black/40 border transition-all duration-200 relative overflow-hidden group rounded-xl"
                                                    style={{
                                                        borderColor: 'rgba(74,61,143,0.3)',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.borderColor = colors.hoverBorder)}
                                                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(74,61,143,0.3)')}
                                                >
                                                    {/* ── Opsi A: color bar 5px top ── */}
                                                    <div className="absolute top-0 inset-x-0 h-[4px] z-20 pointer-events-none"
                                                        style={{ background: colors.bar }} />

                                                    {/* bottom glow line */}
                                                    <div className="absolute inset-x-0 bottom-0 h-px pointer-events-none z-10 transition-opacity opacity-0 group-hover:opacity-100"
                                                        style={{ background: `linear-gradient(to right, transparent, ${colors.bar}, transparent)` }} />

                                                    {/* hover gradient overlay */}
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                                                        style={{ background: `linear-gradient(135deg, ${colors.badge} 0%, transparent 60%)` }} />

                                                    {/* Quiz background image */}
                                                    <div className="absolute inset-0 z-0 pointer-events-none">
                                                        {quiz.imageUrl && (
                                                            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                                                                style={{ backgroundImage: `url(${quiz.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                                                        )}
                                                        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-black/80" />
                                                    </div>

                                                    {/* Favorite button */}
                                                    <button onClick={(e) => toggleFavorite(quiz.id, e)}
                                                        className={`absolute top-4 right-3 z-30 p-2 rounded-full transition-all duration-200 backdrop-blur-sm ${isFavorited ? 'bg-pink-500/30 border border-pink-500/50 text-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.4)] hover:bg-pink-500/50' : 'bg-black/50 border border-white/10 text-gray-500 hover:text-pink-400 hover:border-pink-500/30 hover:bg-pink-500/10'}`}>
                                                        <Heart size={14} className={isFavorited ? 'fill-pink-400' : ''} />
                                                    </button>

                                                    <CardHeader className="pb-1.5 relative z-20 flex-1 flex flex-col pt-2">
                                                        {/* ── Category badge with category color ── */}
                                                        <div className="flex items-start mb-1 pr-10">
                                                            <div className="px-1.5 py-[1px] rounded text-[7px] font-display font-bold uppercase tracking-wider backdrop-blur-sm shadow-sm"
                                                                style={{
                                                                    background: colors.badge,
                                                                    border: `1px solid ${colors.badgeBorder}`,
                                                                    color: colors.badgeText,
                                                                }}>
                                                                {getCategoryDisplayName(quiz.category)}
                                                            </div>
                                                        </div>
                                                        <CardTitle className="text-xs text-white font-display uppercase tracking-wide leading-tight transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-1"
                                                            style={{ color: '#fff' }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = colors.badgeText)}
                                                            onMouseLeave={e => (e.currentTarget.style.color = '#fff')}
                                                            title={quiz.title}>
                                                            {quiz.title}
                                                        </CardTitle>
                                                        <div className="text-[9px] text-gray-400 font-body line-clamp-1 mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex-1" title={quiz.description}>
                                                            {quiz.description}
                                                        </div>
                                                    </CardHeader>
                                                    <CardFooter className="mt-auto !pt-2 !pb-2 px-3 border-t border-white/5 flex justify-between items-center text-[8px] text-gray-400 font-display tracking-wider relative z-20 bg-black/40 backdrop-blur-sm">
                                                        <div className="flex items-center gap-4 drop-shadow-md">
                                                            <div className="flex items-center gap-1.5">
                                                                <HelpCircle size={14} style={{ color: colors.bar }} />
                                                                {quiz.questionCount} Qs
                                                            </div>
                                                            {quiz.played !== undefined && (
                                                                <div className="flex items-center gap-1.5" style={{ color: colors.badgeText, opacity: 0.7 }}>
                                                                    <User size={14} />
                                                                    {quiz.played}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSelectQuiz(quiz.id); }}
                                                            disabled={creating}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-white font-display text-[9px] tracking-widest uppercase rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${colors.bar}, ${colors.badgeText})`,
                                                                boxShadow: `0 0 12px ${colors.badge}`,
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 22px ${colors.badgeBorder}`)}
                                                            onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 12px ${colors.badge}`)}>
                                                            <Play size={12} className="fill-white" />
                                                            {t('select_quiz.start_button')}
                                                        </button>
                                                    </CardFooter>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            ) : (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="col-span-full py-20 text-center">
                                    {activeTab === 'favorites' ? (
                                        <>
                                            <Heart className="h-16 w-16 mx-auto text-pink-500/20 mb-4" />
                                            <h3 className="text-xl text-white font-display uppercase tracking-widest mb-2">{t('select_quiz.empty_states.favorites_title')}</h3>
                                            <p className="text-pink-400/40 text-sm mb-6">{t('select_quiz.empty_states.favorites_desc')}</p>
                                            <Button variant="outline" onClick={() => setActiveTab('all')} className="bg-pink-500/10 border border-pink-500/50 text-pink-400 hover:bg-pink-500 hover:text-white transition-all font-display text-xs uppercase tracking-wider">{t('select_quiz.empty_states.browse_quizzes')}</Button>
                                        </>
                                    ) : activeTab === 'myquiz' ? (
                                        <>
                                            <FileText className="h-16 w-16 mx-auto text-[#00ff9d]/20 mb-4" />
                                            <h3 className="text-xl text-white font-display uppercase tracking-widest mb-2">{t('select_quiz.empty_states.myquiz_title')}</h3>
                                            <p className="text-[#00ff9d]/40 text-sm mb-6">{t('select_quiz.empty_states.myquiz_desc')}</p>
                                            <div className="flex justify-center gap-4">
                                                <Button variant="outline" onClick={fetchQuizzes} className="bg-white/[0.03] border border-[#00ff9d]/50 text-[#00ff9d] hover:bg-[#00ff9d]/20 transition-all font-display text-xs uppercase tracking-wider"><RefreshCw className="w-4 h-4 mr-2" />{t('select_quiz.empty_states.refresh')}</Button>
                                                <Button variant="outline" onClick={() => setActiveTab('all')} className="bg-[#00ff9d]/10 border border-[#00ff9d]/50 text-[#00ff9d] hover:bg-[#00ff9d] hover:text-[#04060f] transition-all font-display text-xs uppercase tracking-wider">{t('select_quiz.empty_states.browse_all')}</Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="h-16 w-16 mx-auto text-[#2d6af2]/20 mb-4" />
                                            <h3 className="text-xl text-white font-display uppercase tracking-widest mb-2">{t('select_quiz.empty_states.search_title')}</h3>
                                            <p className="text-[#2d6af2]/40 text-sm mb-6">{t('select_quiz.empty_states.search_desc')}</p>
                                            <Button variant="outline" onClick={() => { setSearchQuery(""); setSearchInput(""); setSelectedCategory("All"); }} className="bg-[#2d6af2]/10 border border-[#2d6af2]/50 text-[#2d6af2] hover:bg-[#2d6af2] hover:text-white transition-all font-display text-xs uppercase tracking-wider">{t('select_quiz.empty_states.reset_filters')}</Button>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center mt-6 mb-2 gap-2 flex-shrink-0">
                                <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || isFetching || creating || isReturning}
                                    className="h-8 px-3 bg-white/[0.03] border border-[#2d6af2]/30 text-white font-display text-[9px] disabled:opacity-30 hover:bg-[#2d6af2]/20 hover:border-[#00ff9d] transition-all uppercase tracking-wider">{t('select_quiz.pagination.prev')}</Button>
                                <div className="flex items-center px-4 bg-[#2d6af2]/15 border border-[#2d6af2]/30 rounded-md text-[#00ff9d] font-display text-[9px]">{t('select_quiz.pagination.page')} {currentPage} / {totalPages}</div>
                                <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || isFetching || creating || isReturning}
                                    className="h-8 px-3 bg-white/[0.03] border border-[#2d6af2]/30 text-white font-display text-[9px] disabled:opacity-30 hover:bg-[#2d6af2]/20 hover:border-[#00ff9d] transition-all uppercase tracking-wider">{t('select_quiz.pagination.next')}</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}