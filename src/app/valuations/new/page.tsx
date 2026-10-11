import { ValuationForm } from "@/components/ValuationForm";
import { PageHeader } from "@/components/ui";
import { getCurrentContext } from "@/lib/services/context";
import { getAccountDefaults } from "@/lib/services/defaults";

export const dynamic = "force-dynamic";

export default async function NewValuationPage() {
  const { accountId } = await getCurrentContext();
  const defaults = await getAccountDefaults(accountId);
  return (
    <>
      <PageHeader title="הערכת שווי חדשה" subtitle="שדות עם * הם חובה. כל שדה לא ידוע נשאר ״לא ידוע״ ולא מנוחש." />
      <ValuationForm initial={null} defaults={defaults} mode={{ kind: "new" }} />
    </>
  );
}
