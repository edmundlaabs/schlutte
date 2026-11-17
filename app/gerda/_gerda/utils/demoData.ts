import type { Task } from '../types';
import { v4 as uuidv4 } from './uuid';

const today = new Date().toISOString().split('T')[0];

const createDemoTask = (
  person: string,
  kommissionsNummer: string,
  kunde: string,
  priorisierung: 1 | 2 | 3,
  bezeichnung: string,
  aufgabe: string,
  info: string,
  deadlineStr: string,
  erledigt: boolean = false
): Task => {
  let finalBezeichnung = bezeichnung;
  if (info) {
    finalBezeichnung = bezeichnung ? `${bezeichnung} | Info: ${info}` : `Info: ${info}`;
  }

  let finalDeadline: string | undefined = undefined;
  if (deadlineStr === '26. Mär') finalDeadline = '2026-03-26';
  else if (deadlineStr === '27. Mär') finalDeadline = '2026-03-27';
  else if (deadlineStr === '01. Apr') finalDeadline = '2026-04-01';

  return {
    id: uuidv4(),
    person,
    kommissionsNummer,
    kunde,
    priorisierung,
    bezeichnung: finalBezeichnung,
    aufgabe,
    eingetragenAm: today,
    deadline: finalDeadline,
    erledigt,
    createdAt: new Date().toISOString()
  };
};

export const allDemoTasks: Task[] = [
  // Noah
  createDemoTask('Noah', 'x', 'Nardone', 1, 'Glas', 'Preis', 'warten auf Rückmeldung', 'x'),
  createDemoTask('Noah', '260053', 'Höllental / Integernsee', 1, 'customized high', 'Planen / AV', 'warten auf Rückmeldung', 'x'),
  createDemoTask('Noah', '260053', 'Höllental / Integernsee', 1, 'customized work', 'Planen / AV', 'warten auf Rückmeldung', 'x'),
  createDemoTask('Noah', '240205', 'Widen', 1, 'Muster', 'Muster bestellen', 'erledigt, warten auf Lieferung', 'x', true),
  createDemoTask('Noah', '240205', 'Widen', 2, 'alles', 'Planen / AV', 'nächster Termin 02.04', 'ASAP'),
  createDemoTask('Noah', '260031', 'Raitl', 1, 'alles', 'Planen / AV', 'Start Planung 26.03', 'ASAP'),
  createDemoTask('Noah', '250148', 'Wagener Empfang', 3, 'alles', 'Planen / AV', '', 'ASAP'),
  createDemoTask('Noah', '260052', 'Deva', 3, 'Nacharbeiten', 'Angebot', 'warten auf Rückmeldung', 'x'),
  createDemoTask('Noah', '260040', 'Vennik', 3, 'Wasserschaden', 'Angebot', 'warten auf Rückmeldung', 'x'),
  createDemoTask('Noah', 'x', 'Būba', 2, 'Armatur', 'Retoure', 'Abstimmen mit Ingo', ''),
  createDemoTask('Noah', '260053', 'Höllental / Integernsee', 1, 'customized', 'Steckdosen bestellen', '', 'x'),

  // Tobi
  createDemoTask('Tobi', '260043', 'Spielweg', 1, 'Restarbeiten', 'Restarbeiten', 'Termin am 26.03', '26. Mär'),
  createDemoTask('Tobi', '260048', 'Hardt', 1, 'Silikonfuge', 'neuen Termin ausmachen', 'warten auf Rückmeldung', '27. Mär'),
  createDemoTask('Tobi', '240205', 'Widen', 1, 'Muster für Besprechung', 'Muster herstellen', '', '01. Apr'),
  createDemoTask('Tobi', '260049', 'Timo', 1, 'Restarbeiten', 'Termin ausmachen', 'Abstimmung mit Ingo', '27. Mär'),
  createDemoTask('Tobi', '240205', 'Widen', 1, 'Musterrahmen', 'bauen', '', ''),
  createDemoTask('Tobi', 'x', 'Raubling', 2, 'Möbel abbauen', 'Termin abstimmen', 'bis in 2 Wochen Abbau', 'ASAP'),
  createDemoTask('Tobi', '260053', 'Höllental / Integernsee', 1, 'customized high', 'bauen', 'Auslieferung mit Raubling', 'x'),
  createDemoTask('Tobi', '260053', 'Höllental / Integernsee', 1, 'customized work', 'bauen', 'Auslieferung mit Raubling', 'x'),

  // Kay
  createDemoTask('Kay', '260043', 'Stadtfrisör', 1, 'Besprechung und Revi Deckel', 'Revi Deckel', 'Termin am 26.03', '26. Mär'),
  createDemoTask('Kay', '260048', 'Rickenbach', 2, 'Silikonfuge', 'neuen Termin ausmachen', 'warten auf Rückmeldung', '27. Mär'),
  createDemoTask('Kay', 'x', 'Korpusmaterial auswählen', 1, 'x', 'x', 'Muster sind bestellt, kommen', 'ASAP'),
  createDemoTask('Kay', '220075', 'Holzhausfabrik', 3, 'Abnahme', 'Abnahme Termin', '', 'ASAP'),
  createDemoTask('Kay', '260016', 'HS Technik / Hanke', 2, 'Angebot', 'Termin abstimmen', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', '260038', 'Salzmann Kassel', 2, 'Herrenzimmer', 'klären', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', 'x', 'Kempten', 2, 'Hotelzimmer Einlagerung', 'klären', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', '260012', 'Tetik', 2, 'Empfang', 'klären', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', '250116', 'Josko', 1, 'Wintergarten', 'klären', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', '250074', 'Widenhorn', 3, 'Wohnzimmer', 'klären', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', '250215', 'Labusch', 3, 'Fitnessraum', 'klären', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', '260025', 'Bischof', 3, 'KZ / Bad', 'klären', 'warten auf Rückmeldung', 'ASAP'),
  createDemoTask('Kay', '260014', 'Zaborka', 3, 'Living room u. Kitchen', 'klären', 'warten auf Rückmeldung', 'ASAP'),

  // Ingo
  createDemoTask('Ingo', '230014', 'Büba Pylonen', 1, 'Pylonen', 'zeichnen / AV', 'Termin am 07.04', '26. Mär'),
  createDemoTask('Ingo', '250144', 'Büba Logo', 1, 'Logo', 'zeichnen / AV', 'Termin am 07.04', '26. Mär'),
  createDemoTask('Ingo', '260053', 'Höllental', 1, 'customized work Gestell', 'Gestell bestellen', 'Planmäßige Lieferung 03.04', '27. Mär'),
  createDemoTask('Ingo', '250188', 'Sutter', 2, 'Küche', 'Planen / AV', 'Warten auf Rückmeldung durch HV', 'x'),
  createDemoTask('Ingo', '240205', 'Türen Widen', 1, 'Türen', 'Planen / AV', 'bereits in Produktion', 'x'),
  createDemoTask('Ingo', '260047', 'Fidel', 1, 'Edwin', 'Planen / AV', '', '26. Mär'),
  createDemoTask('Ingo', '250148', 'Wagener Empfang', 3, 'alles', 'Planen / AV', '', 'ASAP'),
  createDemoTask('Ingo', '260032', 'Höllental', 1, 'Gestelle', 'Trenkle nachhaken', 'Lieferung bis wann?', 'ASAP'),
  createDemoTask('Ingo', '260019', 'Josko', 2, 'Brandschutztür', 'messen und bestellen', '', 'ASAP'),
  createDemoTask('Ingo', '240151', 'Altera', 3, '', 'nachhaken', '', 'ASAP'),
  createDemoTask('Ingo', '240048', 'Sito', 3, 'Küchen', 'nachhaken', 'Warten auf Rückmeldung', 'ASAP')
];
