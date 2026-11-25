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
    version: "1.6.0",
    date: "26.11.2026",
    changes: [
      "Ablage: Protokolle und Regieberichte direkt in der Liste löschen (abgeschlossene nur CEO/Admin)",
      "Protokoll- und Regiebericht-Seite: „Bearbeiten“ lädt den Stand auf dieses Gerät und öffnet die Bearbeitung (Räume, Positionen, Prüfung bzw. Zeilen und Zeiten) – auch am PC, ohne Auschecken",
      "„Kopfdaten ändern“ (Kunde, Projekt, Ort, E-Mails, Bemerkung bzw. Auftraggeber, Adresse, Datum …) auf der Protokoll- und Regiebericht-Seite; Tablets gleichen die Änderung beim Sync ab",
    ],
  },
  {
    version: "1.5.1",
    date: "26.11.2026",
    changes: [
      "Begehung: Räume lassen sich direkt in der Übersicht hinzufügen, umbenennen (Name, Etage) und löschen",
    ],
  },
  {
    version: "1.5.0",
    date: "26.11.2026",
    changes: [
      "Begehung: Statusknöpfe mit Symbolen (Haken = i. O., Hammer = Mangel, X = nicht prüfbar); „Prüfpunkt entfernen“ ist jetzt dezent",
      "Begehung: Räume umbenennen, Etage ändern und löschen („Raum bearbeiten“ im Raum)",
      "Auch bei i. O. wird das Objekt fotografiert: „Foto vom Objekt“ an jeder Position (mehrere möglich), im PDF unter den Prüfpunkten, im Abgleich und im Archiv enthalten",
      "Behoben: die Auswahlkarten unter „Neues Protokoll“ überschrieben das Entfernen-Symbol der Prüfpunkte",
    ],
  },
  {
    version: "1.4.0",
    date: "26.11.2026",
    changes: [
      "Abnahme: Kein Auschecken mehr – auch beim Regiebericht dürfen mehrere Geräte parallel arbeiten; beim Sync gleicht „Abgleichen“ abweichende Stände ab, beide Stände werden archiviert",
      "Regieberichte löschen (auf der Regiebericht-Seite, inkl. Zeilen, Unterschrift, PDF und Versandprotokoll); abgeschlossene nur CEO/Admin",
    ],
  },
  {
    version: "1.3.0",
    date: "26.11.2026",
    changes: [
      "Abnahme: Kein Auschecken mehr bei Protokollen – mehrere Geräte und das Büro dürfen dasselbe Protokoll bearbeiten",
      "Beim Sync wird der Server-Stand geprüft. Weicht er ab, öffnet „Abgleichen“ eine Liste aller Unterschiede; je Eintrag wählst du Stand dieses Geräts oder Server (hinzufügen, ersetzen, löschen). Beide Stände werden im Protokoll archiviert",
      "Durchführenden Mitarbeiter ändern: im manuellen Editor, im Abschluss der Begehung und auf der Protokollseite",
    ],
  },
  {
    version: "1.2.0",
    date: "25.11.2026",
    changes: [
      "Abnahme: „Neues Protokoll“ mit zwei Wegen – aus Profacto-PDF oder komplett manuell (Kunde und Kommission wählen, Räume, Positionen und Prüfpunkte selbst eingeben)",
      "Kunde und Kommission per Suche wählen, neu anlegen (wird erst beim Speichern angelegt) oder „ohne Kommission“ für Kleinaufträge; Kommission lässt sich nachträglich zuordnen, solange das Protokoll nicht abgeschlossen ist",
      "Protokoll-Vorlagen (CEO/Admin unter Abnahme → Vorlagen): komplette Sets aus Räumen, Positionen und Prüfpunkten, im Editor mit „Aus Vorlage einfügen“ übernehmen; „Als Vorlage speichern“ aus dem Editor",
      "Entwurf im manuellen Editor bleibt auf dem Gerät erhalten, bis das Protokoll angelegt oder verworfen wird",
      "Begehung: Knopf „Alles synchronisieren“ lädt Änderungen hoch und holt alle offenen Protokolle und Regieberichte auf das Gerät",
      "Protokolle ohne Kommission in Ablage (eigener Filter), PDF, Dateiname, Versand und Sync",
    ],
  },
  {
    version: "1.1.2",
    date: "20.11.2026",
    changes: [
      "Abnahme: Protokolle löschen (mit Original-PDF, Fotos, Unterschriften und Nachträgen); abgeschlossene Protokolle nur CEO/Admin",
      "Abnahme-Import: „Import verwerfen“, eigene Prüfpunkte je Position, Link zu den Prüfpunkt-Vorlagen",
      "Abnahme: Seitenleiste ein- und ausblendbar",
      "Auf dem Server gelöschte Protokolle werden auf dem Tablet erkannt und lassen sich lokal verwerfen",
    ],
  },
  {
    version: "1.1.1",
    date: "20.11.2026",
    changes: [
      "Abnahme im Grabner-Design-System: Seitenleiste mit g-Signet und nummerierter Navigation (auf dem Tablet schmal), neue Ablage mit Meta-Kopf, Filterzeile und nummerierten Einträgen",
      "Mangel erfassen: Fotos als Raster mit „Foto aufnehmen“-Kachel und Entfernen-Knopf, Status-Schalter als Segmentgruppe",
      "Abnahmeprotokoll-PDF neu gestaltet: offizielles Grabner-Design-Logo, nummerierte Abschnitte, Mängel mit Fotos direkt an der Position und groß in der Mängelliste, Schlussunterschriften nebeneinander",
      "Regiebericht-PDF mit offiziellem Grabner-Design-Logo",
    ],
  },
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
