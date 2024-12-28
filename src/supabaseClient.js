import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ygiawlwxsqdtfmijrmmo.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnaWF3bHd4c3FkdGZtaWpybW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxNDYxNzMsImV4cCI6MjA1MDcyMjE3M30.bBsumk-UvxeQGVTb5VtDv-9agxmDmSf88T58quI6FI4";

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables are missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
