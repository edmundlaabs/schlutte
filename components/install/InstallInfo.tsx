/** Kurzanleitung „Schlutte als App“ für iPhone und Android (News-Panel und Release-Popup). */
export function InstallInfo() {
  return (
    <section className="install-info" aria-label="Schlutte als App installieren">
      <h3>Schlutte als App installieren</h3>
      <div className="install-info-block">
        <strong>iPhone / iPad (Safari)</strong>
        <ol>
          <li>Unten auf <b>Teilen</b> tippen (Quadrat mit Pfeil)</li>
          <li><b>Zum Home-Bildschirm</b> wählen</li>
          <li><b>Hinzufügen</b> tippen</li>
        </ol>
      </div>
      <div className="install-info-block">
        <strong>Android (Chrome)</strong>
        <ol>
          <li>Oben rechts auf <b>⋮</b> tippen</li>
          <li><b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b></li>
          <li>Bestätigen</li>
        </ol>
      </div>
    </section>
  );
}
