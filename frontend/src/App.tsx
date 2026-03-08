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
import { useAppStore } from './store/useAppStore';
import { LoginScreen } from './components/views/LoginScreen';
import { AppContent } from './components/AppContent';

// ─── 폰트 글로벌 스타일 ────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600;700;800&display=swap');
    .font-body    { font-family: 'Inter', sans-serif; }
    .font-heading { font-family: 'Montserrat', sans-serif; }
  `}</style>
);

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { appSettings } = useAppStore();

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setAuthUser(session?.user ?? null);
      })
      .catch(() => {
        // 네트워크 오류 등으로 세션 조회 실패 시에도 로딩 해제
      })
      .finally(() => {
        setAuthLoading(false);
      });

    // 이후 auth 상태 변화 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className={`h-screen flex items-center justify-center ${appSettings.darkMode ? 'bg-[#18181A]' : 'bg-[#F1F3F5]'}`}>
        <Loader2 size={32} className="animate-spin text-[#FACC15]" />
      </div>
    );
  }

  return (
    <>
      <GlobalStyle />
      {!authUser
        ? <LoginScreen darkMode={appSettings.darkMode} />
        : <AppContent authUser={authUser} />
      }
    </>
  );
}
