'use client';

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useParams } from 'next/navigation';
import { saveUser, getUser } from '@/lib/storage';
import { User } from '@/types';
import { useState, useEffect } from 'react';

import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const loginSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function PlayerLoginPage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.roomCode as string;

    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    useEffect(() => {
        const user = getUser();
        if (user) {
            router.push(`/player/${roomCode}/lobby`);
        }
    }, [roomCode, router]);

    const {
        register: registerLogin,
        handleSubmit: handleSubmitLogin,
        formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onLoginSubmit = async (data: LoginFormData) => {
        setServerError(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));

            const user: User = {
                id: `user-${Date.now()}`,
                username: data.username,
                email: `${data.username.toLowerCase()}@nitroquiz.com`,
                totalPoints: 0,
                gamesPlayed: 0,
                createdAt: new Date().toISOString(),
            };

            saveUser(user);
            router.push(`/player/${roomCode}/lobby`);
        } catch (error) {
            setServerError("Login failed. Please try again.");
        }
    };

    const handleGoogleLogin = () => {
        console.log("Google Login Clicked");
    };

    return (
        <div className="bg-[#0b101a] text-white min-h-screen relative overflow-hidden font-body selection:bg-[#2d6af2] selection:text-white flex flex-col items-center justify-center p-4">
            <div className="fixed inset-0 z-0 city-silhouette pointer-events-none"></div>
            <div className="fixed inset-0 z-0 bg-gradient-to-t from-[#0b101a] via-transparent to-blue-900/10 pointer-events-none"></div>
            <div className="fixed bottom-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0a101f]/50 to-[#0a101f] pointer-events-none z-0"></div>
            <div className="fixed bottom-0 w-full h-1/2 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.1)_1px,transparent_1px)] bg-[length:60px_60px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom z-0 pointer-events-none opacity-20"></div>
            <div className="scanlines"></div>

            <div className="relative z-20 w-full max-w-md mt-[-50px] flex flex-col items-center">
                <div className="text-center mb-6">
                    <p className="text-[#00ff9d] text-sm tracking-widest font-display animate-pulse uppercase mb-4">Join Room: {roomCode}</p>
                    <Logo width={280} height={80} animated={true} withText={false} />
                </div>

                <div className="join-card rounded-[2rem] p-8 md:p-10 shadow-[0_0_25px_rgba(45,106,242,0.25)_inset,0_0_25px_rgba(45,106,242,0.5)] relative overflow-hidden bg-[linear-gradient(160deg,rgba(45,106,242,0.05)_0%,rgba(10,16,31,0.9)_100%)] border border-[#2d6af2]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#2d6af2]/20 to-transparent rounded-bl-full pointer-events-none"></div>

                    <CardContent className="p-0">
                        <div className="text-center mb-8">
                            <h1 className="font-body font-bold text-xl text-white mb-2 tracking-wide glow-text uppercase">
                                LOGIN TO RACE
                            </h1>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full h-12 border-[#2d6af2]/30 bg-black/40 hover:bg-[#2d6af2]/10 text-white font-display text-xs rounded-xl transition-all uppercase tracking-wider mb-6 flex items-center justify-center gap-2"
                            onClick={handleGoogleLogin}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </Button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#2d6af2]/30 shadow-[0_0_5px_rgba(45,106,242,0.5)]" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-4 bg-[#0a101f] text-white text-[10px] font-display uppercase tracking-widest border border-[#2d6af2]/30 rounded-full py-1 shadow-[0_0_10px_rgba(45,106,242,0.3)]">
                                    OR
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitLogin(onLoginSubmit)} className="space-y-4">
                            {serverError && (
                                <Alert className="bg-red-500/10 border-red-500/30 p-3 mb-4 rounded-xl">
                                    <AlertDescription className="text-red-400 text-xs font-body tracking-wide">
                                        {serverError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-4">
                                <div className="relative group/input">
                                    <Input
                                        type="text"
                                        placeholder="Username / ID"
                                        className="w-full h-12 bg-white text-black font-display text-sm px-4 rounded-xl focus:outline-none focus:border-[#2d6af2] focus:ring-1 focus:ring-[#2d6af2] transition-all placeholder:font-body placeholder:text-gray-500 shadow-inner"
                                        {...registerLogin("username")}
                                    />
                                </div>
                                {loginErrors.username && (
                                    <p className="text-[10px] text-red-400 font-display uppercase tracking-wider pl-1">{loginErrors.username.message}</p>
                                )}

                                <div className="relative group/input">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password..."
                                        className="w-full h-12 bg-white text-black font-display text-sm px-4 rounded-xl focus:outline-none focus:border-[#2d6af2] focus:ring-1 focus:ring-[#2d6af2] transition-all placeholder:font-body placeholder:text-gray-500 shadow-inner pr-10"
                                        {...registerLogin("password")}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {loginErrors.password && (
                                    <p className="text-[10px] text-red-400 font-display uppercase tracking-wider pl-1">{loginErrors.password.message}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 mt-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-display text-sm rounded-xl shadow-[0_0_20px_rgba(45,106,242,0.4)] hover:shadow-[0_0_30px_rgba(45,106,242,0.6)] transition-all duration-300 uppercase tracking-wider transform active:scale-[0.98] border border-blue-400/30"
                                disabled={isLoginSubmitting}
                            >
                                {isLoginSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        AUTHING...
                                    </>
                                ) : "START ENGINE"}
                            </Button>
                        </form>
                    </CardContent>
                </div>
            </div>
        </div>
    );
}
