import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export const DEV_MODE = !isSupabaseConfigured();

export const DEV_USER = {
  id: 'dev-distributor-001',
  email: 'demo@freerobot.app',
  user_metadata: { name: 'Demo Distributor' },
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) {
        const noop = () => ({ data: null, error: { message: 'Supabase not configured' }, count: 0 });
        const chainable: Record<string, unknown> = {};
        const handler = { get: () => (..._args: unknown[]) => Object.assign(Promise.resolve({ data: null, error: null, count: 0 }), chainable) };
        const chain = new Proxy({}, handler);
        if (prop === 'auth') {
          return {
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            signInWithPassword: noop,
            signUp: noop,
            signOut: () => Promise.resolve(),
          };
        }
        if (prop === 'from') return () => chain;
        if (prop === 'storage') return { from: () => ({ upload: noop, getPublicUrl: () => ({ data: { publicUrl: '' } }) }) };
        return undefined;
      }
      _client = createClient(url, key);
    }
    return (_client as unknown as Record<string, unknown>)[prop as string];
  },
});
