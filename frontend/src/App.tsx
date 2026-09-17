/**
 * App.tsx — 경량화된 엔트리 포인트
 *
 * 역할: Auth 상태 감지 + LoginScreen / AppContent 분기만 담당.
 * 비즈니스 로직은 모두 hooks / components로 이전.
 */
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import { LoginScreen } from './components/views/LoginScreen';
import { AppContent } from './components/AppContent';
import { setRuntimeAccountSyncAccount } from './lib/remoteBoundary';

// ─── 폰트 글로벌 스타일 ────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600;700;800&display=swap');
    .font-body    { font-family: 'Inter', sans-serif; }
  `}</style>
);

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let authRevision = 0;
    let disposed = false;
    setRuntimeAccountSyncAccount(null);

    const applySession = (session: { user: User } | null) => {
      setRuntimeAccountSyncAccount(session?.user.id ?? null);
      setAuthUser(session?.user ?? null);
    };

    const initialRevision = authRevision;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision += 1;
      if (!disposed) applySession(session);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!disposed && authRevision === initialRevision) applySession(session);
      })
      .catch(() => {})
      .finally(() => {
        if (!disposed) setAuthLoading(false);
      });
    return () => {
      disposed = true;
      setRuntimeAccountSyncAccount(null);
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <GlobalStyle />
      {!authUser
        ? <LoginScreen />
        : <AppContent authUser={authUser} />
      }
    </>
  );
}
