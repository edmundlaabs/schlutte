# Auftrag: Schlutte – einheitliche Navigation, Layout und Modulstruktur

Arbeitsverzeichnis: `schlutte_develop` (Next.js 16 + Supabase, Repo github.com/edmundlaabs/schlutte).

## Vorher lesen
1. `CLAUDE.md`, `AGENTS.md` (Next.js 16: Doku in `node_modules/next/dist/docs/` lesen, v. a. Layouts, Route Groups, Redirects, `proxy.ts`), `DECISIONS.md`
2. `lib/apps.ts` (App-Register, `resolveAppAccess`), `lib/auth/app-access.ts` (`requireAppAccess`), `lib/auth/app-role.ts`
3. Heutige Rahmen: `components/shell/Topbar.tsx`, `app/(app)/layout.tsx`, `components/intranet/IntranetHub.tsx` + `app/start/page.tsx`, `app/auslagen/layout.tsx` + `AuslagenNav.tsx`, `app/gerda/layout.tsx`
4. `docs/PLAN-ZUSAMMENFUEHRUNG.md`, `proxy.ts`, `next.config.ts`
5. Styles: `styles/tokens.css`, `styles/app.css`, `styles/intranet.css`, `styles/auslagen.css`

## Problem
- Vier verschiedene Rahmen: Hub `/start` (sch-topbar), Werkstatt-Topbar in `(app)` (grb-topbar), Auslagen mit eigener Nav, Gerda ohne Nav.
- Die Werkstatt-Nav (Dashboard, Kommissionen, Archiv, Vorlagen, Mitarbeiter) erscheint auch in Bestellliste, PandaCAD, Personal, Mitarbeiter.
- „Dashboard“ auf `/` ist die Werkstatt, die echte Startseite liegt auf `/start`.
- Mitarbeiterverwaltung (global) hängt in der Werkstatt-Nav.
- Feedback doppelt (Topbar-Link + FAB), Suche und „Vorlagen“ sind tote/deaktivierte Elemente.

## Ziel
### 1. Ein Rahmen für alle Seiten (`components/shell/AppShell.tsx`)
- Zeile 1, global und überall gleich: Logo (→ `/`) · App-Wechsler (Dropdown, nur freigeschaltete Apps, gruppiert) · Breadcrumb mit Name der aktuellen App · Feedback-Icon (→ `/feedback`) · Avatar-Menü (Name, Rolle, „Mein Konto“, „Passwort ändern“, „Admin“ nur für CEO/Admin, „Abmelden“). App-installieren-Button ins Avatar-Menü.
- Suche: ausblenden, bis es eine globale Suche gibt (keine toten Elemente).
- Zeile 2, je App: Unternavigation als Tabs. Mobil (< 768 px) als Tab-Leiste unten, wie heute `AuslagenNav` (Variante `tabs`).
- Feedback-FAB entfernen.
- Benutzerdaten (Name, Kürzel, Rolle, freigeschaltete Apps) serverseitig im Layout laden und als Props übergeben, nicht wie heute clientseitig in der Topbar nachladen.

### 2. App-Register erweitern (`lib/apps.ts`), eine Quelle für Start, Wechsler und Tabs
Pro App ergänzen: `href`, `group`, `icon`, `nav: { label, href, match?, finance? }[]`. Kurze Titel:
- Werkstatt und Lager: `werkstatt` „Werkstatt“ (Übersicht, Kommissionen, Archiv), `warenbestand` „Warenbestand“ (extern, bis portiert), `bestellliste` „Bestellliste“
- Büro und Personal: `personal` „Personal“, `auslagen` „Auslagen“ (Belege, Anträge, Eingang*, Profil, Abgleich*, Einstellungen*; * = finance), `urlaub` „Urlaub“ (live: false)
- Planung und Tools: `gerda` „Gerda“, `projekte` „Projekte“ (live: false), `pandacad` „PandaCAD“
`AppKey`s NICHT ändern (stehen in `employees.app_access` und in RLS `has_app_access`). `AuslagenNav` und die Kacheln in `IntranetHub` aus dem Register rendern statt eigener Listen.

### 3. Startseite auf `/`
- Begrüßung + Datum/KW wie heute.
- Apps gruppiert in drei Spalten nach `group`, nur freigeschaltete; `live: false` dezent mit „bald“, nicht klickbar.
- Darunter zwei Blöcke: „Zu erledigen“ (heute: eingereichte Auslagenanträge für CEO/Admin) und „Termine und Geburtstage“.
- Self-Provisioning und `?kein-zugriff=` aus `app/start/page.tsx` übernehmen; `requireAppAccess` muss danach auf `/` statt `/start` umleiten.

### 4. Routen
| Neu | Heute |
|---|---|
| `/` | `/start` |
| `/werkstatt` | `/` (Werkstatt-Dashboard) |
| `/werkstatt/kommissionen/...` | `/kommissionen/...` |
| `/werkstatt/archiv` | `/archiv` |
| `/werkstatt/dokument-erstellen/...` | `/dokument-erstellen/...` |
| `/admin/mitarbeiter/...` | `/mitarbeiter/...` |
| `/admin/zugaenge` | `/mitarbeiter/zugaenge` |
| `/admin/feedback` | Feedback-Liste (Eingang für Admin); `/feedback` bleibt das Formular für alle |
`/personal`, `/auslagen`, `/bestellliste`, `/pandacad`, `/gerda` bleiben. `/vorlagen` vorerst entfernen (tot), Redirect auf `/werkstatt`. `/print/...` und `/print-personal/...` unverändert lassen (Druckansichten ohne Shell).
- Alte URLs per permanentem Redirect in `next.config.ts` (`redirects()`), inkl. Unterpfade. Interne Links, `revalidatePath`- und `redirect`-Aufrufe in Server Actions auf neue Pfade umstellen (grep nach allen alten Pfaden, Liste im Plan aufführen).
- `/admin/*`: Layout mit `hasAdminRights`-Prüfung (wie heute `mitarbeiter/layout.tsx`), sonst Redirect auf `/`.
- `requireAppAccess(key)` bleibt in jedem App-Layout. RLS unverändert.

### 5. Gerda und Auslagen in den Rahmen holen
- Gerda: Shell drumherum, Gerda-eigene Kopfzeile prüfen, keine doppelte Navigation. Gerda-CSS darf die Shell nicht überschreiben (CSS-Ebenen beachten, siehe letzter Commit).
- Auslagen: eigene Kopfzeile durch die Shell ersetzen, Tabs aus dem Register.

## Arbeitsregeln
- Zuerst `git status` prüfen; offene Änderungen nicht überschreiben, bei Unklarheit fragen.
- Erst einen Plan schreiben (Dateien, verschobene Routen, Redirect-Liste, Risiken) und mir zeigen. Bauen erst nach meinem OK.
- Eigener Branch `feature/navigation-shell`. Nichts auf main pushen, nichts deployen.
- Keine DB-Migrationen, keine Datenänderungen in diesem Auftrag.
- Bestehende Tokens und Styles nutzen, Inline-Styles der Topbar in CSS-Klassen überführen. Keine neuen Libraries ohne Rückfrage. Schrift und Farben bleiben wie in `tokens.css`.
- In Schritten committen: (1) Register + AppShell, (2) Startseite auf `/`, (3) Routen-Umzug + Redirects, (4) Admin-Bereich, (5) Gerda/Auslagen in die Shell, (6) Aufräumen alter Komponenten (`Topbar`, `sch-topbar`).
- Nach jedem Schritt `npm run lint` und `npx tsc --noEmit`, Fehler selbst beheben.
- Am Ende im Browser prüfen (Desktop + Mobilbreite 390 px) und berichten: als Admin und als normaler Mitarbeiter mit nur 2 freigeschalteten Apps. Prüfen: Wechsler zeigt nur freigeschaltete Apps, Admin-Menü nur für Admin, alle alten URLs leiten korrekt weiter, Druckansichten ohne Shell.
- `lib/changelog.ts` und `lib/version.ts` ergänzen, `DECISIONS.md` um die neue Struktur ergänzen.
- Unklar → nachfragen statt raten.

## Ergebnis
Kurzer Bericht: was umgezogen ist, Redirect-Tabelle, offene Punkte.
