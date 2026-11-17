import { notFound } from "next/navigation";
import { OberflaecheSheets } from "@/components/print/OberflaecheSheets";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { getOberflaechePrintDataByDocId } from "@/lib/data/documents";

export default async function OberflaecheDocPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getOberflaechePrintDataByDocId(id);
  if (!data) notFound();

  return (
    <>
      <PrintToolbar backUrl={`/kommissionen/${data.commissionNo}/dokumente/oberflaeche/${id}/bearbeiten`} />
      <OberflaecheSheets data={data.formData} />
    </>
  );
}
