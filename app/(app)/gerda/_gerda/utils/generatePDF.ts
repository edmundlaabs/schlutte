import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Task } from '../types';

export const generatePDFReport = (tasks: Task[], title: string = 'Gesamt-Report') => {
  const doc = new jsPDF('landscape'); // Landscape might be better for many columns
  
  // Title
  doc.setFontSize(20);
  doc.text(`Antigravity ${title}`, 14, 22);
  
  // Subtitle (Date)
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generiert am: ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')} Uhr`, 14, 30);

  // Table Data Preparation
  const tableData = tasks.map(task => {
    return [
      task.erledigt ? `${task.person} ✓` : task.person,
      new Date(task.eingetragenAm).toLocaleDateString('de-DE'),
      task.kommissionsNummer,
      task.kunde,
      task.priorisierung.toString(),
      task.aufgabe,
      task.deadline ? new Date(task.deadline).toLocaleDateString('de-DE') : '-',
      task.bezeichnung
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [['Mitarbeiter', 'Angelegt', 'Komm.-Nr.', 'Kunde', 'Prio', 'Aufgabe', 'Deadline', 'Details']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [108, 102, 95] }, 
    alternateRowStyles: { fillColor: [248, 247, 243] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 20 },
      3: { cellWidth: 35 },
      4: { cellWidth: 10 },
      5: { cellWidth: 30 },
      6: { cellWidth: 20 },
      7: { cellWidth: 'auto' }
    },
    didParseCell: function (data) {
      // Color code priority column
      if (data.section === 'body' && data.column.index === 4) {
        const prio = data.cell.raw;
        // Make entire cell colored for Priority
        data.cell.styles.textColor = [255, 255, 255];
        if (prio === '1') {
          data.cell.styles.fillColor = [226, 166, 154]; // High
          data.cell.styles.fontStyle = 'bold';
        } else if (prio === '2') {
          data.cell.styles.fillColor = [227, 176, 74]; // Medium
        } else if (prio === '3') {
          data.cell.styles.fillColor = [168, 194, 172]; // Low
        }
      }
    }
  });

  doc.save(`Antigravity_${title.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};
