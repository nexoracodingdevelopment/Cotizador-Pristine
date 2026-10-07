import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  "https://ognlrwbwcfyprurljywd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbmxyd2J3Y2Z5cHJ1cmxqeXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM1NTQwMCwiZXhwIjoyMDk4OTMxNDAwfQ.EM8ghOJdB0c4kjWiQTyiYCpGcJaN54uDxBYlmj27I9g",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: "supabase-admin",
    }
  }
);