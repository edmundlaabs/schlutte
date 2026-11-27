import test from "node:test";
import assert from "node:assert/strict";
import { baueMailHtml, esc, hinweisKeineAntwort } from "./layout.ts";

const basis = "https://schlutte.vercel.app";
const link = `${basis}/p/${"A".repeat(32)}`;

test("HTML mit Link: Button, Klartext-Link, Hinweis, Firmenfuß, Logo-PNG", () => {
  const h = baueMailHtml({ sprache: "de", anrede: "Guten Tag,", absaetze: ["anbei das PDF."], link, basisUrl: basis, kontakt: "Ihr Ansprechpartner" });
  assert.match(h, /Protokoll und Fotos online ansehen/);
  assert.equal(h.split(link).length - 1, 3); // href Button, href Klartext, Klartext
  assert.match(h, /Diese Adresse empfängt keine Antworten – Kontakt: Ihr Ansprechpartner/);
  assert.match(h, /Grabner Design GmbH/);
  assert.match(h, /Tüchlinger Weg 1, 79400 Kandern/);
  assert.match(h, /brand\/grabner-logo-mail\.png/);
  assert.match(h, /<table/);
});

test("HTML ohne Link (Regiebericht): gleiches Layout, kein Button", () => {
  const h = baueMailHtml({ sprache: "de", anrede: "Guten Tag,", absaetze: ["x"], link: null, basisUrl: basis, kontakt: "k" });
  assert.ok(!h.includes("Protokoll und Fotos online"));
  assert.match(h, /Grabner Design GmbH/);
});

test("Englisch und Escaping", () => {
  const h = baueMailHtml({ sprache: "en", anrede: "Dear <b>Kunde</b> & Co,", absaetze: ["a \"b\""], link, basisUrl: basis, kontakt: "k" });
  assert.match(h, /View record and photos online/);
  assert.ok(h.includes("Dear &lt;b&gt;Kunde&lt;/b&gt; &amp; Co,"));
  assert.ok(!h.includes("<b>Kunde"));
  assert.equal(esc(`<a href="x">'`), "&lt;a href=&quot;x&quot;&gt;&#39;");
  assert.match(hinweisKeineAntwort("en", "k"), /does not receive replies/);
});
