# Plan: Abnahmeprotokoll manuell anlegen + Protokoll-Vorlagen (1.2.0)

Stand: 25.11.2026 · Status: **Plan, noch nichts gebaut.** Bauen erst nach OK.

## 0. Ausgangslage (geprüft)

- Branch `feature/abnahme-loeschen` (2c19677, 1.1.2) ist **nicht in `main`** (`main` endet bei #45 / 1.1.0). → Neuer Branch **`feature/abnahme-manuell` von `feature/abnahme-loeschen`**. Der spätere PR enthält damit auch die Lösch-Funktion (1.1.2).
- Arbeitsbaum: `styles/abnahme.css`, `styles/app.css`, `styles/urlaub.css` sind **uncommitted geändert** (nicht von mir), dazu untracked `docs/design/`, `graphify-out/`, `docs/PROMPT_Abnahme_manuell.md`. Ich fasse sie nicht an und stage nur eigene Dateien. Neues CSS kommt deshalb in eine **neue Datei `styles/abnahme-manuell.css`** (Import im Abnahme-Layout), nicht in `abnahme.css`.
- **Live-Schema `commissions`** (Supabase-Projekt `schlutte`, 8 Zeilen): `id uuid`, `commission_number` **bpchar** (unique), `customer_name`, `project_name` (nullable), `notes`, `created_by_initials`, `created_at`, `updated_at`. Der Code stimmt, `supabase/schema.sql` ist veraltet (`nr/client/project`). Die Abnahme-Tabellen sind live vorhanden (Migration 20261120 ist ausgeführt). Folge: Suche immer mit `.trim()` auf `commission_number` (bpchar), keine Annahme über Nummernformat außer in `createCommission` (genau 6 Ziffern).

## 1. Entscheidungen

| Frage | Entscheidung | Grund |
|---|---|---|
| „ohne Kommission“ im Modell | `ProtokollDoc.kommissionNr = ""` (leerer String), DB: `NULL` | `mapping.ts` macht bereits `""↔NULL` (`nn()`/`s()`); IndexedDB-Altbestand und Typen bleiben gültig, kein Schema-Bump. Helfer `hatKommission(doc)` und `kommissionAnzeige(doc, sprache)`. |
| Server-Action | **`legeProtokollAn` erweitern** (Option `kommission: "bestehend" \| "neu" \| "ohne"`, `quelle`) statt zweiter Action | Kommission anlegen, Plausibilität und `insertProtokoll` sind identisch; Import und Editor nutzen denselben Weg. Der Editor baut das `ProtokollDoc` clientseitig, der Server validiert **nochmals** (gleiche Funktion `validiereNeuesProtokoll`). |
| Herkunft | Spalte `quelle` (`profacto`/`manuell`/`vorlage`) am Protokoll; `vorlage` = mind. eine Protokoll-Vorlage wurde eingefügt | wie gefordert |
| Entwurf zwischenspeichern | **localStorage** (Key je Mitarbeiter-ID), Debounce 500 ms, Banner „Entwurf vom … wiederherstellen“ | Der Entwurf ist reiner Text (wenige KB, keine Blobs). IndexedDB brächte hier nur Komplexität; sie bleibt der Begehung (Fotos, Unterschriften) vorbehalten. Zugriff in try/catch wie bei der Navigation. Beim Import wird kein Entwurf gespeichert (die PDF-Datei ließe sich nicht mitspeichern). |
| Protokoll-Vorlagen speichern | **eine Tabelle mit `struktur jsonb`** | Wird immer als Ganzes geladen/geschrieben, nie inhaltlich abgefragt (wie `abnahme_vorlagen.punkte`); eine normalisierte Variante (4 Tabellen) wäre viel Aufwand ohne Nutzen. Referenz auf Möbeltyp-Vorlage per ID im JSON ohne FK → wird beim Einfügen geprüft (Hinweis). |
| Neue Libraries | **keine** | |
| Nachträgliche Zuordnung | Server-Action auf der Protokoll-Detailseite, nur wenn Status ≠ `abgeschlossen` **und** kein Gerät ausgecheckt | Sonst würde der nächste Tablet-Sync (Upsert der ganzen Zeile, `baseRev`) die Zuordnung überschreiben bzw. einen Versionskonflikt auslösen. Bei Checkout: Hinweis „erst Gerät freigeben bzw. synchronisieren“. Der Sperr-Trigger schützt abgeschlossene Protokolle ohnehin. |

## 2. Migration `supabase/migrations/20261125_abnahme_manuell.sql` (nur anlegen, nicht ausführen)

Rein additiv, idempotent, ändert keine Bestandsdaten:

1. `abnahme_protokolle.kommission_nr`: `NOT NULL` entfernen; alten Längen-Check (`abnahme_protokolle_kommission_nr_check`) ersetzen durch `kommission_nr is null or length(btrim(kommission_nr)) > 0`; zusätzlich `check (kommission_nr is not null or commission_id is null)`. Bestehende Zeilen erfüllen beides.
2. `abnahme_protokolle.quelle text not null default 'profacto' check (quelle in ('profacto','manuell','vorlage'))` – Bestand bekommt den Default (= wahr, er stammt aus dem Import). Sperr-Trigger vergleicht `to_jsonb` vor/nach: unverändert, abgeschlossene Protokolle bleiben unberührt.
3. Neue Tabelle `abnahme_protokoll_vorlagen` (`id`, `titel_de`, `titel_en`, `beschreibung`, `struktur jsonb`, `aktiv`, `sort`, `created_at`, `updated_at`), Touch-Trigger, **RLS wie `abnahme_vorlagen`** (select: `has_app_access('abnahme')`; alles andere: `app_role()` in ceo/admin), Grants.
4. Seed (nur `where not exists`): „Einbauschrank-Projekt Standard“ (Raum „Wohnen“: Schrank, Regal) und „Garderobe + Flur“ (Raum „Flur“: Garderobe, Handlauf); Möbeltyp-Verweise über Subselect auf `abnahme_vorlagen.moebeltyp`.
5. `notify pgrst, 'reload schema'`. Der Regiebericht (`abnahme_regieberichte.kommission_nr`) bleibt unverändert `NOT NULL`.

Struktur-JSON: `{ "raeume": [{ "name", "etage", "materialText", "positionen": [{ "titel", "einheit", "beschreibung", "vorlageId": uuid|null, "pruefpunkte": [{ "de", "en" }] }] }] }`. Semantik: Möbeltyp-Prüfpunkte (falls `vorlageId` gesetzt und aktiv) **plus** die eigenen `pruefpunkte`. Menge wird nicht gespeichert (projektspezifisch).

## 3. Dateien

**Neu**
- `app/(app)/abnahme/neu/page.tsx` – Auswahl der zwei Wege (zwei große Karten)
- `app/(app)/abnahme/neu/manuell/page.tsx` – lädt Möbeltyp- und Protokoll-Vorlagen, rendert den Editor
- `components/abnahme/KundeKommissionAuswahl.tsx` – gemeinsame Auswahl (Import + manuell + nachträgliche Zuordnung)
- `components/abnahme/ProtokollEditor.tsx` – Kopf, Entwurf, Vorlage einfügen, Anlegen
- `components/abnahme/StrukturEditor.tsx` – Räume/Positionen/Prüfpunkte (aus `ImportWizard` herausgelöst)
- `components/abnahme/ProtokollVorlagenEditor.tsx` – Admin
- `lib/abnahme/kommission.ts` (+ Test) – Typ `KundeKommission`, `hatKommission`, `kommissionAnzeige`, Validierung/Normalisierung
- `lib/abnahme/validate.ts` (+ Test) – `validiereNeuesProtokoll(doc, kk)`, client und server
- `lib/abnahme/edit.ts` (+ Test) – reine Funktionen: Raum neu/umbenennen/verschieben/löschen, Position neu/löschen/verschieben, Nr-Vergabe (nächste Zahl, änderbar)
- `lib/abnahme/protokoll-vorlagen.ts` (+ Test) – `fuegeVorlageEin`, `strukturAusDoc`
- `lib/abnahme/entwurf.ts` – localStorage-Zugriff
- `styles/abnahme-manuell.css`
- `supabase/migrations/20261125_abnahme_manuell.sql`

**Geändert**
- `lib/abnahme/types.ts` (`quelle`, `ProtokollVorlage`), `mapping.ts` (`quelle`, Vorlagen-Mapping), `build.ts` (`quelle: "profacto"`), `nachtrag.ts` (übernimmt `quelle`)
- `lib/data/abnahme.ts`: `searchKommissionen(q)` (Typeahead, nur echte Treffer, max. 10, kein Mock-Fallback wie in `searchCommissions`), `getProtokollVorlagen()`, `listAblage` (Filter `kommission=ohne`), Typ `AblageEintrag.kommission_nr: string | null`
- `app/(app)/abnahme/actions.ts`: `legeProtokollAn` erweitert, neu `sucheKommissionenAction`, `ordneKommissionZu`
- `app/(app)/abnahme/vorlagen/page.tsx` + `actions.ts` (Tabs, Protokoll-Vorlagen, „Als Vorlage speichern“), `components/abnahme/VorlagenEditor.tsx` bleibt Möbeltyp-Bereich
- `components/abnahme/ImportWizard.tsx` (nutzt `KundeKommissionAuswahl` und `StrukturEditor`)
- `lib/apps.ts` (Nav „Import“ → „Neues Protokoll“, `/abnahme/neu`, `match: ["/abnahme/import"]`), `app/(app)/abnahme/page.tsx` (Button, Filter, Anzeige), `lib/version.ts` 1.2.0, `lib/changelog.ts`, `DECISIONS.md`, `docs/ABNAHME.md`

## 4. UI-Ablauf

**Einstieg** `/abnahme/neu` (Ablage-Button „Neues Protokoll“, Seitenleiste „Neues Protokoll“):
```
┌─ Aus Profacto-PDF ────────┐  ┌─ Manuell / aus Vorlage ───┐
│ Positionsliste hochladen, │  │ Räume, Positionen und     │
│ Räume und Prüfpunkte      │  │ Prüfpunkte selbst eingeben│
│ prüfen.        [Import →] │  │ oder Vorlage einfügen [→] │
└───────────────────────────┘  └───────────────────────────┘
```
Der Import bleibt unter `/abnahme/import` (Links bleiben gültig).

**Kunde/Kommission** (eine Komponente, drei Modi als Segment-Schalter „Bestehende suchen · Neu anlegen · Ohne Kommission“):
```
Kommission  (•) Bestehende suchen  ( ) Neu anlegen  ( ) Ohne Kommission
[ 2600… oder Kunde            ]   ← Typeahead, 250 ms Debounce
  260081 · Emily Hoon & Stephan Raemy · Einbauschränke …
  260077 · Hoon Immobilien · …
Kunde [ Emily Hoon & Stephan Raemy ]  Projekt [ Einbauschränke … ]   (editierbar)
```
- Bestehend: Auswahl übernimmt Nummer, Kunde, Projekt; Kunde bleibt am Protokoll editierbar (die Kommission wird nicht verändert).
- Neu: Nummer (6 Ziffern, Format-Hinweis sofort, Duplikat-Prüfung beim Verlassen des Feldes per Lookup), Kunde, Projekt. Angelegt wird **erst beim Speichern** (`createCommission`, Initialen des Mitarbeiters).
- Ohne: nur Kunde Pflicht, Projekt optional, keine Zeile in `commissions`.
- Im **Import** wird die Profacto-Nummer beim Einlesen gesucht: gefunden → „Bestehend“, nicht gefunden → „Neu anlegen“ mit Nummer/Kunde/Projekt aus der PDF vorbelegt (das Häkchen „Kommission anlegen“ entfällt zugunsten dieses expliziten Modus).

**Editor** `/abnahme/neu/manuell` (Karten wie im Import: „1 · Kopf“, „2 · Räume und Positionen“, „3 · Anlegen“):
- Kopf: Kunde/Kommission, Ort/Baustelle, Titel optional, Sprache DE/EN, Kunden-E-Mail. Mitarbeiter = angemeldeter Nutzer.
- Räume: hinzufügen, umbenennen, Etage, Material, ↑/↓, löschen (Positionen des Raums werden mitgelöscht, mit Rückfrage, anders als beim Import, wo sie ausgeblendet bleiben).
- Position: Nr (auto, änderbar), Titel*, Menge, Einheit (Auswahl Stk/lfm/m²/pausch + frei), Beschreibung, Möbeltyp-Vorlage (`setzeVorlage` / `pruefpunkteAusVorlage`), Löschen. Prüfpunkte: umbenennen/löschen/ergänzen mit denselben Komponenten wie im Import. Auswahl → „Verschieben nach …“.
- „Aus Vorlage einfügen“ (Auswahl der aktiven Protokoll-Vorlagen); für CEO/Admin zusätzlich „Als Vorlage speichern“ (Name + Beschreibung, nur Struktur).
- Anlegen: Prüfliste mit Problemen (Kunde, Kommission, ≥1 Raum mit ≥1 Position, Titel je Position) → Erfolgsseite wie beim Import inkl. „Auf diesem Gerät offline speichern“ → Begehung. „Verwerfen“ leert den Entwurf.

**Admin** `/abnahme/vorlagen?bereich=moebeltyp|protokoll`: Tab-Leiste, Bereich „Protokoll-Vorlagen“ mit Liste (Name, Anzahl Räume/Positionen, aktiv) und Formular: Name DE/EN, Beschreibung, aktiv, Reihenfolge, darunter Räume → Positionen (Titel, Einheit, Möbeltyp-Select, eigene Prüfpunkte als Textfeld „Deutsch | English“ via `parsePunkte`).

## 5. Einfügen einer Protokoll-Vorlage (`fuegeVorlageEin`)

- Räume nach **Name zusammenführen** (getrimmt, case-insensitiv; Etage/Material der bestehenden Räume bleiben, leere werden ergänzt), sonst neuer Raum am Ende.
- Alle Räume, Positionen, Prüfpunkte erhalten **neue IDs**, Status `offen`, `relevant = true`.
- Positionen werden ans Ende des Raums gehängt, Nr fortlaufend (höchste numerische Nr + 1); mehrfaches Einfügen dupliziert die Positionen bewusst (Raum wird nicht doppelt).
- Prüfpunkte = aktive Möbeltyp-Vorlage + eigene. Verweist `vorlageId` auf eine gelöschte/inaktive Möbeltyp-Vorlage: Position ohne diese Prüfpunkte (eigene bleiben), Rückgabe `hinweise[]` → sichtbarer Hinweis „Position ‚…‘: Möbeltyp-Vorlage nicht mehr verfügbar.“
- `quelle` wird `vorlage`.

## 6. Auswirkungen von „ohne Kommission“ (`kommission_nr` NULL)

| Stelle | Anpassung |
|---|---|
| Anzeige (Detailseite `protokoll/[id]`, Begehung `Protokollansicht`, `LokaleListe`, Ablage) | `kommissionAnzeige()` → „ohne Kommission“ (EN: „no commission“) |
| Ablage / `listAblage` | Filter-Select „Kommission: alle / nur ohne Kommission“ (`kommission=ohne` → `.is("kommission_nr", null)`); Textsuche `.or(...)` ignoriert NULL ohnehin; Regieberichte bei diesem Filter ausgeblendet |
| `/api/abnahme/liste` | liefert `kommission_nr: null`, Client-Typen `string \| null` |
| PDF (`pdf/protokoll.ts`) | Kopf `[Kommission, —]` → Wert „ohne Kommission“, Fußzeile „ohne Kommission · Kunde“, PDF-Titel; Anhang „nicht Gegenstand“ erscheint bereits nur bei ausgeblendeten Positionen (Zeile 428 ff., wird per Test abgesichert) |
| Dateiname (`filename.ts`) | `Abnahme_ohne-Kommission_<Kunde-kurz>_<JJJJ-MM-TT>.pdf` (`AblageAktionen.tsx`, `/api/abnahme/pdf`) |
| `/api/abnahme/pdf` | `Positionsliste_${kommission_nr}` nur bei vorhandenem `original_path` (manuell: nicht vorhanden → null-sicher) |
| Sync (`/api/abnahme/sync`) | 422-Prüfung nur noch auf Kunde; `quelle` wird **nicht** aus dem Client übernommen (Server ist Quelle der Wahrheit, sonst würde ein vor dem Update geladenes Tablet-Dokument `manuell` auf `profacto` zurücksetzen) |
| Versand (`versand-server.ts`) | Betreff/Text ohne Kommissionsteil („Abnahmeprotokoll – Kunde“) |
| Nachtrag (`nachtrag.ts`) | übernimmt leere Kommission und `quelle` unverändert |
| Regiebericht | unverändert (`NOT NULL`); `/api/abnahme/kommission` filtert nur auf Regie-/Protokollzeilen mit Nummer → keine Änderung nötig. Gemeinsamer Code (Ablage, `AblageEintrag`, Löschen, Versand) wird gegen `null` geprüft und getestet. |
| Zuordnung nachträglich | `ordneKommissionZu(id, KundeKommission)` (bestehend/neu), nur online, nicht abgeschlossen, nicht ausgecheckt; Bedienung in der Detailseite („Kommission zuordnen“) |

## 7. Tests (zusätzlich zu bestehenden)

`protokoll-vorlagen.test.ts` (neue IDs, Räume zusammenführen, Nr-Vergabe, gelöschte/inaktive Möbeltyp-Vorlage → Hinweis, Mehrfach-Einfügen), `validate.test.ts` (Kunde, Kommission/ohne, Raum+Position, Titel, 6-Ziffern bei „neu“), `kommission.test.ts`, `edit.test.ts`, `filename.test` (ohne Kommission), `protokoll.test.ts` (PDF ohne Kommission rendert, Anhang nur bei ausgeblendeten), `mapping` (Round-Trip `quelle`, `kommission_nr` null).

## 8. Reihenfolge / Commits (je Schritt `npm run lint`, `npx tsc --noEmit`, `npm test`)

1. Migration + Typen/Mapping/`quelle`/Helfer (`kommission.ts`, `validate.ts`)
2. `KundeKommissionAuswahl`, `searchKommissionen`, Einbau in den Import, `legeProtokollAn` erweitert
3. `edit.ts`, `StrukturEditor` (aus `ImportWizard` extrahiert, Import verhält sich unverändert), `/abnahme/neu`, `/abnahme/neu/manuell`, Entwurf
4. Protokoll-Vorlagen: Tabelle-Zugriff, Admin-Bereich, Einfügen, „Als Vorlage speichern“
5. „ohne Kommission“ in PDF/Ablage/Sync/Versand/Nachtrag/Zuordnung
6. Version 1.2.0, Changelog, `DECISIONS.md`, `docs/ABNAHME.md`

Nichts wird auf `main` gepusht oder deployt.

## 9. Risiken

- **Migration muss vor dem Browsertest laufen** (Spalte `quelle`, nullable Nummer, neue Tabelle) – ich führe sie nicht aus. Der Code liest `quelle`/Vorlagen-Tabelle fehlertolerant, damit ein Deployment vor der Migration die Ablage nicht zerlegt (Select von `quelle` nur dort, wo nötig; Vorlagen-Laden mit verständlicher Fehlermeldung wie in `import/page.tsx`).
- **Commission-Anlage wirkt app-weit** (Laufzettel etc. sehen die neue Kommission) – wie bisher beim Import. Wird `createCommission` ausgeführt und `insertProtokoll` scheitert danach, bleibt die Kommission bestehen; erneutes Speichern findet sie (Duplikat-Hinweis: „bitte auswählen“).
- Gleichzeitiges Anlegen derselben Nummer: Unique-Constraint auf `commission_number` greift, Fehlermeldung wird angezeigt.
- Tablet mit bereits geladenem Dokument ohne `quelle`: unkritisch (siehe Sync).
- `styles/abnahme.css` hat fremde uncommittete Änderungen → eigene CSS-Datei, kein Konflikt beim Stagen.
- Browsertest mit Live-Datenbank erzeugt Testdaten (siehe Frage 3).

## 10. Option / offen (nicht gebaut)

- **Offline-Anlegen** auf dem Tablet (Kommissionssuche aus lokalem Cache): würde einen Kommissions-Cache in IndexedDB, Sync-Anlage nicht existierender Protokolle (Sync liefert heute 410 für unbekannte IDs) und Konfliktregeln brauchen. Aufwand mittel bis groß.
- **Regiebericht mit derselben Auswahl inkl. „ohne Kommission“**: `KundeKommissionAuswahl` ist wiederverwendbar; es bräuchte eine Migration (`abnahme_regieberichte.kommission_nr` nullable), Anpassungen in `RegieEditor`, `regie-neu.ts`, PDF, Dateiname, Sync. Mittel.
