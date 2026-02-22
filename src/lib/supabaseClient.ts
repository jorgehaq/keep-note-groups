import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan variables de entorno de Supabase. Asegúrate de configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env')
} else {
  // Debug logging for keys (masked)
  const maskedKey = supabaseAnonKey.substring(0, 10) + '...' + supabaseAnonKey.substring(supabaseAnonKey.length - 4);
  console.log('Supabase Client Initialized with URL:', supabaseUrl, 'and Anon Key:', maskedKey);
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
