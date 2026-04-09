'use client';

import { useEffect, useState } from 'react';
import { createClient } from './client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.error('[useAuth] getUser error:', error.message);
        setUser(data?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[useAuth] unexpected error:', err);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, supabase };
}
