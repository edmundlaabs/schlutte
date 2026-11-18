import { getLoginChoices } from "@/lib/data/auth-admin";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Ohne Service-Role-Key (oder bei Fehler) bleibt nur die Anmeldung per E-Mail.
  let choices: { id: string; name: string }[] = [];
  try {
    choices = await getLoginChoices();
  } catch {
    choices = [];
  }
  return <LoginForm choices={choices} />;
}
