"use server";

import { revalidatePath } from "next/cache";
import { createOberflaecheDocument, updateOberflaecheDocument } from "@/lib/data/documents";
import type { OberflaecheFormData } from "@/lib/types";

export async function saveOberflaecheAction(
  commissionNo: string,
  formData: OberflaecheFormData,
  documentId?: string
): Promise<{ error?: string; success?: boolean; documentId?: string }> {
  try {
    if (!Number.isInteger(formData.labelCount) || formData.labelCount < 1) {
      return { error: "Anzahl Labels muss eine ganze Zahl von mindestens 1 sein." };
    }
    let finalDocId = documentId;
    if (documentId) {
      await updateOberflaecheDocument(documentId, formData);
    } else {
      finalDocId = await createOberflaecheDocument(commissionNo, formData);
    }
    revalidatePath(`/kommissionen/${commissionNo}`);
    revalidatePath("/personal");
    revalidatePath("/");
    return { success: true, documentId: finalDocId };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Ein unbekannter Fehler ist aufgetreten.",
    };
  }
}
