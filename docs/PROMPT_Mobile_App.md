# Auftrag: Schlutte als Handy-App (PWA) – Einrichtung, QR-Code, Mobile-Fixes

Arbeitsverzeichnis: `schlutte_develop` (Next.js 16 + Supabase, Repo github.com/edmundlaabs/schlutte, live: https://schlutte.vercel.app).

## Vorher lesen
1. `CLAUDE.md`, `AGENTS.md` (Next.js 16: Doku in `node_modules/next/dist/docs/` lesen, v. a. Metadata/Manifest, Viewport, `proxy.ts`), `DECISIONS.md`
2. Heutige Installation: `components/shell/InstallAppButton.tsx`, `components/shell/ShellHeader.tsx` (Avatar-Menü), `app/globals.css` (`.install-app*`), `app/layout.tsx`, `app/(app)/auslagen/layout.tsx`
3. Manifeste und Icons: `public/schlutte.webmanifest`, `public/auslagen.webmanifest`, `public/icons/*`, `public/brand/*`
4. Shell und Styles: `styles/shell.css`, `styles/tokens.css`, `styles/app.css`, `styles/intranet.css`, `styles/auslagen.css`, `app/(app)/gerda/gerda.css`
5. `proxy.ts` (öffentliche Pfade), `next.config.ts` (Redirects), `docs/AUSLAGEN-SETUP.md` (Abschnitt „iPhone ohne App Store“)

## Befund (live geprüft am 17.11.2026, 390 × 844 px, eingeloggt als Mitarbeiter „Tester MA“)

### Installation
- **QR-/Anleitungs-Popover ist auf dem Handy unsichtbar.** Avatar-Menü → „Als App“ öffnet das Popover, es liegt aber bei y = 852 px, also unterhalb des Bildschirms. Ursache prüfen: `.install-app-popover` ist im Mobil-Breakpoint `position: fixed`, sitzt aber im Avatar-Menü (vermutlich Containing Block durch einen Vorfahren oder falsch greifende `top`-Regel). Hover-Logik (`onMouseEnter/Leave`) passt nicht zu Touch.
- Auf dem Handy ist ein QR-Code zum Scannen sinnlos – dort braucht es direkt die Schritte.
- `APP_URL` ist in `InstallAppButton.tsx` hart codiert.
- Manifest: `start_url` ist `/start` (leitet nur per Redirect auf `/`). Icons sind die **Beleg-Icons** (Quittung) – für die ganze Schlutte falsch. `public/auslagen.webmanifest` wird nirgends mehr eingebunden (auch Auslagen nutzt `schlutte.webmanifest`), `docs/AUSLAGEN-SETUP.md` beschreibt noch die eigene „Belege“-App.
- Kein Service Worker (`/sw.js` 404) – für iOS-Home-Bildschirm nicht nötig, siehe Arbeitsregeln.

### Responsive (Seitenbreite > 390 px = horizontales Scrollen)
| Seite | scrollWidth | Problem |
|---|---|---|
| `/werkstatt` | 903 px | Suchfeld, Button-Reihe („Neue Kommission“, „Archiv“) und Dokument-Kacheln (`grb-action-tile`) laufen rechts raus |
| `/werkstatt/kommissionen` | 827 px | Tabelle (Nr., Kunde, Status, Dokumente) zu breit, „Neue Kommission“-Button abgeschnitten |
| `/bestellliste` | 546 px | `aside` zu breit; Formularfelder zu eng (Platzhalter „Optior…“ abgeschnitten) |
| `/gerda` | 391 px | Badge „ALLE“ ragt neben „Gesamtübersicht“ raus; 123 Bedienelemente unter 32 px Höhe; **Server antwortet mit HTTP 500** (Seite rendert danach clientseitig) – Vercel-Logs prüfen |

Ohne horizontales Scrollen: `/`, `/werkstatt/archiv`, `/warenbestand`, `/personal`, `/personal/oberflaeche`, `/auslagen` (+ Belege, Erfassen, Anträge, Profil), `/pandacad`, `/feedback`, `/konto`.

Eingabefelder mit Schrift < 16 px (iOS zoomt beim Antippen hinein): `/auslagen/erfassen` (2), `/bestellliste` (1), `/gerda` (5), `/pandacad` (7), `/feedback` (7).

**Nicht geprüft** (Tester ohne Rechte): `/admin/*`, `/auslagen/eingang`, `/abgleich`, `/einstellungen`, `/werkstatt/dokument-erstellen/*`, Kommissions-Detail. Diese als Admin selbst prüfen.

## Ziel

### 1. Einrichtung im Gerät erkennen und richtig anleiten
`InstallAppButton` neu aufbauen (Name darf bleiben), Gerät erkennen:
- **iPhone/iPad, Safari:** Bottom-Sheet (kein Hover-Popover) mit den Schritten, ohne QR-Code.
- **iPhone/iPad, anderer Browser (Chrome, Firefox, In-App-Browser von Mail/WhatsApp):** Hinweis „In Safari öffnen“ + „Link kopieren“, darunter die Safari-Schritte.
- **Android Chrome/Edge:** Button „App installieren“ über `beforeinstallprompt`; fehlt das Event, Anleitung über das ⋮-Menü.
- **Desktop:** wie heute QR-Code + „Link kopieren“, Popover im Avatar-Menü korrekt sichtbar.
- Bereits installiert (`display-mode: standalone` oder `navigator.standalone`): Menüpunkt ausblenden.
- URL nicht hart codieren: `NEXT_PUBLIC_APP_URL`, Fallback `window.location.origin`.
- Sheet per Klick/Tap öffnen und schließen, Escape, Fokus im Dialog, Tap außerhalb schließt.

Texte (so übernehmen, kurze Abweichungen ok):
- Titel: „Schlutte aufs Handy“
- iOS Safari: „1. Unten auf **Teilen** tippen (Quadrat mit Pfeil) · 2. Nach unten scrollen, **Zum Home-Bildschirm** wählen · 3. **Hinzufügen** tippen. Danach Schlutte vom Home-Bildschirm starten und einmal anmelden.“
- iOS anderer Browser: „Die Installation klappt am zuverlässigsten in Safari. Link kopieren, in Safari einfügen und dort zum Home-Bildschirm hinzufügen.“
- Android: „Auf **App installieren** tippen. Falls der Button fehlt: oben rechts ⋮ → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.“
- Desktop: „Mit der Handykamera scannen. Der Link öffnet Schlutte auf dem Handy, dort dann wie angezeigt zum Home-Bildschirm hinzufügen.“

### 2. Einmaliger Hinweis auf dem Handy
- Auf Mobilgeräten, nicht installiert: dezenter Hinweis-Streifen über der Tab-Leiste bzw. unter der Kopfzeile: „Schlutte als App nutzen – Einrichten“ · „×“. „Einrichten“ öffnet das Sheet aus 1.
- Nach „×“ 30 Tage nicht mehr zeigen (`localStorage`, mit try/catch). Nicht auf `/login`, `/print*`, nicht in Standalone.

### 3. Öffentliche Einrichtungsseite `/app` + QR-Code
- Neue Seite `/app` ohne Login (in `proxy.ts` als öffentlich freigeben), ohne Shell: Logo, gerätespezifische Anleitung aus 1., Button „Zur Anmeldung“ → `/login?next=/`.
- Der QR-Code (Desktop-Popover und Aushang) zeigt auf `<APP_URL>/app`, nicht auf `/`.
- Druckbarer Aushang A4 unter `/print/app-aushang` (wie die anderen Druckansichten ohne Shell): großer QR-Code, Titel „Schlutte aufs Handy“, die drei iPhone-Schritte und die Android-Kurzform, Grabner-Branding aus `tokens.css`. Link dazu im Admin-Bereich.
- QR-Code weiter mit der vorhandenen Library `qrcode` erzeugen (lokal, keine externe API), Fehlerkorrektur M, Farben aus den Tokens.

### 4. Manifest, Icons, Standalone
- `schlutte.webmanifest`: `start_url: "/"`, `id` bleibt `"/start"` (sonst sehen Android-Geräte eine neue App). `display: standalone`, `scope: "/"`, Farben aus Tokens. Optional `shortcuts`: „Beleg erfassen“ (`/auslagen/erfassen`), „Bestellliste“ (`/bestellliste`).
- **Eigenes Schlutte-Icon** statt Quittung: Entwurf auf Basis von `public/brand/grabner-schlutte-logo.svg` bzw. dem g-Zeichen, dunkler Grund wie heute. Mir den Entwurf zeigen, bevor die PNGs erzeugt werden. Größen: 180 (apple-touch-icon), 192, 512, 512 maskable (Safe Zone 80 %). Dateinamen `schlutte-*.png`, Referenzen in Manifest und `app/layout.tsx` anpassen; Beleg-Icons erst löschen, wenn nichts mehr darauf verweist.
- `public/auslagen.webmanifest` entfernen oder bewusst wieder einbinden – Vorschlag im Plan, `docs/AUSLAGEN-SETUP.md` (Abschnitt iPhone) passend umschreiben.
- Standalone prüfen: Safe Areas oben (Kopfzeile) und unten (Tab-Leiste, `env(safe-area-inset-bottom)`), Statusleiste hell/dunkel, Pull-to-Refresh/Überscrollen, Anmeldung bleibt nach App-Neustart erhalten.
- Links, die im Standalone-Modus ohne Zurück-Button enden würden (PDF-Ansichten, Downloads, `mailto:`, externe Seiten wie Warenbestand), prüfen: in neuem Tab bzw. per Teilen-Funktion öffnen.

### 5. Responsive-Fixes
- Alle Seiten aus der Tabelle oben auf 375, 390 und 430 px ohne horizontales Scrollen. Tabellen (Kommissionen, ggf. Admin-Mitarbeiter, Zugänge-Matrix) mobil als Kartenliste oder in einem bewusst horizontal scrollbaren Container mit sichtbarem Hinweis – nicht die ganze Seite verbreitern.
- Button-Reihen umbrechen bzw. volle Breite; Kachel-Raster einspaltig.
- Eingabefelder mobil mindestens 16 px Schrift; Touch-Ziele mindestens 44 × 44 px (Gerda-Filter, Checkboxen, Tab-Leiste).
- Gerda-CSS nur innerhalb von Gerda anpassen, keine Shell-Regeln überschreiben.
- Gerda-HTTP-500 beim Server-Rendering finden und beheben.

## Arbeitsregeln
- Zuerst `git status` prüfen; offene Änderungen nicht überschreiben (aktuell untracked: `docs/PROMPT_*.md`, `graphify-out/`), bei Unklarheit fragen.
- Erst einen Plan schreiben (Dateien, Erkennungslogik je Gerät, Icon-Entwurf, Liste der CSS-Fixes je Seite, Risiken) und mir zeigen. Bauen erst nach meinem OK.
- Eigener Branch `feature/mobile-app` vom aktuellen `main`. Nichts auf main pushen, nichts deployen.
- Keine DB-Migrationen, keine Datenänderungen.
- Kein Service Worker und kein Offline-Modus in diesem Auftrag (Daten müssen aktuell sein, iOS braucht ihn für den Home-Bildschirm nicht). Falls Android ohne ihn nicht installierbar ist: melden, nicht eigenmächtig einbauen.
- Bestehende Tokens, Schrift und Farben aus `tokens.css`. Keine neuen Libraries ohne Rückfrage.
- In Schritten committen: (1) Responsive-Fixes, (2) Gerda-500, (3) Install-Sheet + Hinweis, (4) `/app` + Aushang, (5) Manifest + Icons, (6) Doku.
- Nach jedem Schritt `npm run lint` und `npx tsc --noEmit`, Fehler selbst beheben.
- Am Ende im Browser prüfen: 375, 390, 430 und 768 px sowie Desktop; als Admin und als Mitarbeiter mit 2 freigeschalteten Apps. Je Seite `document.documentElement.scrollWidth` gegen die Viewport-Breite messen und tabellarisch berichten. Install-Sheet in allen vier Gerätevarianten (User-Agent-Emulation) zeigen.
- `lib/changelog.ts`, `lib/version.ts`, `DECISIONS.md` ergänzen.
- Unklar → nachfragen statt raten.

## Ergebnis
Kurzer Bericht: Messwerte vorher/nachher je Seite, Screenshots Install-Sheet (iOS Safari, iOS Chrome, Android, Desktop), Link zum Aushang, offene Punkte. Danach teste ich selbst auf dem iPhone (Safari → Home-Bildschirm → Anmeldung → App-Neustart).
