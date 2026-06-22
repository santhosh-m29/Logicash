import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dnoyeugdhnutavmoeeef.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_MQ9TOrouUzpdQq-kftGQlw_EAYh5Xs5';

// Guard against invalid/placeholder values during build time
const isValid = supabaseUrl.startsWith('http') && !supabaseUrl.includes('your_supabase_url_here');

const dummyAuthMatch = async () => ({ data: null, error: new Error('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend/.env.local') });

export const supabase = isValid 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : { 
      auth: { 
        getSession: async () => ({ data: { session: null } }),
        signUp: dummyAuthMatch,
        signInWithPassword: dummyAuthMatch,
        signInWithOAuth: dummyAuthMatch,
        signOut: dummyAuthMatch
      }, 
      from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }), order: () => Promise.resolve({ data: [] }) }) }) 
    };
