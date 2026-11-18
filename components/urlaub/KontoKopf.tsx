import type { Konto } from "@/lib/urlaub/konto";
import { datumKurz, tageText } from "@/lib/urlaub/datum";

/** Resturlaub groß, darunter Anspruch / Übertrag (Verfall) / genommen / geplant / beantragt. */
export function KontoKopf({ konto }: { konto: Konto }) {
  const verfallenInfo =
    konto.uebertrag > 0
      ? konto.uebertragVerfallen > 0
        ? `${tageText(konto.uebertragVerfallen)} verfallen am ${datumKurz(konto.uebertragVerfall, true)}`
        : `verfällt am ${datumKurz(konto.uebertragVerfall, true)}`
      : null;
  return (
    <section aria-label={`Urlaubskonto ${konto.jahr}`}>
      <div className="urlaub-rest">
        <span className="urlaub-rest-zahl">{tageText(konto.rest)}</span>
        <span className="urlaub-rest-label">Tage Resturlaub {konto.jahr}</span>
      </div>
      <dl className="urlaub-konto-grid">
        <div><dt>Anspruch</dt><dd>{tageText(konto.anspruch)}{konto.korrektur !== 0 && <small>Korrektur {konto.korrektur > 0 ? "+" : ""}{tageText(konto.korrektur)}</small>}</dd></div>
        <div><dt>Übertrag</dt><dd>{tageText(konto.uebertrag)}{verfallenInfo && <small>{verfallenInfo}</small>}</dd></div>
        <div><dt>Genommen</dt><dd>{tageText(konto.genommen)}</dd></div>
        <div><dt>Geplant</dt><dd>{tageText(konto.geplant)}</dd></div>
        <div><dt>Beantragt</dt><dd>{tageText(konto.beantragt)}</dd></div>
      </dl>
    </section>
  );
}
