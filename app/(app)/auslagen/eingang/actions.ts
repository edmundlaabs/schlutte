"use server";

import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/auslagen/errors";
import { markSubmittedClaimsRead, setClaimDone } from "@/lib/data/auslagen-inbox";

export async function markClaimsReadAction(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    await markSubmittedClaimsRead(ids);
    revalidatePath("/");
    revalidatePath("/auslagen/eingang");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function setClaimDoneAction(id: string, done: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await setClaimDone(id, done);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
