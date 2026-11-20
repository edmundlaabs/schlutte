import { redirect } from "next/navigation";

/** Der Regiebericht wird wie die Begehung offline-fähig erfasst: gleiche Client-Shell. */
export default function RegiePage() {
  redirect("/abnahme/begehung");
}
