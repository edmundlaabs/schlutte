/**
 * lib/changelog.ts
 * Statisch gepflegter Changelog für die Update-Info auf der Feedback-Seite.
 * Neue Einträge oben einfügen (neueste zuerst).
 */

export type ChangelogEntry = {
  version: string;
  date: string; // "TT.MM.JJJJ"
  changes: string[];
  /** Optional: Inhalt des Release-Popups „Was ist neu“. Ohne highlights erscheint kein Popup. */
  highlights?: { title: string; text: string }[];
  /** Titel und Einleitung des Popups. */
  popupTitle?: string;
  popupIntro?: string;
  /** Zusätzlicher Block nur für CEO/Admin im Popup. */
  adminHighlights?: string;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "20.11.2026",
    changes: [
      "Neues Modul „Abnahme“ (Werkstatt und Lager): Profacto-Positionsliste importieren, Abnahmeprotokoll nach Räumen, Begehung auf dem Tablet auch ohne Internet (Freigaben, Mängel mit Fotos, Unterschriften), PDF in Deutsch oder Englisch",
      "Ablage mit Suche und Filtern, Download, Versand per E-Mail (Versandprotokoll) und Nachträge zu offenen Mängeln",
      "Regiebericht (Stundenbericht) digital erfassen: Arbeiten, Stunden je Rolle, Kundenunterschrift, PDF",
      "Prüfpunkt-Vorlagen je Möbeltyp im Admin pflegbar",
    ],
  },
  {
    version: "1.0.0",
    date: "18.11.2026",
    popupTitle: "Willkommen in der Schlutte 1.0",
    popupIntro: "Die Schlutte ist jetzt unsere gemeinsame Firmen-App – alles an einem Ort, mit einem Login.",
    highlights: [
      { title: "Ein Login für alles", text: "Anmeldung über Supabase, Passwort selbst zurücksetzen per E-Mail. Welche Apps du siehst, legt der Admin fest." },
      { title: "Neue Startseite", text: "Apps in drei Gruppen (Werkstatt & Lager, Büro & Personal, Planung & Tools), dazu „Zu erledigen“, Termine und Geburtstage." },
      { title: "Einheitliche Navigation", text: "Logo, App-Wechsler, Breadcrumb und Avatar-Menü oben, darunter die Tabs der App; auf dem Handy als Tab-Leiste unten." },
      { title: "Werkstatt", text: "Kommissionen anlegen, bearbeiten, durchsuchen, archivieren; Palettenlabels (intern und Versand, mehrere pro Kommission) erstellen und drucken." },
      { title: "Druckvorlagen", text: "Neue Vorlage „Auftragsoberfläche (Muster)“: A5-Labels geölt/gebeizt/lackiert, beliebige Anzahl, 2 pro A4-Blatt, Live-Vorschau." },
      { title: "Urlaub (neu)", text: "Urlaub, Überstundenabbau und Sonderurlaub beantragen, auch halbe Tage; Resturlaub und Kalender mit Feiertagen BW, Betriebsferien und Urlaubssperren." },
      { title: "Auslagen", text: "Belege erfassen und als Antrag einreichen." },
      { title: "Gerda und PandaCAD", text: "Gerda läuft jetzt in der Schlutte; PandaCAD-Installation mit Downloads für die Büro-PCs." },
      { title: "Schlutte aufs Handy", text: "Im Avatar-Menü „Als App“ zeigt die passende Anleitung für iPhone, Android oder Computer." },
      { title: "Feedback", text: "Fehler oder Wünsche jederzeit über den Feedback-Button oben melden." },
    ],
    adminHighlights:
      "Mitarbeiter, Zugänge und Feedback-Eingang findest du im Admin-Bereich. Im Urlaub gibt es den Eingang mit Genehmigen/Ablehnen, den Teamkalender mit Konflikten und die Konten. Bei Auslagen gibt es Eingang und Abgleich. Neue rote Punkte zeigen offene Vorgänge.",
    changes: [
      "Zusammenfassung 0.1.0–0.5.0: Login mit Supabase und Rollen, Werkstatt mit Kommissionen und Palettenlabels, Druckvorlage „Auftragsoberfläche (Muster)“, neue Navigation und Startseite, Schlutte als App aufs Handy, Modul „Urlaub“",
      "Admin/CEO: rote Punkte für offene Eingänge (Urlaub, Auslagen, Feedback, Registrierungen)",
      "Auslagen: Anträge können als erledigt markiert werden",
      "Hinweisfenster zu neuen Versionen",
    ],
  },
  {
    version: "0.5.0",
    date: "18.11.2026",
    changes: [
      "Neues Modul „Urlaub“: Urlaub, Überstundenabbau und Sonderurlaub beantragen, Resturlaub und Kalender mit Feiertagen, Betriebsferien und Urlaubssperren; halbe Tage möglich",
      "Für CEO und Admin: Eingang mit Genehmigen/Ablehnen (Begründung), Teamkalender mit Konfliktanzeige, Urlaubskonten, Einstellungen und Protokoll",
      "Startseite zeigt Resturlaub, offene Anträge und die nächste Abwesenheit; Admin/CEO sehen zusätzlich die Zahl offener Anträge",
    ],
  },
  {
    version: "0.4.0",
    date: "17.11.2026",
    changes: [
      "Schlutte aufs Handy: „Als App“ im Avatar-Menü zeigt je nach Gerät (iPhone Safari, iPhone mit anderem Browser, Android, Computer) die passende Anleitung; auf dem Handy erinnert ein Hinweis einmalig daran",
      "Neue Einrichtungsseite /app ohne Anmeldung und druckbarer Aushang mit QR-Code (Admin → Mitarbeiter)",
      "Eigenes Schlutte-Icon statt Beleg-Icon; die installierte App startet auf der Startseite",
      "Mobil: Werkstatt, Kommissionen, Bestellliste und Gerda laufen nicht mehr über den Bildschirmrand; Eingabefelder zoomen auf dem iPhone nicht mehr",
      "Gerda: Server-Fehler beim Laden der Seite behoben",
    ],
  },
  {
    version: "0.3.0",
    date: "17.11.2026",
    changes: [
      "Einheitlicher Rahmen für alle Seiten: Logo, App-Wechsler, Breadcrumb, Feedback und Avatar-Menü oben, darunter die Tabs der jeweiligen App; mobil als Tab-Leiste unten",
      "Die Startseite liegt jetzt auf „/“ und zeigt die Apps in drei Gruppen, dazu „Zu erledigen“ sowie Termine und Geburtstage",
      "Die Werkstatt liegt unter /werkstatt (Kommissionen, Archiv, Dokument erstellen); alte Links leiten automatisch weiter",
      "Mitarbeiter, Zugänge und Feedback-Eingang liegen im Admin-Bereich (nur CEO und Admin); das Feedback-Formular bleibt für alle erreichbar",
      "Gerda und Auslagen laufen im gemeinsamen Rahmen; der Feedback-Button unten rechts entfällt, die Warenbestand-Kachel führt zu einem Umzugshinweis",
    ],
  },
  {
    version: "0.2.0",
    date: "17.11.2026",
    changes: [
      "Neue Druckvorlage „Auftragsoberfläche (Muster)“ (A5-Label: geölt, gebeizt, lackiert)",
      "Anzahl Labels frei wählbar, Druck immer auf A4 quer mit zwei A5-Labels pro Blatt (ungerade Anzahl: letztes Blatt nur links)",
      "Schnittmarken oben und unten in der Blattmitte",
      "Live-Vorschau im Formular; die Vorlage gehört zur neuen App „Druckvorlagen Büro/Personal“ (Kachel 03) und ist in der Kommission auffindbar",
    ],
  },
  {
    version: "0.1.0",
    date: "26.05.2026",
    changes: [
      "Supabase Login und Row Level Security aktiv",
      "Kommissionen können erstellt, bearbeitet und durchsucht werden",
      "Palettenlabel intern und Palettenversand-Labels können erstellt, bearbeitet und gedruckt werden",
      "Mehrere Palettenversand-Labels pro Kommission werden unterstützt",
      "Dokumente werden als Einträge in Supabase gespeichert",
      "Begrüßung nach Tageszeit auf dem Dashboard",
      "Mitarbeiterverwaltung unter /mitarbeiter",
      "Feedbackfunktion eingebaut",
    ],
  },
];
