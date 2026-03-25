import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Guard against invalid/placeholder values during build time
const isValid = supabaseUrl.startsWith('http') && !supabaseUrl.includes('your_supabase_url_here');

export const supabase = isValid 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : { auth: { getSession: async () => ({ data: { session: null } }) }, from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }), order: () => Promise.resolve({ data: [] }) }) }) }; 

