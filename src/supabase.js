import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://ognlrwbwcfyprurljywd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbmxyd2J3Y2Z5cHJ1cmxqeXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTU0MDAsImV4cCI6MjA5ODkzMTQwMH0.1fqqDyCJnGLCyl4ouK5sv73a0Vm3MVxi9OzLq0G-tjA"
);