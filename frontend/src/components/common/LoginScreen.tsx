import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LoginScreenProps {
  darkMode: boolean;
}

export const LoginScreen = ({ darkMode }: LoginScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) return setError('Please enter email and password.');
    setLoading(true);
    setError('');
    try {
      const { error: authError } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authError.message);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const bg = darkMode ? 'bg-[#18181A] text-gray-100' : 'bg-[#F1F3F5] text-gray-800';
  const card = darkMode ? 'bg-[#2C2C2E]' : 'bg-white';
  const input = darkMode
    ? 'bg-[#3A3A3C] text-gray-100 placeholder-gray-500'
    : 'bg-gray-50 text-gray-800 placeholder-gray-400';

  return (
    <div className={`h-screen flex items-center justify-center font-body p-4 ${bg}`}>
      <div className={`w-full max-w-sm rounded-[32px] p-8 shadow-2xl ${card}`}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#FACC15] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Calendar size={28} className="text-[#1C1C1E]" strokeWidth={2.5} />
          </div>
          <h1 className="font-heading text-2xl font-bold">My Planner</h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#FACC15] text-base font-medium ${input}`}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#FACC15] text-base font-medium ${input}`}
          />
          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#1C1C1E] text-[#FACC15] font-bold text-lg rounded-2xl p-4 hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={20} className="animate-spin" />}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className={`w-full text-sm font-semibold py-2 transition-colors ${
              darkMode
                ? 'text-gray-400 hover:text-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};
