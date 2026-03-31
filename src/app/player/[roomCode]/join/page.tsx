'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getUser, saveUser } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { useTranslation } from "react-i18next";
import { Loader2, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function JoinPage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.roomCode as string;
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [needsNickname, setNeedsNickname] = useState(false);
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            setLoading(true);
            try {
                // Check if session exists and is active
                const { data: sessionData, error: sessionError } = await supabase
                    .from("sessions")
                    .select("id, status")
                    .eq("game_pin", roomCode)
                    .single();

                if (sessionError || !sessionData) {
                    setError("Room not found.");
                    setLoading(false);
                    return;
                }

                if (sessionData.status !== "waiting" && sessionData.status !== "active") {
                    setError("Game is already in progress or finished.");
                    setLoading(false);
                    return;
                }

                // Check local user
                const user = getUser();
                if (user && user.username) {
                    // Automatically redirect to waiting natively
                    router.push(`/player/${roomCode}/waiting`);
                } else {
                    setNeedsNickname(true);
                    setLoading(false);
                }
            } catch (err) {
                setError("Error verifying room");
                setLoading(false);
            }
        };

        checkStatus();
    }, [roomCode, router]);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) return;
        
        // Save temporary user and push to waiting
        saveUser({
            id: `guest_${Date.now()}`,
            username: nickname.trim(),
            email: '',
            avatar: '',
            totalPoints: 0,
            gamesPlayed: 0,
            createdAt: new Date().toISOString()
        });
        
        setLoading(true);
        router.push(`/player/${roomCode}/waiting`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#04060f] font-display text-white">
                <div className="text-center">
                    <div className="flex justify-center mb-6">
                        <Loader2 className="w-12 h-12 text-[#00ff9d] animate-spin" />
                    </div>
                    <p className="text-xl tracking-widest uppercase animate-pulse">JOINING ROOM...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#04060f] font-display text-white p-4">
                <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center">
                    <h2 className="text-2xl text-red-400 mb-4">{error}</h2>
                    <Button onClick={() => router.push('/')} className="w-full bg-white/10 hover:bg-white/20">Back to Home</Button>
                </div>
            </div>
        );
    }

    if (needsNickname) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#04060f] font-display text-white p-4">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#080d1a]/80 backdrop-blur-xl border border-[#2d6af2]/30 p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(45,106,242,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#00ff9d] via-[#2d6af2] to-[#ec4899]"></div>
                    <h1 className="text-3xl text-center mb-2 font-black tracking-wider">ENTER NICKNAME</h1>
                    <p className="text-center text-gray-400 mb-8 text-sm">You are joining room <span className="text-[#00ff9d]">{roomCode}</span></p>
                    
                    <form onSubmit={handleJoin} className="space-y-4">
                        <Input 
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Your Name..."
                            maxLength={15}
                            autoFocus
                            className="bg-black/50 border-[#2d6af2]/50 h-14 text-center text-2xl tracking-widest uppercase focus-visible:ring-[#00ff9d] focus-visible:border-[#00ff9d] text-white"
                        />
                        <Button type="submit" disabled={!nickname.trim()} className="w-full h-14 bg-[#2d6af2] hover:bg-[#1a45c4] text-white rounded-xl text-lg tracking-widest flex items-center justify-center gap-2 group transition-all">
                            JOIN GAME
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return null;
}
