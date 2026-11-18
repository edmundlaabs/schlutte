/**
 * lib/changelog.ts
 * Statisch gepflegter Changelog für die Update-Info auf der Feedback-Seite.
 * Neue Einträge oben einfügen (neueste zuerst).
 */

export type ChangelogEntry = {
  version: string;
  date: string; // "TT.MM.JJJJ"
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
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
