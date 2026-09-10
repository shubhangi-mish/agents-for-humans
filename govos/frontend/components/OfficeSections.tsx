import { motion } from "framer-motion";
import { Incident } from "@/lib/types";
import { ALL_OFFICE_SLOTS, buildChain } from "@/lib/chain";

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const EYEBROW: Record<string, string> = {
  "control-room": "MUNICIPAL CORPORATION OF DELHI",
  "district-control": "DELHI POLICE",
  commissioner: "MUNICIPAL CORPORATION OF DELHI",
  "cm-office": "GOVERNMENT OF NCT OF DELHI",
  "field-command": "INCIDENT COMMAND",
};

export default function OfficeSections({ incident }: { incident: Incident }) {
  const chain = buildChain(incident);
  const activeIds = new Set(chain.map((n) => n.id));
  const messageById = new Map(chain.map((n) => [n.id, n.message]));
  const latestId = chain[chain.length - 1]?.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ fontSize: 12, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>
        Chain of command
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {ALL_OFFICE_SLOTS.map((slot, i) => {
          const active = activeIds.has(slot.id);
          const isLatest = slot.id === latestId;
          const message = messageById.get(slot.id) ?? null;
          const prevSlot = i > 0 ? ALL_OFFICE_SLOTS[i - 1] : null;
          const prevMessage = prevSlot ? messageById.get(prevSlot.id) ?? null : null;
          const prevActive = prevSlot ? activeIds.has(prevSlot.id) : false;

          return (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: active ? 1 : 0.35, y: 0 }}
              transition={{ type: "spring", stiffness: 210, damping: 24, delay: i * 0.13 }}
              style={{
                border: isLatest ? "1.5px solid #d4af37" : "1px solid #2a2a2a",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: isLatest ? "0 0 22px #d4af3722" : "none",
                background: "#141414",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* tricolor letterhead */}
              <div style={{ height: 3, background: "linear-gradient(90deg, #FF9933 0%, #FF9933 33%, #FFFFFF 33%, #FFFFFF 66%, #138808 66%)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #232323" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#1a1a1a",
                    border: "1px solid #d4af3766",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  🏛️
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 8.5, color: "#d4af37", letterSpacing: 0.6, fontWeight: 700 }}>
                    {EYEBROW[slot.id]}
                  </div>
                  <div style={{ fontSize: 12, color: "#eee", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {slot.office}
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 9.5,
                    color: "#666",
                    border: "1px solid #333",
                    borderRadius: 4,
                    padding: "2px 6px",
                    flexShrink: 0,
                  }}
                >
                  STEP {i + 1}
                </div>
              </div>

              {/* the office scene: compact desk + officer */}
              <div
                style={{
                  position: "relative",
                  height: 118,
                  background: "linear-gradient(180deg, #1a1e24 0%, #171a1e 58%, #23201c 58%, #201d18 100%)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                <div style={{ position: "absolute", top: 10, left: 14, width: 30, height: 20, background: "#0d1520", border: "1px solid #2a3a48", borderRadius: 3 }} />

                {/* chair back */}
                <div style={{ position: "absolute", bottom: 30, width: 32, height: 26, background: "#1c1c1c", border: "1px solid #2c2c2c", borderRadius: "5px 5px 0 0" }} />
                {/* officer */}
                <motion.div
                  animate={isLatest ? { y: [0, -2, 0] } : {}}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
                  style={{
                    position: "absolute",
                    bottom: 36,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#0f0f0f",
                    border: `2px solid ${isLatest ? "#d4af37" : "#3a3a3a"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                    zIndex: 2,
                  }}
                >
                  {slot.id === "field-command" ? "👤" : "🧑‍💼"}
                </motion.div>
                {/* desk */}
                <div style={{ position: "absolute", bottom: 14, width: 96, height: 22, background: "#2a2016", border: "1px solid #3a2f20", borderRadius: 5, zIndex: 3 }} />
                <div style={{ position: "absolute", bottom: 4, left: "calc(50% - 40px)", width: 6, height: 12, background: "#241c14" }} />
                <div style={{ position: "absolute", bottom: 4, left: "calc(50% + 34px)", width: 6, height: 12, background: "#241c14" }} />

                <div style={{ position: "absolute", top: 8, right: 10, textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#eee" }}>{slot.officer}</div>
                  <div style={{ fontSize: 9, color: "#888" }}>{slot.role}</div>
                </div>
              </div>

              {/* message */}
              <div style={{ padding: 12, background: "#101010", minHeight: 70 }}>
                {message ? (
                  <motion.div
                    key={message.slice(0, 40)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 }}
                  >
                    {prevMessage && prevActive && (
                      <div style={{ fontSize: 9.5, color: "#666", borderBottom: "1px solid #232323", paddingBottom: 5, marginBottom: 5 }}>
                        ↳ fwd from <strong style={{ color: "#888" }}>{prevSlot!.officer}</strong>: “{truncate(prevMessage, 70)}”
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, color: "#ccc", lineHeight: 1.45 }}>
                      <span style={{ color: "#666" }}>✉️ </span>
                      {truncate(message, 170)}
                    </div>
                  </motion.div>
                ) : (
                  <div style={{ fontSize: 10.5, color: "#4a4a4a", fontStyle: "italic" }}>Not reached yet</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
