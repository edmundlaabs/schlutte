import type { Metadata } from "next";
import GerdaApp from "./_gerda/GerdaApp";

export const metadata: Metadata = { title: "Gerda" };

export default function GerdaPage() {
  return <GerdaApp />;
}
