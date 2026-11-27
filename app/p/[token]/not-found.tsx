import "@/styles/public.css";

/** Neutrale 404: gleiche Antwort für unbekannte, deaktivierte und nicht abgeschlossene Links (keine Rückschlüsse). */
export default function PublicNichtGefunden() {
  return (
    <div className="pub">
      <main className="pub-wrap pub-leer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pub-logo" src="/brand/grabner-logo.svg" alt="Grabner Design" />
        <h1 className="pub-h1">Link ungültig oder deaktiviert</h1>
        <p>Dieser Link ist nicht mehr gültig. Bitte wenden Sie sich an Ihren Ansprechpartner bei Grabner Design.</p>
        <p className="pub-en">Link invalid or deactivated. Please contact your Grabner Design representative.</p>
      </main>
    </div>
  );
}
