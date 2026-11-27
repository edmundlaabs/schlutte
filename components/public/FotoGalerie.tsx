"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "photoswipe/dist/photoswipe.css";

type Beschriftung = { schliessen: string; zurueck: string; weiter: string; zoom: string };

/**
 * Lightbox (PhotoSwipe 5) für die öffentliche Seite. Der Server rendert die Raster (Vorschaubilder als <a href=Original>);
 * hier wird nur die Lightbox angehängt – Vollbild, Pinch-/Doppeltipp-/Mausrad-Zoom, Verschieben, Wischen, Pfeiltasten,
 * Esc, Zähler „3 / 18“ und Bildunterschrift. Zwei Galerien: Mängelfotos und Objektfotos (je eigener Zähler).
 */
export function FotoGalerie({ children, text }: { children: ReactNode; text: Beschriftung }) {
  const wurzel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let weg: (() => void) | undefined;
    let abgebrochen = false;
    (async () => {
      const { default: PhotoSwipeLightbox } = await import("photoswipe/lightbox");
      if (abgebrochen || !wurzel.current) return;
      const lightboxen = (["maengel", "objekt"] as const).map((art) => {
        const lb = new PhotoSwipeLightbox({
          gallery: wurzel.current!,
          children: `a[data-gal="${art}"]`,
          pswpModule: () => import("photoswipe"),
          closeTitle: text.schliessen,
          arrowPrevTitle: text.zurueck,
          arrowNextTitle: text.weiter,
          zoomTitle: text.zoom,
          // Doppeltipp/Mausrad/Pinch-Zoom und Verschieben im Zoom sind in PhotoSwipe 5 eingebaut.
          bgOpacity: 0.96,
          wheelToZoom: true,
          imageClickAction: "zoom",
          tapAction: "toggle-controls",
          doubleTapAction: "zoom",
          maxZoomLevel: 4,
        });
        // Die tatsächliche Größe des geladenen Bildes übernehmen (Original-Auflösung kann von den Angaben abweichen).
        lb.on("loadComplete", ({ content, slide }) => {
          const img = content.element as HTMLImageElement | undefined;
          if (img && img.naturalWidth && (content.width !== img.naturalWidth || content.height !== img.naturalHeight)) {
            content.width = img.naturalWidth;
            content.height = img.naturalHeight;
            slide.width = img.naturalWidth;
            slide.height = img.naturalHeight;
            slide.updateContentSize(true);
          }
        });
        lb.on("uiRegister", () => {
          lb.pswp?.ui?.registerElement({
            name: "pub-caption",
            order: 9,
            isButton: false,
            appendTo: "root",
            html: "",
            onInit: (el, pswp) => {
              el.className = "pub-caption";
              pswp.on("change", () => {
                const a = pswp.currSlide?.data.element as HTMLElement | undefined;
                el.textContent = a?.dataset.caption ?? "";
              });
            },
          });
        });
        lb.init();
        return lb;
      });
      weg = () => lightboxen.forEach((l) => l.destroy());
    })();
    return () => {
      abgebrochen = true;
      weg?.();
    };
  }, [text.schliessen, text.zurueck, text.weiter, text.zoom]);

  return <div ref={wurzel}>{children}</div>;
}
