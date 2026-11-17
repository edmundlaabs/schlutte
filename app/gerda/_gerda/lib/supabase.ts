import { createClient } from "@/lib/supabase/client";

// Gerda läuft als Modul der Schlutte: gleiche Sitzung (Cookies) und gleiche Datenbank.
// Zugriff auf die gerda_*-Tabellen regelt die Row Level Security (has_app_access('gerda')).
export const supabase = createClient();
