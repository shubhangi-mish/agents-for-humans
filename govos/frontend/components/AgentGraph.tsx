import { GovEvent } from "@/lib/types";

const AGENTS = [
  { id: "orchestrator", label: "Command", x: 200, y: 40 },
  { id: "intel_agent", label: "Intel", x: 60, y: 140 },
  { id: "resource_agent", label: "Resource", x: 200, y: 140 },
  { id: "comms_agent", label: "Comms", x: 340, y: 140 },
  { id: "policy_agent", label: "Policy", x: 200, y: 230 },
];

const EDGES: [string, string][] = [
  ["orchestrator", "intel_agent"],
  ["orchestrator", "resource_agent"],
  ["orchestrator", "comms_agent"],
  ["orchestrator", "policy_agent"],
];

function nodeById(id: string) {
  return AGENTS.find((a) => a.id === id) ?? AGENTS[0];
}

export default function AgentGraph({ events }: { events: GovEvent[] }) {
  const lastAgentEvent = [...events].reverse().find((e) => AGENTS.some((a) => a.id === e.agent));
  const activeId = lastAgentEvent?.agent;

  return (
    <svg viewBox="0 0 400 280" width="100%" height="100%">
      {EDGES.map(([from, to]) => {
        const a = nodeById(from);
        const b = nodeById(to);
        const isActiveEdge = activeId === from || activeId === to;
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={isActiveEdge ? "#5b9dd9" : "#333"}
            strokeWidth={isActiveEdge ? 2 : 1}
          />
        );
      })}
      {AGENTS.map((a) => {
        const active = a.id === activeId;
        return (
          <g key={a.id}>
            <circle
              cx={a.x}
              cy={a.y}
              r={active ? 26 : 22}
              fill={active ? "#1c3a52" : "#1a1a1a"}
              stroke={active ? "#5b9dd9" : "#444"}
              strokeWidth={active ? 2.5 : 1.5}
            />
            <text x={a.x} y={a.y + 4} textAnchor="middle" fontSize={11} fill={active ? "#fff" : "#999"}>
              {a.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
