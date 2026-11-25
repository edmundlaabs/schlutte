# Auftrag: Abnahmeprotokoll manuell anlegen (ohne Profacto-PDF) + Protokoll-Vorlagen

Arbeitsverzeichnis: `schlutte_develop` (Next.js 16 + Supabase). Modul `/abnahme` existiert bereits (1.1.0 / 1.1.2, siehe `docs/ABNAHME.md`, `docs/PLAN_ABNAHME.md`).

## Worum es geht
Bisher entsteht ein Abnahmeprotokoll nur über den Import einer Profacto-PDF (`/abnahme/import`, `components/abnahme/ImportWizard.tsx`). Neu: Ein Protokoll lässt sich auch **komplett von Hand** anlegen – Kunde/Kommission auswählen oder neu anlegen, Räume, Positionen und Prüfpunkte selbst eingeben, wahlweise aus Vorlagen. Begehung, Offline, Unterschriften, PDF, Ablage und Versand bleiben unverändert und müssen mit manuell angelegten Protokollen genauso funktionieren.

## Vorher lesen
1. `CLAUDE.md`, `AGENTS.md` (Next.js 16: Doku in `node_modules/next/dist/docs/`), `DECISIONS.md`, `docs/ABNAHME.md`, `docs/PLAN_ABNAHME.md`
2. Import-Ablauf: `app/(app)/abnahme/import/page.tsx`, `components/abnahme/ImportWizard.tsx`, `app/(app)/abnahme/actions.ts` (`legeProtokollAn`, `findeKommissionAction`)
3. Daten: `lib/data/abnahme.ts` (`findKommission`, `insertProtokoll`, `getVorlagen`), `lib/data/commissions.ts` (`createCommission`), `lib/abnahme/types.ts`, `mapping.ts`, `vorlagen.ts`, `logic.ts`
4. Vorlagen-Admin: `app/(app)/abnahme/vorlagen/*`, `components/abnahme/VorlagenEditor.tsx`
5. Migration `supabase/migrations/20261120_abnahme.sql` (Constraints, Sperr-Trigger, RLS)
6. Stellen, die `kommissionNr` / `original_path` / Profacto-Felder voraussetzen: PDF (`lib/abnahme/pdf/*`), Dateiname (`lib/abnahme/filename.ts`), Sync (`lib/abnahme/offline/sync.ts`, `/api/abnahme/sync`), Ablage/Filter (`app/(app)/abnahme/page.tsx`, `/api/abnahme/liste`), Versand, Nachtrag
7. **Live-Schema von `commissions` prüfen** (Code nutzt `commission_number`, `customer_name`, `project_name`; `schema.sql` weicht ab).

## Ziel

### 1. Einstieg „Neues Protokoll“
- In der Ablage und Seitenleiste ein Einstieg **„Neues Protokoll“** mit zwei Wegen:
  - **Aus Profacto-PDF** → bestehender Import (unverändert, nutzt aber die neue Kunden-/Kommissionsauswahl aus Punkt 2)
  - **Manuell / aus Vorlage** → neuer Editor
- Route/Struktur im Plan vorschlagen (z. B. `/abnahme/neu`). Anlegen ist online (Werkstatt oder Tablet mit Netz), wie der Import. Danach wie gehabt optional direkt auf dem Gerät offline speichern.

### 2. Kunde mit Kommission auswählen oder anlegen (gemeinsame Komponente für Import und manuell)
- **Suchfeld** (Typeahead) über `commissions`: Treffer nach Kommissionsnummer **und** Kundenname, Anzeige „260081 · Emily Hoon & Stephan Raemy · Einbauschränke …“. Auswahl übernimmt Nummer, Kunde, Projekt.
- **Neu anlegen**: Kommissionsnummer + Kundenname + Projekt. Nummer wird auf Format und Duplikat geprüft (bestehende Validierung in `createCommission` nutzen). Anlegen erst beim Speichern des Protokolls, nicht beim Tippen.
- **Ohne Kommission** erlauben (Kleinaufträge): Schalter „ohne Kommissionsnummer“. Dann nur **Kundenname Pflicht** (+ Projekt optional), keine Zeile in `commissions`, `commission_id = null`.
  - Dafür muss `abnahme_protokolle.kommission_nr` nullable werden (heute `not null` + Längen-Check) → neue Migration.
  - Überall sauber behandeln: Anzeige „ohne Kommission“, Ablage-Filter (eigener Filterwert), PDF-Kopf und Fußzeile, Dateiname `Abnahme_ohne-Kommission_<Kunde-kurz>_<JJJJ-MM-TT>.pdf`, Sync, Versand, Nachtrag.
  - Nachträglich eine Kommission zuordnen können (solange nicht abgeschlossen).
- Kundenname bleibt am Protokoll editierbar (Profacto-Fall). Weitere Kundendaten (Adresse, Telefon) werden **nicht** in `commissions` gespeichert; Ort und Kunden-E-Mail bleiben Felder am Protokoll wie bisher.
- Regiebericht: unverändert lassen, aber prüfen, dass gemeinsamer Code mit `kommission_nr = null` nicht bricht. Ob der Regiebericht dieselbe Auswahl bekommt, im Plan als Option nennen, nicht bauen.

### 3. Manueller Editor: Räume, Positionen, Prüfpunkte
- Kopf: Kunde/Kommission (Punkt 2), Projekt, Ort/Baustelle, Sprache DE/EN, Kunden-E-Mail optional. Durchführender Mitarbeiter = angemeldeter Nutzer (wie bisher).
- **Räume**: anlegen, umbenennen, Etage, optional Materialangaben, Reihenfolge ändern, löschen.
- **Positionen** je Raum: Nr. (automatisch fortlaufend, änderbar), Titel (Pflicht), Menge, Einheit (Stk, lfm, m², pausch), Beschreibung/Langtext optional, **Möbeltyp-Vorlage** wählbar → Prüfpunkte kommen aus `abnahme_vorlagen` (bestehende Logik `pruefpunkteAusVorlage`). Ohne Vorlage: Position als Ganzes abnehmen.
- **Prüfpunkte**: aus Vorlage übernehmen und zusätzlich eigene ergänzen, umbenennen, löschen (gleiche Komponenten/Logik wie im Import und in der Begehung wiederverwenden, nichts doppelt bauen).
- Positionen zwischen Räumen verschieben (Auswahl → „Verschieben nach …“ wie im Import).
- Validierung beim Anlegen: Kunde Pflicht, Kommissionsnummer Pflicht außer bei „ohne Kommission“, mind. ein Raum mit mind. einer Position. Kein `original_path` → PDF-Anhang „nicht Gegenstand der Abnahme“ entfällt bzw. wird nur gezeigt, wenn es ausgeblendete Positionen gibt.
- Entwurf nicht verlieren: Eingaben bis zum Anlegen lokal zwischenspeichern (IndexedDB oder localStorage, im Plan begründen), „Verwerfen“ wie beim Import.
- `legeProtokollAn` erweitern oder eine zweite Action – im Plan entscheiden. Kennzeichnung der Herkunft (`quelle`: `profacto` | `manuell` | `vorlage`) am Protokoll speichern.

### 4. Protokoll-Vorlagen (neu)
- Neuer Vorlagentyp neben den Möbeltyp-Vorlagen: **komplette Sets aus Räumen + Positionen + Prüfpunkten** (z. B. „Einbauschrank-Projekt Standard“, „Küche“, „Garderobe + Flur“).
- Positionen in der Protokoll-Vorlage können auf eine Möbeltyp-Vorlage verweisen und/oder eigene Prüfpunkte haben.
- Pflege unter `/abnahme/vorlagen` (CEO/Admin, wie bisher) mit zwei Bereichen: **Möbeltyp-Vorlagen** | **Protokoll-Vorlagen**. DE/EN-Texte wie bei den bestehenden Vorlagen.
- Im manuellen Editor: „Aus Vorlage einfügen“ → Vorlage wählen → Räume/Positionen/Prüfpunkte werden übernommen (neue IDs, Status offen). Mehrfach einfügbar; gleichnamige Räume zusammenführen statt doppelt anlegen. Danach frei änderbar.
- Zusätzlich für CEO/Admin: „Als Vorlage speichern“ aus dem Editor (übernimmt nur Struktur, keine Kunden-/Kommissionsdaten).
- Datenmodell im Plan festlegen (eigene Tabelle z. B. `abnahme_protokoll_vorlagen` mit `name`, `beschreibung`, `aktiv`, `sort`, Struktur als `jsonb` oder normalisiert – begründen). RLS wie `abnahme_vorlagen` (lesen mit `has_app_access('abnahme')`, schreiben CEO/Admin). Ein bis zwei Startvorlagen aus den bestehenden Möbeltyp-Vorlagen als Seed.
- Verweist eine Protokoll-Vorlage auf eine gelöschte/inaktive Möbeltyp-Vorlage: beim Einfügen Hinweis, Position ohne diese Prüfpunkte übernehmen.

## Arbeitsregeln
- Zuerst `git status` und Branch-Stand prüfen: aktuell ausgecheckt ist `feature/abnahme-loeschen` (1.1.2), untracked `docs/design/`, `graphify-out/` – nicht anfassen. Prüfen, ob `feature/abnahme-loeschen` schon in `main` ist. Wenn nicht: neuen Branch `feature/abnahme-manuell` **von `feature/abnahme-loeschen`** abzweigen und das im Plan sagen; bei Unklarheit fragen.
- **Erst einen Plan schreiben** (Dateien, UI-Ablauf mit kurzer Skizze, Migration, Auswirkungen von `kommission_nr = null` auf alle betroffenen Stellen, Datenmodell Protokoll-Vorlagen, Wiederverwendung bestehender Komponenten, Risiken) und mir zeigen. Bauen erst nach meinem OK.
- Migration als neue Datei unter `supabase/migrations/` (z. B. `20261125_abnahme_manuell.sql`), **nicht ausführen** – ich führe sie aus. Bestehende Daten dürfen nicht verändert werden; Sperr-Trigger berücksichtigen.
- Keine neuen Libraries ohne Begründung im Plan. Tokens, Schrift, Farben aus `tokens.css`, Optik wie bestehende Abnahme-Seiten. Tablet-tauglich: Touch-Ziele ≥ 44 px, Eingaben ≥ 16 px.
- Tests ergänzen: Vorlage einfügen (IDs neu, Räume zusammenführen), Validierung, Dateiname/PDF ohne Kommission, Mapping `quelle`.
- In Schritten committen: (1) Migration + Typen, (2) Kunden-/Kommissionsauswahl (auch im Import), (3) manueller Editor, (4) Protokoll-Vorlagen Admin + Einfügen, (5) Anpassungen PDF/Ablage/Sync/Versand für „ohne Kommission“, (6) Doku.
- Nach jedem Schritt `npm run lint`, `npx tsc --noEmit`, `npm test`; Fehler selbst beheben.
- Nichts auf `main` pushen, nichts deployen.
- Am Ende im Browser prüfen (768 × 1024 und 1280 × 800): manuelles Protokoll mit neuer Kommission, mit bestehender Kommission, ohne Kommission; aus Protokoll-Vorlage; danach Begehung offline, Abschluss, PDF, Sync, Ablage-Filter.
- `lib/changelog.ts`, `lib/version.ts` (Vorschlag 1.2.0), `DECISIONS.md`, `docs/ABNAHME.md` ergänzen.
- Unklar → nachfragen statt raten.

## Noch offen (im Plan als Frage an mich)
- Soll das manuelle Anlegen später auch offline auf dem Tablet möglich sein (Kommissionssuche dann nur aus lokalem Cache)? Jetzt nicht bauen.
- Regiebericht dieselbe Kunden-/Kommissionsauswahl inkl. „ohne Kommission“? Jetzt nicht bauen.

## Ergebnis
Kurzer Bericht: was gebaut wurde, Migration zum Ausführen, Screenshots (Neues Protokoll – Auswahl, Kundensuche, Editor mit Räumen/Positionen/Prüfpunkten, Vorlage einfügen, Vorlagen-Admin, PDF ohne Kommission), Testergebnis, offene Punkte.
