import { useState } from "react";
import { Comment } from "@/lib/types";
import { theme } from "@/lib/theme";
import { CURRENT_PERSONA } from "@/lib/personas";
import { postComment } from "@/lib/useEventStream";

function timeLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CommentRow({ comment }: { comment: Comment }) {
  const initials = comment.author
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: theme.accentSoft,
          border: `1px solid ${theme.accent}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: theme.accent,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.textPrimary }}>{comment.author}</span>
          <span style={{ fontSize: 10.5, color: theme.textMuted }}>{comment.author_role}</span>
          <span style={{ fontSize: 10.5, color: theme.textMuted, marginLeft: "auto" }}>{timeLabel(comment.created_at)}</span>
        </div>
        <div style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.55, marginTop: 4 }}>{comment.text}</div>
      </div>
    </div>
  );
}

/** A shared comment thread on the incident — any signed-in authority can
 * leave a note, and it's visible to every other authority who opens this
 * incident (no per-viewer filtering; that's the point of a shared record). */
export default function CommentThread({ incidentId, comments }: { incidentId: string; comments: Comment[] }) {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  async function submit() {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await postComment(incidentId, CURRENT_PERSONA.name, CURRENT_PERSONA.role, text);
      setDraft("");
    } catch {
      // best-effort — the input keeps the draft so the user can retry
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 16 }}>
        Comments {comments.length > 0 && `(${comments.length})`}
      </div>

      {comments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 20 }}>
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={`Add a note as ${CURRENT_PERSONA.name}…`}
          rows={2}
          style={{
            flex: 1,
            resize: "vertical",
            background: theme.bgElevated,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "10px 12px",
            color: theme.textPrimary,
            fontSize: 12.5,
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || posting}
          style={{
            background: draft.trim() ? theme.accentSoft : theme.bgElevated,
            color: draft.trim() ? theme.textPrimary : theme.textMuted,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: draft.trim() && !posting ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
