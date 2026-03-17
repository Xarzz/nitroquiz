'use client';

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from 'next/navigation';
import { saveUser } from '@/lib/storage';
import { User } from '@/types';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Check, ChevronRight, Zap } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const registerSchema = z.object({
    username: z.string()
        .min(3, "Min. 3 karakter")
        .max(20, "Maks. 20 karakter")
        .regex(/^[a-zA-Z0-9_]+$/, "Hanya huruf, angka, dan underscore"),
    email: z.string().email("Format email tidak valid"),
    password: z.string().min(8, "Min. 8 karakter"),
    confirm: z.string().min(1, "Konfirmasi password wajib"),
}).refine(d => d.password === d.confirm, {
    message: "Password tidak cocok",
    path: ["confirm"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

function PasswordStrength({ value }: { value: string }) {
    const checks = [
        { label: "Min. 8 karakter", pass: value.length >= 8 },
        { label: "Huruf besar", pass: /[A-Z]/.test(value) },
        { label: "Angka", pass: /\d/.test(value) },
        { label: "Karakter spesial", pass: /[^a-zA-Z0-9]/.test(value) },
    ];
    const strength = checks.filter(c => c.pass).length;

    const color = strength <= 1 ? '#ef4444' : strength === 2 ? '#f59e0b' : strength === 3 ? '#3b82f6' : '#00ff9d';
    const label = strength <= 1 ? 'Lemah' : strength === 2 ? 'Cukup' : strength === 3 ? 'Kuat' : 'Sangat Kuat';

    return (
        <div className="space-y-2 pt-1">
            <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(i => (
                    <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-all duration-500"
                        style={{ backgroundColor: strength >= i ? color : 'rgba(255,255,255,0.06)' }}
                    />
                ))}
            </div>
            <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {checks.map(c => (
                        <span key={c.label} className="flex items-center gap-1 text-[10px]" style={{ color: c.pass ? '#00ff9d' : '#4b5563' }}>
                            <Check className="w-2.5 h-2.5" />
                            {c.label}
                        </span>
                    ))}
                </div>
                {value && <span className="text-[10px] font-display tracking-wider" style={{ color }}>{label}</span>}
            </div>
        </div>
    );
}

export default function RegisterPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [particles, setParticles] = useState<{ x: number; y: number; size: number; speed: number; opacity: number; hue: number }[]>([]);

    useEffect(() => {
        setParticles(Array.from({ length: 35 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random() * 0.5 + 0.1,
            hue: Math.random() > 0.5 ? 220 : 150,
        })));
    }, []);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
    } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

    const passwordVal = watch("password", "");
    const usernameVal = watch("username", "");
    const emailVal = watch("email", "");

    const onSubmit = async (data: RegisterFormData) => {
        setServerError(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const user: User = {
                id: `user-${Date.now()}`,
                username: data.username,
                email: data.email,
                totalPoints: 0,
                gamesPlayed: 0,
                createdAt: new Date().toISOString(),
            };
            saveUser(user);
            router.push('/');
        } catch {
            setServerError("Pendaftaran gagal. Coba lagi.");
        }
    };

    return (
        <div className="min-h-screen bg-[#050812] relative overflow-hidden flex items-center justify-center font-body py-8">

            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(45,106,242,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(45,106,242,0.04)_1px,transparent_1px)] bg-[length:60px_60px]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,255,157,0.08),transparent)]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_0%_100%,rgba(45,106,242,0.08),transparent)]"></div>
            </div>

            {/* Orbs */}
            <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-[#2d6af2]/8 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-1/3 left-1/4 w-56 h-56 bg-[#00ff9d]/6 rounded-full blur-[80px] pointer-events-none"></div>

            {/* Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                {particles.map((p, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full animate-[float_linear_infinite]"
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            opacity: p.opacity,
                            backgroundColor: `hsl(${p.hue}, 80%, 65%)`,
                            animation: `float ${7 / p.speed}s linear infinite`,
                            animationDelay: `${i * 0.25}s`,
                        }}
                    />
                ))}
            </div>

            {/* Card */}
            <div className="relative z-10 w-full max-w-[440px] mx-4">

                {/* Logo */}
                <div className="text-center mb-8">
                    <button onClick={() => router.push('/login')} className="group flex flex-col items-center">
                        <Logo width={300} height={90} animated={false} withText={false} />
                        <p className="text-gray-500 text-xs font-display tracking-[0.25em] uppercase mt-4">Bergabung sekarang. Mulai balapan!</p>
                    </button>
                </div>

                <div className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]">

                    {/* Accent */}
                    <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#00ff9d]/50 to-transparent"></div>

                    <div className="mb-7">
                        <h1 className="text-white font-display text-2xl font-bold tracking-wide mb-1">Buat Akun Racer</h1>
                        <p className="text-gray-500 text-sm">
                            Sudah punya akun?{' '}
                            <button onClick={() => router.push('/login')} className="text-[#2d6af2] hover:text-[#00ff9d] transition-colors font-semibold">
                                Masuk di sini
                            </button>
                        </p>
                    </div>

                    {/* Google */}
                    <button
                        type="button"
                        className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all text-white text-sm font-medium mb-6 group hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.04)]"
                    >
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>Daftar dengan Google</span>
                        <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-gray-400" />
                    </button>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 h-px bg-white/[0.07]"></div>
                        <span className="text-gray-600 text-xs font-display tracking-widest">ATAU</span>
                        <div className="flex-1 h-px bg-white/[0.07]"></div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {serverError && (
                            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                <Zap className="w-4 h-4 flex-shrink-0" />
                                {serverError}
                            </div>
                        )}

                        {/* Username */}
                        <div className="space-y-1.5">
                            <label className="text-gray-400 text-xs font-display tracking-widest uppercase">Username Racer</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="contoh: NitroKing99"
                                    autoComplete="username"
                                    className={`w-full h-12 bg-white/[0.04] border ${errors.username ? 'border-red-500/50' : usernameVal && !errors.username ? 'border-[#00ff9d]/40' : 'border-white/[0.08] focus:border-[#2d6af2]'} text-white text-sm px-4 rounded-xl outline-none transition-all placeholder:text-gray-600 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(45,106,242,0.12)]`}
                                    {...register("username")}
                                />
                                {usernameVal && !errors.username && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#00ff9d]/10 border border-[#00ff9d]/40 flex items-center justify-center">
                                        <Check className="w-3 h-3 text-[#00ff9d]" />
                                    </div>
                                )}
                            </div>
                            {errors.username && <p className="text-red-400 text-xs pl-1">{errors.username.message}</p>}
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-gray-400 text-xs font-display tracking-widest uppercase">Email</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="email@contoh.com"
                                    autoComplete="email"
                                    className={`w-full h-12 bg-white/[0.04] border ${errors.email ? 'border-red-500/50' : emailVal && !errors.email ? 'border-[#00ff9d]/40' : 'border-white/[0.08] focus:border-[#2d6af2]'} text-white text-sm px-4 rounded-xl outline-none transition-all placeholder:text-gray-600 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(45,106,242,0.12)]`}
                                    {...register("email")}
                                />
                                {emailVal && !errors.email && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#00ff9d]/10 border border-[#00ff9d]/40 flex items-center justify-center">
                                        <Check className="w-3 h-3 text-[#00ff9d]" />
                                    </div>
                                )}
                            </div>
                            {errors.email && <p className="text-red-400 text-xs pl-1">{errors.email.message}</p>}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-gray-400 text-xs font-display tracking-widest uppercase">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    className={`w-full h-12 bg-white/[0.04] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08] focus:border-[#2d6af2]'} text-white text-sm px-4 pr-12 rounded-xl outline-none transition-all placeholder:text-gray-600 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(45,106,242,0.12)]`}
                                    {...register("password")}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-400 text-xs pl-1">{errors.password.message}</p>}
                            {passwordVal && <PasswordStrength value={passwordVal} />}
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                            <label className="text-gray-400 text-xs font-display tracking-widest uppercase">Konfirmasi Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? "text" : "password"}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    className={`w-full h-12 bg-white/[0.04] border ${errors.confirm ? 'border-red-500/50' : 'border-white/[0.08] focus:border-[#2d6af2]'} text-white text-sm px-4 pr-12 rounded-xl outline-none transition-all placeholder:text-gray-600 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(45,106,242,0.12)]`}
                                    {...register("confirm")}
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1">
                                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.confirm && <p className="text-red-400 text-xs pl-1">{errors.confirm.message}</p>}
                        </div>

                        {/* Terms */}
                        <p className="text-gray-600 text-xs leading-relaxed">
                            Dengan mendaftar, kamu menyetujui{' '}
                            <span className="text-[#2d6af2] cursor-pointer hover:text-[#00ff9d] transition-colors">Syarat & Ketentuan</span>
                            {' '}dan{' '}
                            <span className="text-[#2d6af2] cursor-pointer hover:text-[#00ff9d] transition-colors">Kebijakan Privasi</span>{' '}
                            kami.
                        </p>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="relative w-full h-12 mt-1 rounded-xl bg-gradient-to-r from-[#00c97d] to-[#00ff9d] text-black font-display text-sm tracking-widest uppercase font-extrabold overflow-hidden group transition-all hover:shadow-[0_0_30px_rgba(0,255,157,0.5)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Memproses...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    Daftar & Mulai Balapan
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-gray-700 text-xs mt-6 font-display tracking-wider">
                    © 2026 NitroQuiz · Learn it. Race it. Win it.
                </p>
            </div>

            <style jsx>{`
                @keyframes float {
                    0% { transform: translateY(100vh) scale(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(-10vh) scale(1); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
