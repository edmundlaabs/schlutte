"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import QRCode from "qrcode";
import { bereitePdfNeuAction, linkAktivSetzenAction, neuerLinkAction, pdfErsetztAction } from "@/app/(app)/abnahme/actions";
import { publicUrl } from "@/lib/abnahme/public-token";
import { createClient } from "@/lib/supabase/client";
import { formatDatumZeit } from "@/lib/abnahme/i18n";

type Historie = { id: string; grund: string; ersetzt_at: string; von: string | null };

/**
 * Bereich „Online-Link“ auf der Protokollseite: Link anzeigen/kopieren/öffnen, QR, Status. CEO/Admin: deaktivieren,
 * neuen Link erzeugen, PDF mit Foto-Link neu erzeugen (im Browser, mit dem vorhandenen Generator).
 */
export function OnlineLink({
  id, token, aktiv, erstelltAt, widerrufenAt, istAdmin, abgeschlossen, hatPdf, historie,
}: {
  id: string;
  token: string | null;
  aktiv: boolean;
  erstelltAt: string | null;
  widerrufenAt: string | null;
  istAdmin: boolean;
  abgeschlossen: boolean;
  hatPdf: boolean;
  historie: Historie[];
}) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [zeigeQr, setZeigeQr] = useState(false);
  const [busy, setBusy] = useState("");
  const [fehler, setFehler] = useState("");
  const [info, setInfo] = useState("");
  const [pdfEmpfohlen, setPdfEmpfohlen] = useState(false);
  const url = token ? publicUrl(token) : null;

  async function zeigeQrCode() {
    if (!url) return;
    if (!qr) setQr(await QRCode.toDataURL(url, { margin: 2, width: 320, errorCorrectionLevel: "M" }));
    setZeigeQr((v) => !v);
  }
  async function kopieren() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setInfo("Link kopiert.");
    } catch {
      setInfo("Kopieren nicht möglich – bitte den Link markieren und kopieren.");
    }
  }
  async function aktivSetzen(neu: boolean) {
    if (!neu && !confirm("Link deaktivieren? Kunden sehen dann „Link ungültig oder deaktiviert“, auch über den QR-Code im PDF.")) return;
    setBusy("aktiv"); setFehler(""); setInfo("");
    const r = await linkAktivSetzenAction(id, neu);
    setBusy("");
    if (!r.ok) setFehler(r.error);
    else router.refresh();
  }
  async function neuerLink() {
    if (!confirm("Neuen Link erzeugen? Der bisherige Link und der QR-Code im bereits versendeten PDF werden ungültig.")) return;
    setBusy("neu"); setFehler(""); setInfo("");
    const r = await neuerLinkAction(id);
    setBusy("");
    if (!r.ok) { setFehler(r.error); return; }
    setQr(null); setZeigeQr(false); setPdfEmpfohlen(true);
    setInfo("Neuer Link erzeugt. Das PDF enthält noch den alten QR-Code – bitte jetzt „PDF mit Foto-Link neu erzeugen“.");
    router.refresh();
  }
  async function pdfNeu() {
    if (!confirm("PDF mit Foto-Link neu erzeugen? Inhalt und Unterschriften bleiben unverändert, nur QR-Code und Link sind neu. Das alte PDF bleibt als „früheres PDF“ erhalten.")) return;
    setBusy("pdf"); setFehler(""); setInfo("");
    try {
      const v = await bereitePdfNeuAction(id);
      if (!v.ok) throw new Error(v.error);
      const { erzeugeProtokollPdfAusServer } = await import("@/lib/abnahme/pdf/lokal");
      const bytes = await erzeugeProtokollPdfAusServer(v.data.doc, v.data.signed);
      const pfad = `protokoll/${id}/abnahme-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
      const up = await createClient().storage.from("abnahme").upload(pfad, new Blob([bytes as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
      if (up.error) throw new Error(`Upload: ${up.error.message}`);
      const fin = await pdfErsetztAction(id, pfad, token ? "PDF mit Foto-Link neu erzeugt" : "PDF mit Foto-Link erzeugt");
      if (!fin.ok) throw new Error(fin.error);
      setPdfEmpfohlen(false);
      setInfo("Neues PDF mit QR-Code und Foto-Link gespeichert. Das alte PDF steht unter „Frühere PDFs“.");
      router.refresh();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "PDF konnte nicht erzeugt werden.");
    } finally {
      setBusy("");
    }
  }

  if (!abgeschlossen) return null;
  return (
    <div className="aus-card" id="online-link">
      <h2 className="aus-h2">Online-Link</h2>
      {!url ? (
        <p className="aus-muted">Für dieses Protokoll gibt es noch keinen Online-Link (es wurde vor Version 1.7 abgeschlossen).</p>
      ) : (
        <>
          <p>
            <span className={aktiv ? "abn-chip is-ok" : "abn-chip is-bad"}>{aktiv ? "aktiv" : "deaktiviert"}</span>
            <span className="aus-muted"> · erstellt {formatDatumZeit(erstelltAt, "de") || "—"}{!aktiv && widerrufenAt ? ` · deaktiviert ${formatDatumZeit(widerrufenAt, "de")}` : ""}</span>
          </p>
          <p><a href={url} target="_blank" rel="noreferrer noopener" style={{ overflowWrap: "anywhere" }}>{url}</a></p>
          <div className="aus-actions">
            <button type="button" className="aus-btn aus-btn-secondary" onClick={kopieren}>Link kopieren</button>
            <a className="aus-btn aus-btn-secondary" href={url} target="_blank" rel="noreferrer noopener">Öffnen</a>
            <button type="button" className="aus-btn aus-btn-secondary" onClick={zeigeQrCode}>{zeigeQr ? "QR ausblenden" : "QR anzeigen"}</button>
          </div>
          {zeigeQr && qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR-Code zum Online-Link" width={200} height={200} style={{ marginTop: 12, background: "#fff" }} />
          )}
        </>
      )}

      {istAdmin && (
        <div className="aus-actions" style={{ marginTop: 16 }}>
          {url && (
            <button type="button" className="aus-btn aus-btn-quiet" disabled={busy !== ""} onClick={() => aktivSetzen(!aktiv)}>
              {busy === "aktiv" ? "…" : aktiv ? "Link deaktivieren" : "Link wieder aktivieren"}
            </button>
          )}
          {url && (
            <button type="button" className="aus-btn aus-btn-quiet" disabled={busy !== ""} onClick={neuerLink}>{busy === "neu" ? "…" : "Neuen Link erzeugen"}</button>
          )}
          {hatPdf && (
            <button type="button" className={pdfEmpfohlen ? "aus-btn aus-btn-primary" : "aus-btn aus-btn-secondary"} disabled={busy !== ""} onClick={pdfNeu}>
              {busy === "pdf" ? "PDF wird erzeugt …" : "PDF mit Foto-Link neu erzeugen"}
            </button>
          )}
        </div>
      )}
      {info && <p className="aus-help" role="status">{info}</p>}
      {fehler && <p className="aus-field-error" role="alert">{fehler}</p>}

      {historie.length > 0 && (
        <>
          <h3 className="aus-h3" style={{ marginTop: 20 }}>Frühere PDFs</h3>
          <ul className="aus-list">
            {historie.map((h) => (
              <li key={h.id} className="aus-item">
                <div className="aus-item-main">
                  <a href={`/api/abnahme/pdf?typ=abnahme&id=${id}&art=historie&hid=${h.id}`}>PDF vom {formatDatumZeit(h.ersetzt_at, "de")} herunterladen</a>
                  <div className="aus-item-meta">ersetzt: {h.grund}{h.von ? ` · ${h.von}` : ""}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
