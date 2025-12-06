import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { Command, Mail, Lock, LogIn, Loader2, AlertCircle, GraduationCap, Briefcase } from 'lucide-react';
import { clsx } from 'clsx';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            console.error("Login Error:", err);
            // Friendly error mapping
            if (err.code === 'auth/invalid-credential') {
                setError("Invalid email or password.");
            } else if (err.code === 'auth/too-many-requests') {
                setError("Too many failed attempts. Please try again later.");
            } else {
                setError("Failed to sign in. Please check your credentials.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black p-4">
            
            {/* Background Ambience */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-40 pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-accent/20 rounded-full blur-3xl opacity-40 pointer-events-none" />

            <div className="w-full max-w-md bg-slate-950/50 backdrop-blur-xl border border-glassBorder rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                        <Command size={24} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
                    <p className="text-slate-400 text-sm mt-1">Sign in to AetherSchedule Admin</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-200 animate-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 uppercase tracking-wide ml-1">Email Address</label>
                        <div className="relative group">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-600"
                                placeholder="admin@university.edu"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 uppercase tracking-wide ml-1">Password</label>
                        <div className="relative group">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-600"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className={clsx(
                            "w-full mt-6 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2",
                            isSubmitting 
                                ? "bg-slate-800 cursor-wait text-slate-400" 
                                : "bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-500 hover:to-primary shadow-primary/25"
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Authenticating...
                            </>
                        ) : (
                            <>
                                <LogIn size={18} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>

                <div className="my-6 border-t border-slate-800 relative">
                    <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-slate-900 px-2 text-xs text-slate-500">PUBLIC PORTALS</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => navigate('/student-portal')}
                        className="py-3 rounded-xl font-medium text-slate-300 bg-slate-800/50 hover:bg-slate-700/80 hover:text-white transition-all flex flex-col items-center justify-center gap-1.5 border border-slate-700"
                    >
                        <GraduationCap size={20} className="text-primary" />
                        <span className="text-xs">Students</span>
                    </button>
                    <button
                        onClick={() => navigate('/faculty-portal')}
                        className="py-3 rounded-xl font-medium text-slate-300 bg-slate-800/50 hover:bg-slate-700/80 hover:text-white transition-all flex flex-col items-center justify-center gap-1.5 border border-slate-700"
                    >
                        <Briefcase size={20} className="text-emerald-400" />
                        <span className="text-xs">Faculty</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;