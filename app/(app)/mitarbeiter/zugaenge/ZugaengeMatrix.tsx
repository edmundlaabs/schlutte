"use client";

import { useRef, useState, useTransition } from "react";
import type { AppKey } from "@/lib/apps";
import { setAccessAction, type AccessUpdate } from "./actions";

export type MatrixRow = {
  id: string;
  name: string;
  initials: string;
  isAdmin: boolean;
  apps: AppKey[];
};

type AppCol = { key: AppKey; title: string; live: boolean };

export function ZugaengeMatrix({
  apps,
  initialRows,
}: {
  apps: AppCol[];
  initialRows: MatrixRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const rowsRef = useRef(rows);

  /** Optimistisch anwenden, serverseitig speichern, bei Fehler auf den Vorzustand zurück. */
  const apply = (changes: Map<string, AppKey[]>) => {
    if (changes.size === 0) return;
    const before = rowsRef.current;
    const next = before.map((r) => (changes.has(r.id) ? { ...r, apps: changes.get(r.id)! } : r));
    rowsRef.current = next;
    setRows(next);
    setMessage(null);

    const updates: AccessUpdate[] = [...changes].map(([id, a]) => ({ id, apps: a }));
    startTransition(async () => {
      const res = await setAccessAction(updates);
      if (res.error) {
        // Nur die betroffenen Zeilen zurücksetzen (andere Klicks bleiben erhalten).
        const reverted = rowsRef.current.map((r) => {
          const old = before.find((b) => b.id === r.id);
          return changes.has(r.id) && old ? { ...r, apps: old.apps } : r;
        });
        rowsRef.current = reverted;
        setRows(reverted);
        setMessage(`Nicht gespeichert: ${res.error}`);
      }
    });
  };

  const toggleCell = (row: MatrixRow, key: AppKey) => {
    const has = row.apps.includes(key);
    apply(new Map([[row.id, has ? row.apps.filter((k) => k !== key) : [...row.apps, key]]]));
  };

  const toggleColumn = (key: AppKey) => {
    const editable = rowsRef.current.filter((r) => !r.isAdmin);
    const allOn = editable.every((r) => r.apps.includes(key));
    apply(
      new Map(
        editable
          .filter((r) => r.apps.includes(key) === allOn)
          .map((r) => [r.id, allOn ? r.apps.filter((k) => k !== key) : [...r.apps, key]])
      )
    );
  };

  const toggleRow = (row: MatrixRow) => {
    const allOn = apps.every((a) => row.apps.includes(a.key));
    apply(new Map([[row.id, allOn ? [] : apps.map((a) => a.key)]]));
  };

  return (
    <div>
      {message && (
        <div
          role="alert"
          style={{
            border: "1px solid var(--accent)",
            padding: "10px 14px",
            marginBottom: 16,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}
      <div className="zg-scroll">
        <table className="zg-table">
          <thead>
            <tr>
              <th className="zg-sticky">Mitarbeiter</th>
              {apps.map((a) => (
                <th key={a.key} className="zg-col">
                  <div>{a.title}</div>
                  {!a.live && <div className="zg-sub">folgt</div>}
                  <button type="button" className="zg-link" onClick={() => toggleColumn(a.key)}>
                    alle an/aus
                  </button>
                </th>
              ))}
              <th className="zg-col">Zeile</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="zg-sticky">
                  <span className="zg-ini">{r.initials}</span> {r.name}
                  {r.isAdmin && <div className="zg-sub">Admin hat immer Zugriff</div>}
                </td>
                {apps.map((a) => (
                  <td key={a.key} className="zg-cell">
                    <input
                      type="checkbox"
                      aria-label={`${r.name}: ${a.title}`}
                      checked={r.isAdmin || r.apps.includes(a.key)}
                      disabled={r.isAdmin}
                      onChange={() => toggleCell(r, a.key)}
                    />
                  </td>
                ))}
                <td className="zg-cell">
                  {!r.isAdmin && (
                    <button type="button" className="zg-link" onClick={() => toggleRow(r)}>
                      alle an/aus
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={apps.length + 2} style={{ padding: 24 }}>
                  Keine aktiven Mitarbeiter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
