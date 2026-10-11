import { notFound } from "next/navigation";
import { ValuationForm } from "@/components/ValuationForm";
import { Alert, PageHeader } from "@/components/ui";
import { getCurrentContext } from "@/lib/services/context";
import { getAccountDefaults } from "@/lib/services/defaults";
import { getValuation } from "@/lib/services/valuations";

export const dynamic = "force-dynamic";

export default async function EditValuationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accountId } = await getCurrentContext();
  const v = await getValuation(id, accountId);
  if (!v) notFound();
  const defaults = await getAccountDefaults(accountId);
  const isDraft = v.status === "draft";
  return (
    <>
      <PageHeader title={isDraft ? "עריכת טיוטה" : "שינוי נתונים והרצה מחדש"} subtitle={v.title} />
      {!isDraft && (
        <div className="mb-4">
          <Alert>ההערכה המקורית נשמרת כפי שהיא. ההרצה תיצור גרסה חדשה המקושרת אליה, כדי שאפשר יהיה להשוות ביניהן.</Alert>
        </div>
      )}
      <ValuationForm
        initial={v.input}
        defaults={defaults}
        mode={isDraft ? { kind: "edit-draft", id: v.id } : { kind: "new-version", parentId: v.id }}
        initialTitle={isDraft ? v.title : ""}
        initialNotes={v.brokerNotes ?? ""}
      />
    </>
  );
}
