import { useState } from "react";
import { Comment } from "@/lib/types";
import { theme } from "@/lib/theme";
import { CURRENT_PERSONA } from "@/lib/personas";
import { DIRECTIVE_RECIPIENTS } from "@/lib/officesDirectory";
import { postComment } from "@/lib/useEventStream";

const NO_TAG = "";

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
        {comment.tagged_office && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              color: theme.statusAwaiting,
              background: `${theme.statusAwaiting}14`,
              border: `1px solid ${theme.statusAwaiting}44`,
              borderRadius: 5,
              padding: "3px 8px",
              marginTop: 8,
            }}
          >
            ☎ Called {comment.tagged_office} for an urgent reply
          </div>
        )}
      </div>
    </div>
  );
}

/** A shared comment thread on the incident — any signed-in authority can
 * leave a note, and it's visible to every other authority who opens this
 * incident (no per-viewer filtering; that's the point of a shared record).
 * Tagging an office also places a real phone call notifying them an urgent
 * reply is wanted — see backend/main.py's _run_tag_notification_call. */
export default function CommentThread({ incidentId, comments }: { incidentId: string; comments: Comment[] }) {
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState(NO_TAG);
  const [posting, setPosting] = useState(false);

  async function submit() {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await postComment(incidentId, CURRENT_PERSONA.name, CURRENT_PERSONA.role, text, tag || null);
      setDraft("");
      setTag(NO_TAG);
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={`Add a note as ${CURRENT_PERSONA.name}…`}
          rows={2}
          style={{
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
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            style={{
              background: theme.bgElevated,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              color: tag ? theme.textPrimary : theme.textMuted,
              fontSize: 11.5,
              padding: "8px 10px",
              fontFamily: "inherit",
              flex: 1,
              minWidth: 0,
            }}
          >
            <option value={NO_TAG}>No tag — just a note</option>
            {DIRECTIVE_RECIPIENTS.map((office) => (
              <option key={office} value={office}>
                🔔 Tag {office} — call for urgent reply
              </option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={!draft.trim() || posting}
            style={{
              background: draft.trim() ? theme.accentSoft : theme.bgElevated,
              color: draft.trim() ? theme.textPrimary : theme.textMuted,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: draft.trim() && !posting ? "pointer" : "default",
              flexShrink: 0,
            }}
          >
            {posting ? "Posting…" : tag ? "Post & Call" : "Post"}
          </button>
        </div>
        {tag && (
          <div style={{ fontSize: 10.5, color: theme.statusAwaiting }}>
            Posting this will place a real phone call to {tag}&apos;s registered line saying "{CURRENT_PERSONA.name} has
            tagged you on this and needs an urgent reply."
          </div>
        )}
      </div>
    </div>
  );
}
