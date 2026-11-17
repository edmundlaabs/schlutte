-- Neuer Dokumenttyp "oberflaeche" (Auftragsoberfläche, Muster).
-- Manuell im Supabase SQL-Editor ausführen (Projekt "schlutte").
alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents add constraint documents_document_type_check
  check (document_type in ('laufzettel', 'palette', 'oberflaeche'));
