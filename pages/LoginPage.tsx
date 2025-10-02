

import React, { useState } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import { University, ArrowLeft, Loader2 } from 'lucide-react';
import * as api from '../services';
import { useQuery } from '@tanstack/react-query';

interface LoginPageProps {
  onBackToHome: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onBackToHome }) => {
  const { login: appLogin } = useAppContext();
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserEmail) {
      toast.error('Please select a user to log in.');
      return;
    }
    setIsLoading(true);
    try {
      const user = await api.login(selectedUserEmail);
      toast.success(`Welcome, ${user.name}!`);
      appLogin(user);
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-md p-8 animate-fade-in-up">
        <div className="text-center mb-8">
          <University className="mx-auto text-[var(--accent)] h-12 w-12 mb-4" />
          <h1 className="text-3xl font-bold text-[var(--text-white)]">Sign In to AetherSchedule</h1>
          <p className="text-[var(--text-muted)] mt-2">Select a user profile to proceed.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="user-select" className="block text-sm font-medium text-[var(--text-muted)] mb-1">
              Select User Profile (Demo)
            </label>
            <select
              id="user-select"
              value={selectedUserEmail}
              onChange={(e) => setSelectedUserEmail(e.target.value)}
              className="glass-input w-full"
              required
            >
              <option value="" disabled>-- Select a user --</option>
              {users.map(user => (
                <option key={user.id} value={user.email}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
          
          <GlassButton type="submit" className="w-full py-3" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : 'Sign In'}
          </GlassButton>
        </form>

        <div className="mt-6 text-center">
            <button onClick={onBackToHome} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-white)] flex items-center justify-center gap-2 mx-auto">
                <ArrowLeft size={14} />
                Back to Homepage
            </button>
        </div>
      </GlassPanel>
    </div>
  );
};

export default LoginPage;