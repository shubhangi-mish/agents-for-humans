import { AuditRow, Directive, NewsItem } from "@/lib/types";
import { theme } from "@/lib/theme";
import DirectiveBar from "./DirectiveBar";
import NewsFeed from "./NewsFeed";
import SignOffQueue from "./SignOffQueue";

/** The right-hand rail on the live map: the CM's (or any signed-in
 * authority's) pending sign-offs, a direct line to any real office, and
 * the live Delhi news feed — stacked as one column instead of three
 * disconnected panels. */
export default function Sidebar({
  newsItems,
  auditRows,
  onRefreshAudit,
  directives,
  onRefreshDirectives,
  onOpenIncident,
}: {
  newsItems: NewsItem[];
  auditRows: AuditRow[];
  onRefreshAudit: () => void;
  directives: Directive[];
  onRefreshDirectives: () => void;
  onOpenIncident: (id: string) => void;
}) {
  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        height: "100%",
        background: theme.bg,
        borderLeft: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SignOffQueue rows={auditRows} onOpenIncident={onOpenIncident} onRefresh={onRefreshAudit} />
      <DirectiveBar directives={directives} onSent={onRefreshDirectives} />
      <NewsFeed items={newsItems} />
    </div>
  );
}
