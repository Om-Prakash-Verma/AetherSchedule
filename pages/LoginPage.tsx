import React, { useState } from 'react';
import { University, ArrowLeft, Mail } from 'lucide-react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services';

interface LoginPageProps {
  onBackToHome: () => void;
}

const quickLoginUsers = [
  { label: 'Super Admin', email: 'super.admin@test.com' },
  { label: 'Manager', email: 'manager@test.com' },
  { label: 'HOD (CS)', email: 'cs.hod@test.com' },
  { label: 'HOD (EE)', email: 'ee.hod@test.com' },
  { label: 'Faculty (Prof 1)', email: 'prof.1@test.com' },
  { label: 'Faculty (Prof 2)', email: 'prof.2@test.com' },
  { label: 'Student (CS S1 A)', email: 'cs_s1_a@test.com' },
  { label: 'Student (ME S5 B)', email: 'me_s5_b@test.com' },
];

const LoginPage: React.FC<LoginPageProps> = ({ onBackToHome }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAppContext();
  const toast = useToast();

  const handleLoginAttempt = async (loginEmail: string) => {
    setIsLoading(true);
    try {
      // FIX: Removed incorrect email modification logic. 
      // The loginEmail from the quick login buttons is now used directly.
      const user = await api.login(loginEmail);
      login(user);
      toast.success(`Welcome back, ${user.name}!`);
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }
    await handleLoginAttempt(email);
  };
  
  const handleQuickLogin = (quickEmail: string) => {
      setEmail(quickEmail);
      handleLoginAttempt(quickEmail);
  };

  return (
    <div className="min-h-screen bg-bg text-white font-sans flex flex-col items-center justify-center p-4 relative">
        <GlassButton 
            variant="secondary"
            onClick={onBackToHome}
            className="absolute top-4 left-4 sm:top-6 sm-left-6"
            icon={ArrowLeft}
        >
            Back to Home
        </GlassButton>
        
        <GlassPanel className="w-full max-w-md p-8">
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-3">
                    <University className="text-[var(--accent)]" size={32} />
                    <h1 className="text-2xl font-bold">AetherSchedule</h1>
                </div>
                <p className="text-text-muted mt-2">Sign in to access the scheduling dashboard.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-2">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="glass-input w-full pl-10"
                            placeholder="e.g., admin@university.edu"
                        />
                    </div>
                </div>

                <div>
                    <GlassButton type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </GlassButton>
                </div>
            </form>

             <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border)]" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-panel px-2 text-text-muted">Or quick login</span>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickLoginUsers.map(user => (
                    <GlassButton
                        key={user.email}
                        variant="secondary"
                        className="text-xs py-1.5"
                        onClick={() => handleQuickLogin(user.email)}
                        disabled={isLoading}
                    >
                        {user.label}
                    </GlassButton>
                ))}
            </div>

        </GlassPanel>
    </div>
  );
};

export default LoginPage;