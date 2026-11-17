import { getFeedbackList } from "@/lib/data/feedback";
import { FeedbackList } from "./FeedbackList";

export const metadata = { title: "Feedback — Admin" };

/** Feedback-Eingang für CEO/Admin. Das Formular für alle liegt auf /feedback. */
export default async function AdminFeedbackPage() {
  const feedbackList = await getFeedbackList();
  return (
    <div style={{ padding: "40px 24px 80px", maxWidth: 960, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ paddingBottom: 18, borderBottom: "1px solid var(--fg)" }}>
        <span className="grb-eyebrow">Admin</span>
        <h1 className="grb-h-h1" style={{ marginTop: 6, fontSize: 36, letterSpacing: "-0.02em" }}>
          Feedback-Eingang
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>
          Alle Einträge · {feedbackList.length} gesamt
        </p>
      </div>
      <FeedbackList entries={feedbackList} />
    </div>
  );
}
