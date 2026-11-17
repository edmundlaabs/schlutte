'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { TaskBoard } from './components/TaskBoard';
import { useTasks } from './hooks/useTasks';
import { usePersons } from './hooks/usePersons';
import { useFeedback } from './hooks/useFeedback';
import { generatePDFReport } from './utils/generatePDF';
import { generateCSVReport } from './utils/generateCSV';
import { FileDown, MessageSquarePlus, Settings, Lightbulb, X, Plus, Trash2, Edit2, Power, PowerOff, LogOut, Printer } from 'lucide-react';
import { motion } from 'framer-motion';

export type TabType = 'Alle' | string;

export default function GerdaApp() {
  // Global Escape handler for closing modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFeedbackModalOpen(false);
        setIsServicesModalOpen(false);
        setIsSettingsModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { persons, addPerson, removePerson, renamePerson, togglePersonActive } = usePersons();
  const { getAllTasks, getTasksByPerson, renameTasksPerson, deleteTasksByPerson } = useTasks();
  const { feedbacks, addFeedback, updateFeedback, deleteFeedback } = useFeedback();

  // Tab-Counts: Anzahl offener Aufgaben pro Tab (inkl. 'Alle')
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    counts['Alle'] = getAllTasks().filter(t => !t.erledigt).length;
    persons.forEach(p => {
      counts[p.name] = getTasksByPerson(p.name).filter(t => !t.erledigt).length;
    });
    return counts;
  }, [getAllTasks, getTasksByPerson, persons]);

  const [activeTab, setActiveTab] = useState<TabType>('Alle');

  // Modals state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Forms state
  const [feedbackText, setFeedbackText] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonShortName, setNewPersonShortName] = useState('');
  const [editingPerson, setEditingPerson] = useState<{ old: string, new: string, shortName: string } | null>(null);

  const TABS: TabType[] = [
    'Alle',
    ...[...persons.filter(p => p.active)]
      .sort((a, b) => {
        const aIsEddy = a.name.toUpperCase() === 'EDDY' || (a.shortName || '').toUpperCase() === 'EDDY' || (a.shortName || '').toUpperCase() === 'EDD';
        const bIsEddy = b.name.toUpperCase() === 'EDDY' || (b.shortName || '').toUpperCase() === 'EDDY' || (b.shortName || '').toUpperCase() === 'EDD';
        const aIsHanna = a.name.toUpperCase() === 'HANNA' || (a.shortName || '').toUpperCase() === 'HNA';
        const bIsHanna = b.name.toUpperCase() === 'HANNA' || (b.shortName || '').toUpperCase() === 'HNA';

        // Eddy comes last
        if (aIsEddy && !bIsEddy) return 1;
        if (!aIsEddy && bIsEddy) return -1;

        // Hanna comes right before Eddy
        if (aIsHanna && !bIsHanna) return 1;
        if (!aIsHanna && bIsHanna) return -1;

        return a.name.localeCompare(b.name);
      })
      .map(p => p.name)
  ];

  // If a selected tab gets deleted or deactivated, fallback to 'Alle'
  if (activeTab !== 'Alle' && activeTab !== 'Feedback' && !persons.find(p => p.active && p.name === activeTab)) {
    setActiveTab('Alle');
  }

  const handleDownloadPDF = () => {
    generatePDFReport(getAllTasks(), 'Gesamt-Report');
  };

  const handleDownloadCSV = () => {
    generateCSVReport(getAllTasks(), 'Gesamt-Report');
  };

  const submitFeedback = () => {
    if (feedbackText.trim()) {
      addFeedback(feedbackText);
      setFeedbackText('');
      setIsFeedbackModalOpen(false);
    }
  };

  const handleAddPerson = () => {
    if (newPersonName.trim() && newPersonShortName.trim()) {
      addPerson(newPersonName.trim(), newPersonShortName.trim());
      setNewPersonName('');
      setNewPersonShortName('');
    }
  };

  const handleRenamePersonSave = async () => {
    if (editingPerson && editingPerson.new.trim()) {
      const success = await renamePerson(editingPerson.old, editingPerson.new.trim(), editingPerson.shortName.trim());
      if (success) {
        renameTasksPerson(editingPerson.old, editingPerson.new.trim());
        if (activeTab === editingPerson.old) {
          setActiveTab(editingPerson.new.trim());
        }
      }
      setEditingPerson(null);
    }
  };

  const handleDeletePerson = (name: string) => {
    if (window.confirm(`Mitarbeiter "${name}" wirklich löschen? Alle verknüpften Aufgaben werden ebenfalls gelöscht.`)) {
      removePerson(name);
      deleteTasksByPerson(name);
    }
  };

  return (
    <div className="gerda-root min-h-screen flex flex-col font-sans">

      {/* Header Container — MVP-style: glassmorphism + hairline */}
      <div className="sticky top-0 z-[500] px-9 py-4 border-b border-[rgba(14,14,13,0.10)] backdrop-blur-md bg-[rgba(246,242,234,0.92)]">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">

          {/* Logo Area */}
          <div className="flex items-end gap-1.5 w-full md:w-auto">
            <img src="/gerda_logo.svg" alt="Gerda Liste Logo" className="h-8 w-auto object-contain" />
            <span className="text-xs text-[#8A8278] leading-none mb-[2px] ml-1">v0.6</span>
          </div>

          {/* MVP-style tabs: minimal, brass underline on active */}
          <nav className="flex items-stretch whitespace-nowrap overflow-x-auto no-scrollbar w-full md:w-auto max-w-full" aria-label="Ansichten">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              const count = tabCounts[tab] ?? 0;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    relative px-4 py-3 text-sm font-medium uppercase tracking-[0.04em] flex-shrink-0
                    flex items-center gap-1.5
                    transition-colors duration-150
                    ${isActive ? 'text-[#0E0E0D]' : 'text-[#5C5852] hover:text-[#0E0E0D]'}
                  `}
                >
                  <span>{tab === 'Alle' ? 'Übersicht' : tab}</span>
                  {count > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[13px] h-[13px] px-1 rounded-full bg-[#ff0049] text-white text-[8px] font-mono font-bold tracking-normal">
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="active-tab-indicator"
                      className="absolute left-4 right-4 -bottom-px h-[2px] bg-[#A6824A]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Header Actions — MVP-style trigger + dropdown */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <div className="relative group lg:flex items-center">
              <button className="flex items-center gap-2 cursor-pointer text-xs font-medium uppercase tracking-[0.12em] text-[#5C5852] hover:text-[#0E0E0D] transition-colors py-2">
                Weitere Services <span className="text-[9px]">▼</span>
              </button>
              <div className="absolute right-0 top-[100%] w-60 bg-white border border-[rgba(14,14,13,0.10)] shadow-[0_8px_24px_-12px_rgba(14,14,13,0.18)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden translate-y-1 group-hover:translate-y-0">
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors border-b border-[rgba(14,14,13,0.06)]"
                >
                  <Settings className="w-4 h-4 text-[#8A8278]" /> Personen verwalten
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors border-b border-[rgba(14,14,13,0.06)]"
                >
                  <FileDown className="w-4 h-4 text-[#8A8278]" /> Gesamt-Report (CSV)
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors border-b border-[rgba(14,14,13,0.06)]"
                >
                  <FileDown className="w-4 h-4 text-[#8A8278]" /> Gesamt-Report (PDF)
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors border-b border-[rgba(14,14,13,0.06)]"
                >
                  <Printer className="w-4 h-4 text-[#8A8278]" /> Drucken
                </button>
                {/* 
                  <button 
                  onClick={async () => {
                    const ok = window.confirm("Möchtest du den Import der Excel-Daten starten? HINWEIS: Dies funktioniert nur, wenn die Aufgaben-Liste aktuell komplett leer ist.");
                    if (ok) {
                      await seedDatabaseIfEmpty();
                      alert("Import-Prüfung abgeschlossen! Wenn die Ansicht noch leer war, tauchen die Daten jetzt gleich auf.");
                      window.location.reload();
                    }
                  }}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors border-b border-[rgba(14,14,13,0.06)]"
                >
                  <Database className="w-4 h-4 text-[#8A8278]" /> Excel-Startdaten importieren
                </button>
                */}
                <button
                  onClick={() => setActiveTab('Feedback')}
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors border-b border-[rgba(14,14,13,0.06)]"
                >
                  <MessageSquarePlus className="w-4 h-4 text-[#8A8278]" /> Feedback an Eddy & Updateinfos
                </button>
                <Link
                  href="/"
                  className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-[#0E0E0D] hover:bg-[#C9A86A]/20 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-[#8A8278]" /> Zurück zum Intranet
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content — MVP page layout */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-9 py-12 flex flex-col">

        {/* Dynamic Board Content based on active tab */}
        <div className="flex-1">
          {activeTab === 'Feedback' ? (
            <div className="flex flex-col">
              <div className="mb-8">
                <h2 className="text-4xl md:text-5xl font-light text-[#0E0E0D] mb-2 tracking-tight flex items-baseline gap-2">
                  Feedback & Updates
                </h2>
                <p className="text-[#8A8278]">
                  Neuigkeiten, Versionen und dein direkter Draht zu Eddy.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Update Infos */}
                <div>
                  <h3 className="text-xl font-light text-[#0E0E0D] mb-4">Updateinfos</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-mono font-medium uppercase tracking-[0.12em] text-[#0E0E0D] mb-2 pb-2 border-b border-[rgba(14,14,13,0.10)] flex justify-between">UPDATE 27.05. • Version 0.6</h4>
                      <ul className="mvp-changelog text-sm text-[#5C5852] mt-2 space-y-1.5">
                        <li>Komplett neues Design auf Basis des Grabner Design Systems („Architectural Luxury")</li>
                        <li>IBM Plex Sans + IBM Plex Mono als Schriftfamilien, neue Farbpalette (Paper, Bone, Brass)</li>
                        <li>Tabs: minimalistisch mit goldener Brass-Linie für aktiven Tab, Tab-Counts in Mono-Font</li>
                        <li>Listendesign überarbeitet: Hairline-Borders, 3px Prio-Strich links, Mono-Daten rechtsbündig</li>
                        <li>Tabellen-Header in Mono 10px UPPERCASE mit weitem Tracking</li>
                        <li>Toolbar (Liste/Kalender, Suche, Sortierung, Aktionen) in eigener Zeile mit voller Content-Breite</li>
                        <li>Page-Eyebrow mit goldener Brass-Linie + Datum + offene Aufgaben über jeder Überschrift</li>
                        <li>Page-Title responsiv 40–80px, IBM Plex Sans Light/Thin</li>
                        <li>PRIO-Statistik bei Mitarbeitern: 5 große Display-Zahlen mit Mono-Labels (Prio hoch/mittel/niedrig, Überfällig, Erledigt)</li>
                        <li>Grauer Trennbalken neben den PRIO-Zahlen entfernt – klareres Layout</li>
                        <li>Neue PRIO-Farben: Rot #ff0049 (hoch), Orange #ffb92e (mittel), Grün #659900 (niedrig), Grau #969696 (keine) – überall einheitlich in Tabelle, Mobil-Karten, Kalender und Statistik</li>
                        <li>Kalender-Ansicht hinzugefügt (Toggle Liste / Kalender)</li>
                        <li>CSV-Export zusätzlich zu PDF (lokal + global im Services-Menü)</li>
                        <li>Druckfunktion im Services-Menü</li>
                        <li>Keyboard-Shortcuts: „/" fokussiert Suche, „Ctrl/⌘ + N" neue Aufgabe, „Escape" schließt Formular/Modal</li>
                        <li>Modals mit dunklem Overlay, dezentem Slide-Up + Shadow</li>
                        <li>Personen-Verwaltung als Hairline-Liste mit Mono-Kürzeln</li>
                        <li>Feedback-Cards und Update-Changelog mit goldenen Bullet-Markern</li>
                        <li>Dark Mode entfernt zugunsten des einheitlichen MVP-Designs</li>
                        <li>Footer-Buttons entfernt – Exports jetzt zentral im Services-Menü</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-medium uppercase tracking-[0.12em] text-[#0E0E0D] mb-2 pb-2 border-b border-[rgba(14,14,13,0.10)] flex justify-between">UPDATE 18.05. • Version 0.5</h4>
                      <ul className="mvp-changelog text-sm text-[#5C5852] mt-2 space-y-1.5">
                        <li>Sichtbarkeit der Tabelle überarbeitet. Übersichtlichere Darstellung.</li>
                        <li>Mitarbeiter-Kürzel (3-stellig) hochgestellt in der Ansichtsüberschrift</li>
                        <li>Überschriften in der Mitarbeiteransicht auf doppelte Größe vergrößert</li>
                        <li>Kürzel bündig an der Oberkante der Überschrift ausgerichtet</li>
                        <li>Tabelle schließt immer mit einer grauen Linie ab</li>
                        <li>Zeilennummern im Status stets zweistellig (führende Null)</li>
                        <li>Hover-Effekt für alle Zeilen (grau &amp; weiß) vereinheitlicht</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-medium uppercase tracking-[0.12em] text-[#0E0E0D] mb-2 pb-2 border-b border-[rgba(14,14,13,0.10)] flex justify-between">UPDATE 15.05. • Version 0.4</h4>
                      <ul className="mvp-changelog text-sm text-[#5C5852] mt-2 space-y-1.5">
                        <li>Aktionsmenü (Erledigt, Bearbeiten, Duplizieren, Löschen) auch in der Gesamtübersicht</li>
                        <li>Klick auf gesamte Tabellenzeile öffnet Bearbeitungsformular</li>
                        <li>Optionen schieben sich per Hover von rechts ein (Slide-Effekt)</li>
                        <li>Gruppierung nach Kunde mit großem Header und Abstand zwischen Blöcken</li>
                        <li>Alternierend graue und weiße Zeilen – Rotmarkierung bei Prio entfernt</li>
                        <li>Linker Farbstreifen als Prio-Indikator beibehalten</li>
                        <li>Kontrast in Kopfzeile und nicht-priorisierten Zeilen deutlich erhöht</li>
                        <li>Überfälligkeitsstatus als „+01 Tag" / „+02 Tage" (korrekte Singular/Plural-Schreibweise)</li>
                        <li>Suche, Sortierung und Kundenauswahl mit einheitlichem Rahmen &amp; gleicher Höhe</li>
                        <li>Offizielles Gerda-Logo (SVG) integriert, Versionsnummer bündig zur Logo-Unterkante</li>
                        <li>Aktionsbereich mit weißem Hintergrund, Rahmen und weichem Schatten</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-medium uppercase tracking-[0.12em] text-[#0E0E0D] mb-2 pb-2 border-b border-[rgba(14,14,13,0.10)] flex justify-between">UPDATE 08.05. • Version 0.3</h4>
                      <ul className="mvp-changelog text-sm text-[#5C5852] mt-2 space-y-1.5">
                        <li>Tabelle auf volle Browserbreite erweitert – alle Spalten vollständig sichtbar</li>
                        <li>Kommissionsnummer und Deadline optional gemacht</li>
                        <li>Alle Felder bis auf „Kunde" optional gemacht</li>
                        <li>Eckiges, klares Design für alle UI-Elemente umgesetzt</li>
                        <li>Aufgaben duplizieren per Icon möglich</li>
                        <li>Kunden-Dropdown mit Verwaltung und Löschfunktion</li>
                        <li>„Erledigte ausblenden" Schalter in der oberen Leiste</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-medium uppercase tracking-[0.12em] text-[#0E0E0D] mb-2 pb-2 border-b border-[rgba(14,14,13,0.10)] flex justify-between">Version 0.2</h4>
                      <ul className="mvp-changelog text-sm text-[#5C5852] mt-2 space-y-1.5">
                        <li>Mitarbeiter-Tabs im Header zur schnellen Filterung nach Person</li>
                        <li>Gesamtübersicht (Alle) als eigene Ansicht mit MA-Spalte</li>
                        <li>Sortierung nach Priorität, Eintragsdatum und Deadline</li>
                        <li>Prioritätsstufen 1–3 mit farbigem Streifen links</li>
                        <li>Status-Spalte mit Berechnung verbleibender / überfälliger Tage</li>
                        <li>Einstellungen-Panel zur Verwaltung der Mitarbeiterliste inkl. Kürzel</li>
                        <li>Dark-Mode-Umschalter</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-medium uppercase tracking-[0.12em] text-[#0E0E0D] mb-2 pb-2 border-b border-[rgba(14,14,13,0.10)] flex justify-between">Version 0.1 – Erstversion</h4>
                      <ul className="mvp-changelog text-sm text-[#5C5852] mt-2 space-y-1.5">
                        <li>Grundstruktur der App mit Firebase-Anbindung (Firestore &amp; Auth)</li>
                        <li>Login-Seite mit Authentifizierung</li>
                        <li>Aufgabentabelle: Anlegen, Bearbeiten, Löschen, als erledigt markieren</li>
                        <li>Felder: Kunde, Aufgabe, Bemerkung, Kommissionsnummer, Deadline, Eintragsdatum</li>
                        <li>Zuweisung von Aufgaben an Mitarbeiter</li>
                        <li>Feedback-Bereich mit Board und Antwortfunktion (Eddy antwortet)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Right: Feedback Board */}
                <div>
                  <h3 className="text-xl font-light text-[#0E0E0D] mb-4">Feedback Board</h3>

                  {/* Input field for new feedback */}
                  <div className="mb-6 bg-white border border-[rgba(14,14,13,0.10)] p-5">
                    <textarea
                      className="w-full solnest-input h-24 resize-none text-sm"
                      placeholder="Deine Ideen zur Verbesserung oder gefundene Fehler..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                    />
                    <div className="mt-3 flex justify-end">
                      <button onClick={submitFeedback} disabled={!feedbackText.trim()} className="solnest-btn-primary transition-shadow duration-300 hover:shadow-md disabled:opacity-50 text-sm py-2 px-4">Senden</button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {feedbacks.length === 0 ? (
                      <p className="text-sm text-[#8A8278]">Noch keine Feedback-Einträge.</p>
                    ) : (
                      [...feedbacks]
                        .sort((a, b) => {
                          if (a.erledigt === b.erledigt) {
                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                          }
                          return a.erledigt ? 1 : -1;
                        })
                        .map(fb => (
                          <div key={fb.id} className={`p-4 border ${fb.erledigt ? 'bg-[#EFEAE0]/50 opacity-60' : 'bg-white/50 border-white/60'} rounded-none shadow-sm`}>
                            <p className={`text-sm text-[#0E0E0D] whitespace-pre-wrap ${fb.erledigt ? 'line-through' : ''}`}>{fb.text}</p>
                            {fb.reply && (
                              <div className="mt-2 p-2 bg-[#D9D2C5]/40 text-sm text-[#0E0E0D] border-l-2 border-[#5C5852]">
                                <span className="font-semibold">Eddy:</span> {fb.reply}
                              </div>
                            )}
                            <div className="text-xs text-[#8A8278] mt-2 flex justify-between items-center">
                              <span>{new Date(fb.createdAt).toLocaleString('de-DE')}</span>
                              <div className="flex gap-3">
                                {!fb.reply && (
                                  <button
                                    onClick={() => {
                                      const replyText = window.prompt("Antwort eingeben:");
                                      if (replyText !== null) {
                                        updateFeedback(fb.id, { reply: replyText });
                                      }
                                    }}
                                    className="text-[#0E0E0D] hover:underline"
                                  >
                                    Antworten
                                  </button>
                                )}
                                {!fb.erledigt && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm("Als erledigt markieren?")) {
                                        updateFeedback(fb.id, { erledigt: true });
                                      }
                                    }}
                                    className="text-[#0E0E0D] hover:underline"
                                  >
                                    Erledigt
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (window.confirm("Feedback wirklich löschen?")) {
                                      deleteFeedback(fb.id);
                                    }
                                  }}
                                  className="text-[#8C3A2E] hover:underline"
                                >
                                  Löschen
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <TaskBoard key={activeTab} person={activeTab} />
          )}
        </div>

        {/* Footer removed — exports available via Services menu (MVP-style) */}
      </main>

      {/* --- MODALS --- */}

      {/* 1. Feedback Modal */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,14,13,0.32)] backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[rgba(14,14,13,0.10)] shadow-[0_24px_60px_-24px_rgba(14,14,13,0.28)] w-full max-w-lg p-8 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-light text-[#0E0E0D] flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-[#A6824A]" /> Feedback an Eddy & Updateinfos
              </h3>
              <button onClick={() => setIsFeedbackModalOpen(false)} className="text-[#8A8278] hover:text-[#0E0E0D] p-1 rounded-none"><X className="w-5 h-5" /></button>
            </div>
            <textarea
              className="w-full solnest-input h-32 resize-none text-sm"
              placeholder="Deine Ideen zur Verbesserung oder gefundene Fehler..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsFeedbackModalOpen(false)} className="px-4 py-2 text-sm font-medium text-[#5C5852] transition-shadow duration-300 hover:shadow-md hover:text-[#0E0E0D]">Abbrechen</button>
              <button onClick={submitFeedback} disabled={!feedbackText.trim()} className="solnest-btn-primary transition-shadow duration-300 hover:shadow-md disabled:opacity-50">Senden</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Services / Verbesserungen Modal */}
      {isServicesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,14,13,0.32)] backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[rgba(14,14,13,0.10)] shadow-[0_24px_60px_-24px_rgba(14,14,13,0.28)] w-full max-w-2xl p-8 h-[80vh] flex flex-col animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-light text-[#0E0E0D] flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#A6824A]" /> Verbesserungen & Vorschläge
              </h3>
              <button onClick={() => setIsServicesModalOpen(false)} className="text-[#8A8278] hover:text-[#0E0E0D] p-1 rounded-none"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {feedbacks.length === 0 ? (
                <p className="text-center text-[#8A8278] mt-10">Noch keine Vorschläge eingereicht.</p>
              ) : (
                feedbacks.map(fb => (
                  <div key={fb.id} className="p-4 bg-white border border-[rgba(14,14,13,0.10)]">
                    <p className="text-sm text-[#0E0E0D] whitespace-pre-wrap">{fb.text}</p>
                    <p className="text-xs text-[#8A8278] mt-2">{new Date(fb.createdAt).toLocaleString('de-DE')}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Settings / Person Management Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,14,13,0.32)] backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[rgba(14,14,13,0.10)] shadow-[0_24px_60px_-24px_rgba(14,14,13,0.28)] w-full max-w-md p-8 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-light text-[#0E0E0D] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#5C5852]" /> Namensverwaltung
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-[#8A8278] hover:text-[#0E0E0D] p-1 rounded-none"><X className="w-5 h-5" /></button>
            </div>

            {/* Add Person */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                className="flex-1 solnest-input text-sm"
                placeholder="Name..."
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddPerson(); }}
              />
              <input
                type="text"
                className="w-24 solnest-input text-sm uppercase"
                placeholder="Kürzel"
                maxLength={3}
                value={newPersonShortName}
                onChange={(e) => setNewPersonShortName(e.target.value.toUpperCase().slice(0, 3))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddPerson(); }}
              />
              <button onClick={handleAddPerson} disabled={!newPersonName.trim() || !newPersonShortName.trim()} className="p-3 bg-[#EFEAE0] text-[#0E0E0D] rounded-none hover:bg-[#D9D2C5] transition-colors disabled:opacity-50">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List Persons — MVP-style hairline rows */}
            <div className="border-t border-[rgba(14,14,13,0.10)] max-h-64 overflow-y-auto">
              {persons.map(person => (
                <div key={person.name} className="flex items-center justify-between py-3 px-1 border-b border-[rgba(14,14,13,0.06)] group">
                  {editingPerson?.old === person.name ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        className="flex-1 px-2 py-1 bg-white border border-[rgba(14,14,13,0.10)] rounded-none text-sm w-full outline-none focus:border-[#A6824A] focus:ring-2 focus:ring-[#A6824A]/20"
                        value={editingPerson.new}
                        onChange={(e) => setEditingPerson({ ...editingPerson, new: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePersonSave(); if (e.key === 'Escape') setEditingPerson(null); }}
                      />
                      <input
                        type="text"
                        className="w-16 px-2 py-1 bg-white border border-[rgba(14,14,13,0.10)] rounded-none text-sm outline-none uppercase font-mono focus:border-[#A6824A] focus:ring-2 focus:ring-[#A6824A]/20"
                        maxLength={3}
                        placeholder="Kürzel"
                        value={editingPerson.shortName}
                        onChange={(e) => setEditingPerson({ ...editingPerson, shortName: e.target.value.toUpperCase().slice(0, 3) })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePersonSave(); if (e.key === 'Escape') setEditingPerson(null); }}
                      />
                      <button onClick={handleRenamePersonSave} className="text-[10px] font-medium uppercase tracking-[0.12em] bg-[#0E0E0D] text-white px-2.5 py-1.5 rounded-none">Save</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-3">
                        <span className={`text-base font-medium ${person.active ? 'text-[#0E0E0D]' : 'text-[#8A8278]'}`}>
                          {person.name}
                        </span>
                        <span className="text-xs font-mono tracking-[0.12em] text-[#8A8278]">
                          {person.shortName || '???'}
                        </span>
                        {!person.active && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.12em] px-2 py-0.5 border border-[rgba(14,14,13,0.10)] bg-[#F6F2EA] text-[#8A8278]">
                            inaktiv
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => togglePersonActive(person.name)} className="w-7 h-7 inline-flex items-center justify-center text-[#5C5852] hover:text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors" title={person.active ? "Deaktivieren" : "Aktivieren"}>
                          {person.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setEditingPerson({ old: person.name, new: person.name, shortName: person.shortName || '' })} className="w-7 h-7 inline-flex items-center justify-center text-[#5C5852] hover:text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeletePerson(person.name)} className="w-7 h-7 inline-flex items-center justify-center text-[#5C5852] hover:text-[#8C3A2E] hover:bg-[#F6F2EA] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {persons.length === 0 && (
                <p className="text-sm text-[#8A8278] text-center py-4">Keine Namen angelegt.</p>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-[rgba(14,14,13,0.10)] text-[11px] font-mono uppercase tracking-[0.22em] text-[#8A8278] text-center">
              Änderungen werden live übernommen
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

