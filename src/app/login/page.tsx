'use client';

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from 'next/navigation';
import { saveUser } from '@/lib/storage';
import { User } from '@/types';
import { supabaseCentral } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import { useTranslation } from "react-i18next";

const loginSchema = z.object({
  identifier: z.string().min(3, "login.form.identifier_error_min"),
  password: z.string().min(6, "login.form.password_error_min"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation();
  const { user, profile, loading } = useAuth()
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [particles, setParticles] = useState<{ x: number; y: number; size: number; delay: number; green: boolean }[]>([]);
  const [lines, setLines] = useState<{ top: number; width: number; opacity: number; fromRight: boolean; delay: number; duration: number }[]>([]);

  const registerUrl =
    typeof window !== "undefined" &&
      window.location.hostname.includes("gameforsmart.com")
      ? "https://gameforsmart.com/auth/register"
      : "https://gameforsmartnewui.vercel.app/auth/register";

  useEffect(() => {
    setParticles(Array.from({ length: 24 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      delay: Math.random() * 6,
      green: i % 3 === 0,
    })));
    setLines(Array.from({ length: 10 }, () => ({
      top: Math.random() * 90 + 5,
      width: Math.random() * 20 + 10,
      opacity: Math.random() * 0.1 + 0.03,
      fromRight: Math.random() > 0.5,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 1,
    })));
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const identifierVal = watch("identifier", "");

  useEffect(() => {
    if ((user || profile) && !loading) {
      const pendingCode = localStorage.getItem("pendingRoomCode");
      if (pendingCode) {
        localStorage.setItem("roomCode", pendingCode);
        router.replace('/');
      } else {
        router.replace('/');
      }
    }
  }, [user, profile, loading, router])

  const resolveEmail = async (input: string) => {
    if (input.includes("@")) return input.toLowerCase();

    const { data, error } = await supabaseCentral
      .from("profiles")
      .select("email")
      .eq("username", input)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("login.form.username_not_found");

    return data.email.toLowerCase();
  };

  const handleEmailLogin = async (data: LoginFormData) => {
    setServerError(null)

    try {
      const resolvedEmail = await resolveEmail(data.identifier.trim());

      const { error } = await supabaseCentral.auth.signInWithPassword({
        email: resolvedEmail,
        password: data.password,
      })

      if (error) throw error;

    } catch (err: any) {
      setServerError(t(err.message) || t('login.form.generic_error'))
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabaseCentral.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/` },
      });
      if (error) throw error;
    } catch (err: any) {
      setServerError(t('login.google.failed'));
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#04060f] relative overflow-hidden flex items-center justify-center font-body">

      {/* === BG EFFECTS === */}
      {/* Grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(0,255,157,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.022)_1px,transparent_1px)] bg-[length:80px_80px]" />
      {/* Perspective track */}
      <div className="absolute bottom-0 left-0 right-0 h-52 z-0 bg-[linear-gradient(transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(45,106,242,0.06)_1px,transparent_1px)] bg-[length:80px_40px] [transform:perspective(400px)_rotateX(60deg)] origin-bottom pointer-events-none opacity-60" />
      {/* Radial glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(45,106,242,0.07),transparent)] z-0" />
      <div className="absolute top-0 left-0 right-0 h-64 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(0,255,157,0.06),transparent)] z-0" />
      <div className="absolute top-0 left-0 w-72 h-72 bg-[#2d6af2]/8 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#00ff9d]/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Speed lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {lines.map((l, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-[#00ff9d] to-transparent"
            style={{
              top: `${l.top}%`,
              width: `${l.width}%`,
              opacity: l.opacity,
              right: l.fromRight ? '0%' : 'auto',
              left: l.fromRight ? 'auto' : '0%',
            }}
            animate={{ scaleX: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: l.duration, delay: l.delay, ease: "easeOut" }}
          />
        ))}
      </div>

      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: 0,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.green ? '#00ff9d' : '#2d6af2',
            }}
            animate={{ y: [0, -900], opacity: [0, 0.5, 0.3, 0] }}
            transition={{ repeat: Infinity, duration: 7 + p.delay, delay: p.delay, ease: "linear" }}
          />
        ))}
      </div>

      {/* === CARD === */}
      <div className="relative z-10 w-full max-w-[380px] mx-4">

        {/* Top Bar for Login */}
        <div className="fixed top-0 left-0 right-0 z-[90] px-4 md:px-8 py-5 flex items-start justify-between pointer-events-none">
          <div className="pointer-events-auto">
            <Image
              src="/assets/logo/logo1.png"
              alt="Logo"
              width={180}
              height={50}
              className="h-9 md:h-11 w-auto object-contain drop-shadow-[0_0_15px_rgba(45,106,242,0.4)]"
            />
          </div>
          <div className="pointer-events-auto">
            <Image
              src="/assets/logo/logo2.png"
              alt="NitroQuiz"
              width={160}
              height={40}
              className="h-6 md:h-8 w-auto object-contain opacity-80 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
            />
          </div>
        </div>

        {/* Removed redundant logo from above the card */}

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="relative"
        >
          {/* Glow border */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#2d6af2]/30 via-transparent to-[#00ff9d]/15 z-0 pointer-events-none" />

          <div className="relative bg-[#080d1a]/95 backdrop-blur-2xl rounded-2xl p-7 z-10 shadow-[0_0_50px_rgba(45,106,242,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]">

            {/* Accent top */}
            <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#2d6af2]/60 to-transparent" />

            {/* Title (centered) */}
            <div className="text-center mb-7 mt-1">
              <h1 className="text-white font-display text-2xl font-bold tracking-wider uppercase">{t('login.title')}</h1>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-white/8 bg-white/[0.04] hover:bg-white/[0.08] transition-all text-white text-sm font-medium mb-5 group hover:border-white/15 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {isGoogleLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                : <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              }
              <span className="text-sm">{isGoogleLoading ? t('login.google.redirecting') : t('login.google.continue')}</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-gray-700 text-[10px] font-display tracking-widest">{t('login.or')}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(handleEmailLogin)} className="space-y-4">
              {serverError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-xs bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"
                >
                  {serverError}
                </motion.p>
              )}

              {/* Identifier (Email/Username) */}
              <div className="space-y-1.5">
                <label className="text-gray-500 text-[10px] font-display tracking-[0.18em] uppercase">{t('login.form.identifier_label')}</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t('login.form.identifier_placeholder')}
                    autoComplete="username"
                    disabled={isSubmitting}
                    className={`w-full h-11 bg-white/[0.03] border ${errors.identifier ? 'border-red-500/40' : identifierVal ? 'border-[#00ff9d]/25' : 'border-white/[0.07]'} text-white text-sm px-4 rounded-xl outline-none transition-all placeholder:text-gray-700 focus:border-[#2d6af2]/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(45,106,242,0.1)] font-mono tracking-wide`}
                    {...register("identifier")}
                  />
                  {identifierVal && !errors.identifier && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d]" />
                  )}
                </div>
                {errors.identifier && <p className="text-red-400 text-[10px] pl-1">{t(errors.identifier.message as string)}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-gray-500 text-[10px] font-display tracking-[0.18em] uppercase">{t('login.form.password_label')}</label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={t('login.form.password_placeholder')}
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className={`w-full h-11 bg-white/[0.03] border ${errors.password ? 'border-red-500/40' : 'border-white/[0.07]'} text-white text-sm px-4 pr-11 rounded-xl outline-none transition-all placeholder:text-gray-700 focus:border-[#2d6af2]/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(45,106,242,0.1)] font-mono`}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-[10px] pl-1">{t(errors.password.message as string)}</p>}
              </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="relative w-full h-11 mt-1 rounded-xl font-display text-sm tracking-[0.2em] uppercase font-bold text-white overflow-hidden group transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-[#1a45c4] via-[#2d6af2] to-[#1a45c4]" />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600" />
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00ff9d] opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_#00ff9d]" />
                                <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
                                <span className="relative flex items-center justify-center gap-2">
                                    {isSubmitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> {t('login.form.authenticating')}</>
                                    ) : (
                                        <>{t('login.form.button')} <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                                    )}
                                </span>
                            </button>
                        </form>

                        {/* Register link (bottom) */}
                        <p className="text-center text-gray-600 text-xs mt-5 pt-5 border-t border-white/[0.05]">
                            {t('login.register.text')}{' '}
                            <a
                                href={registerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#2d6af2] hover:text-[#00ff9d] transition-colors font-semibold"
                            >
                                {t('login.register.link')}
                            </a>
                        </p>

                        {/* Bottom accent */}
                        <div className="absolute bottom-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#00ff9d]/15 to-transparent" />
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center text-gray-800 text-[10px] font-display tracking-widest mt-5 uppercase"
                >
                    {t('login.footer')}
                </motion.p>
            </div>
        </div>
    );
}