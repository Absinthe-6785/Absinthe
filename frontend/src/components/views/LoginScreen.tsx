import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const LoginScreen = () => {
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

  return (
    <div className="h-screen flex items-center justify-center font-body p-4 bg-background text-foreground">
      <div className="w-full max-w-sm rounded-absinthe-2xl p-8 shadow-absinthe-xl bg-surface">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-absinthe-lg flex items-center justify-center mx-auto mb-4 shadow-absinthe-md">
            <Calendar size={28} className="text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="font-heading text-2xl font-bold">Absinthe</h1>
          <p className="text-sm mt-1 text-muted">
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
            className="w-full rounded-absinthe-lg p-4 outline-none focus:ring-2 focus:ring-primary text-base font-medium bg-surface-alt text-foreground placeholder:text-muted border border-border"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-absinthe-lg p-4 outline-none focus:ring-2 focus:ring-primary text-base font-medium bg-surface-alt text-foreground placeholder:text-muted border border-border"
          />
          {error && <p className="text-danger text-sm font-semibold text-center">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-bold text-lg rounded-absinthe-lg p-4 hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={20} className="animate-spin" />}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="w-full text-sm font-semibold py-2 transition-colors text-muted hover:text-primary"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};
