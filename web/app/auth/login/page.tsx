'use client';

import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Suspense, useEffect, useState } from 'react';

type LoginMessages = {
  title: string;
  subtitle: string;
  google: string;
  error: string;
  consent: string;
  terms: string;
  privacy: string;
};

const messages: Record<string, LoginMessages> = {
  ko: {
    title: '로그인',
    subtitle: '계속하려면 로그인하세요',
    google: 'Google로 계속하기',
    error: '로그인 중 문제가 발생했어요. 다시 시도해주세요.',
    consent: '계속 진행하면 {terms} 및 {privacy}에 동의하게 됩니다.',
    terms: '이용약관',
    privacy: '개인정보처리방침',
  },
  en: {
    title: 'Sign in',
    subtitle: 'Sign in to continue',
    google: 'Continue with Google',
    error: 'Something went wrong. Please try again.',
    consent: 'By continuing, you agree to our {terms} and {privacy}.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
  },
  ja: {
    title: 'ログイン',
    subtitle: '続行するにはログインしてください',
    google: 'Googleで続ける',
    error: 'ログイン中にエラーが発生しました。もう一度お試しください。',
    consent: '続行すると、{terms}および{privacy}に同意したものとみなされます。',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
  },
  zh: {
    title: '登录',
    subtitle: '登录以继续',
    google: '使用 Google 继续',
    error: '登录时出现问题，请重试。',
    consent: '继续即表示您同意我们的{terms}和{privacy}。',
    terms: '服务条款',
    privacy: '隐私政策',
  },
};

function detectLocale(): string {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(\w+)/);
    if (match && messages[match[1]]) return match[1];
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.slice(0, 2);
    if (messages[lang]) return lang;
  }
  return 'ko';
}

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  if (/^\/[a-z]+:/i.test(raw)) return '/';
  return raw;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next') ?? searchParams.get('redirectTo'));
  const error = searchParams.get('error');

  const [locale, setLocale] = useState('ko');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setLocale(detectLocale()); }, []);

  const t = messages[locale] ?? messages.ko;
  const supabase = createClient();

  const handleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  const consentParts = t.consent.split(/\{terms\}|\{privacy\}/);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(180deg, #f8f0f4 0%, #f0eef5 40%, #edf2f8 70%, #f2f0f5 100%)',
      }}
    >
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: [
          'radial-gradient(ellipse 80% 60% at 10% 10%, rgba(255,160,190,0.35) 0%, transparent 70%)',
          'radial-gradient(ellipse 70% 50% at 85% 15%, rgba(180,160,255,0.25) 0%, transparent 70%)',
          'radial-gradient(ellipse 60% 50% at 75% 55%, rgba(252,220,160,0.3) 0%, transparent 70%)',
        ].join(', '),
      }} />

      <div className="relative z-10 w-full max-w-[360px] flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
            style={{ background: 'rgba(230,73,128,0.1)', border: '1.5px solid rgba(230,73,128,0.2)' }}
          >
            <img src="/clawers/icons/claw_hub_logo.webp" width={36} height={36} alt="Clawers" className="rounded-full" />
          </div>
          <h1 className="text-2xl font-black text-[#1d1d1f]">Clawers</h1>
          <p className="text-sm mt-1.5 font-medium text-[#86868b]">{t.subtitle}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full mb-4 px-4 py-3 rounded-xl text-sm text-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626' }}>
            {t.error}
          </div>
        )}

        {/* Google login */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 hover:shadow-md active:scale-[0.98] bg-white text-[#1d1d1f] border border-black/5"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 4.66c1.61 0 3.06.56 4.21 1.64l3.16-3.16C17.45 1.49 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {t.google}
          </button>
        </div>

        {/* Legal */}
        <div className="mt-8 w-full">
          <p className="text-[11px] text-center leading-relaxed text-[#86868b]/50">
            {consentParts[0]}
            <a href="/terms" className="underline">{t.terms}</a>
            {consentParts[1]}
            <a href="/privacy" className="underline">{t.privacy}</a>
            {consentParts[2] ?? ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
