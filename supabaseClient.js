// supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

console.log("SUPABASE_URL set:", !!supabaseUrl);
console.log("SUPABASE_SERVICE_ROLE_KEY set:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("SUPABASE_KEY set:", !!process.env.SUPABASE_KEY);

if (!supabaseUrl) throw new Error("SUPABASE_URL is required.");
if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY is required.");

export const supabase = createClient(supabaseUrl, supabaseKey);