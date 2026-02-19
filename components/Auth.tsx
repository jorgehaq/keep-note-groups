import React, { useState } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

export function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            setMessage({ text: 'Por favor ingresa tu email', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else {
            setMessage({ text: '¡Enlace mágico enviado! Revisa tu correo.', type: 'success' });
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) {
            setMessage({ text: error.message, type: 'error' });
            setLoading(false);
        }
        // Redirect happens automatically
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
                <h1 className="text-3xl font-bold text-center mb-2 text-slate-800 dark:text-white">Bienvenido</h1>
                <p className="text-center text-slate-500 dark:text-slate-400 mb-8">Inicia sesión para guardar tus notas</p>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Correo Electrónico
                        </label>
                        <input
                            id="email"
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <span>Enviar Magic Link</span>}
                    </button>
                </form>
            </div>
        </div >
    );
}
