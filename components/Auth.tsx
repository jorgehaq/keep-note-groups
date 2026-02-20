import React, { useState } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { Loader2, Mail, Lock, ArrowLeft } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

export function Auth() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const clearMessage = () => setMessage(null);

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setMessage(null);
        setPassword('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setMessage({ text: 'Ingresa tu correo y contraseña.', type: 'error' });
            return;
        }
        setLoading(true);
        clearMessage();

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setMessage({
                text: error.message === 'Invalid login credentials'
                    ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
                    : error.message, type: 'error'
            });
        }
        setLoading(false);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setMessage({ text: 'Ingresa tu correo y contraseña.', type: 'error' });
            return;
        }
        if (password.length < 6) {
            setMessage({ text: 'La contraseña debe tener al menos 6 caracteres.', type: 'error' });
            return;
        }
        setLoading(true);
        clearMessage();

        const { error } = await supabase.auth.signUp({ email, password });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else {
            setMessage({ text: '¡Cuenta creada! Revisa tu correo para confirmar tu cuenta.', type: 'success' });
        }
        setLoading(false);
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setMessage({ text: 'Ingresa tu correo electrónico.', type: 'error' });
            return;
        }
        setLoading(true);
        clearMessage();

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else {
            setMessage({ text: 'Enlace de recuperación enviado. Revisa tu bandeja de entrada.', type: 'success' });
        }
        setLoading(false);
    };

    const onSubmit = mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset;

    const titles: Record<AuthMode, string> = {
        login: 'Iniciar Sesión',
        signup: 'Crear Cuenta',
        reset: 'Recuperar Contraseña',
    };

    const buttonLabels: Record<AuthMode, string> = {
        login: 'Entrar',
        signup: 'Registrarse',
        reset: 'Enviar Enlace',
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-zinc-200 dark:border-zinc-800">

                {/* Header */}
                <div className="mb-8 text-center">
                    {mode !== 'login' && (
                        <button
                            onClick={() => switchMode('login')}
                            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
                        >
                            <ArrowLeft size={14} />
                            Volver
                        </button>
                    )}
                    <h1 className="text-3xl font-bold text-zinc-800 dark:text-white">
                        {titles[mode]}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                        {mode === 'login' && 'Accede a tus notas'}
                        {mode === 'signup' && 'Crea tu cuenta para empezar'}
                        {mode === 'reset' && 'Te enviaremos un enlace de recuperación'}
                    </p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-5 p-3 rounded-lg text-sm font-medium ${message.type === 'success'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={onSubmit} className="space-y-4">
                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail size={16} className="text-zinc-400" />
                            </div>
                            <input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-[#1F3760]/50 focus:border-[#1F3760] transition-all"
                            />
                        </div>
                    </div>

                    {/* Password (hidden in reset mode) */}
                    {mode !== 'reset' && (
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock size={16} className="text-zinc-400" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-[#1F3760]/50 focus:border-[#1F3760] transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Forgot password link (only in login mode) */}
                    {mode === 'login' && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => switchMode('reset')}
                                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#1F3760] hover:bg-[#152643] text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98]"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <span>{buttonLabels[mode]}</span>}
                    </button>
                </form>

                {/* Mode switcher */}
                <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {mode === 'login' ? (
                        <p>
                            ¿No tienes cuenta?{' '}
                            <button
                                onClick={() => switchMode('signup')}
                                className="text-[#4A7FC1] hover:text-[#6B9FE1] font-medium transition-colors"
                            >
                                Regístrate
                            </button>
                        </p>
                    ) : mode === 'signup' ? (
                        <p>
                            ¿Ya tienes cuenta?{' '}
                            <button
                                onClick={() => switchMode('login')}
                                className="text-[#4A7FC1] hover:text-[#6B9FE1] font-medium transition-colors"
                            >
                                Inicia sesión
                            </button>
                        </p>
                    ) : null}
                </div>

            </div>
        </div>
    );
}
