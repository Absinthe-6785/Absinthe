/**
 * App.tsx — 경량화된 엔트리 포인트
 *
 * 역할: Auth 상태 감지 + LoginScreen / AppContent 분기만 담당.
 * 비즈니스 로직은 모두 hooks / components로 이전.
 */
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import { LoginScreen } from './components/views/LoginScreen';
import { NotesReadOnlyCloudView } from './components/views/NotesReadOnlyCloudView';
import { setRuntimeAccountSyncAccount } from './lib/remoteBoundary';
import { replaceGoogleDriveRuntimeAccount } from './lib/googleDriveSessionRuntime';

const AppContent = lazy(() => import('./components/AppContent').then(module => ({ default: module.AppContent })));

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
  const [authOwnerGeneration, setAuthOwnerGeneration] = useState(0);
  const authOwnerRef = useRef<{ accountId: string | null; generation: number }>({ accountId: null, generation: 0 });
  const [readOnlyNotesRoute] = useState(() => typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('notesReadOnly') === '1');

  useEffect(() => {
    let authRevision = 0;
    let disposed = false;
    // Supabase may repeat SIGNED_IN on tab refocus without replacing the session.
    // Compare only in memory; never log or persist the session token.
    let driveOwner: { accountId: string; token: string } | null = null;
    let readOnlyOwner: { accountId: string; accessToken: string; refreshToken: string } | null = null;
    setRuntimeAccountSyncAccount(null);
    replaceGoogleDriveRuntimeAccount(null);

    const applySession = (session: { user: User; access_token?: string; refresh_token?: string } | null) => {
      setRuntimeAccountSyncAccount(session?.user.id ?? null);
      const nextOwner = session?.access_token
        ? { accountId: session.user.id, token: session.access_token } : null;
      if (!nextOwner || !driveOwner || nextOwner.accountId !== driveOwner.accountId || nextOwner.token !== driveOwner.token) {
        replaceGoogleDriveRuntimeAccount(nextOwner?.accountId ?? null);
      }
      driveOwner = nextOwner;
      const nextReadOnlyOwner = session?.access_token
        ? { accountId: session.user.id, accessToken: session.access_token, refreshToken: session.refresh_token ?? '' } : null;
      const sameReadOnlyOwner = nextReadOnlyOwner === null
        ? readOnlyOwner === null
        : readOnlyOwner !== null && nextReadOnlyOwner.accountId === readOnlyOwner.accountId
          && nextReadOnlyOwner.accessToken === readOnlyOwner.accessToken
          && nextReadOnlyOwner.refreshToken === readOnlyOwner.refreshToken;
      if (!sameReadOnlyOwner) {
        const generation = authOwnerRef.current.generation + 1;
        authOwnerRef.current = { accountId: nextReadOnlyOwner?.accountId ?? null, generation };
        setAuthOwnerGeneration(generation);
      }
      readOnlyOwner = nextReadOnlyOwner;
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
      driveOwner = null;
      readOnlyOwner = null;
      authOwnerRef.current = { accountId: null, generation: authOwnerRef.current.generation + 1 };
      setRuntimeAccountSyncAccount(null);
      replaceGoogleDriveRuntimeAccount(null);
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
        : readOnlyNotesRoute
          ? <NotesReadOnlyCloudView
            key={`${authUser.id}:${authOwnerGeneration}`}
            accountId={authUser.id}
            authGeneration={authOwnerGeneration}
            getCurrentAuthOwner={() => authOwnerRef.current}
          />
          : <Suspense fallback={<div className="h-screen flex items-center justify-center bg-background" role="status" aria-busy="true">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>}>
            <AppContent authUser={authUser} />
          </Suspense>
      }
    </>
  );
}
