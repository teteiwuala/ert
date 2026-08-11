"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { XR, Controllers, VRButton } from "@react-three/xr";
import { Engine, ActionId, LogMsg, Vitals } from "@/lib/engine";
import { CASE } from "@/lib/scenario";
import WardScene from "./WardScene";

const ACTIONS: { group: string; items: [ActionId, string][] }[] = [
  { group: "Assess", items: [["pulse", "Check pulse"], ["listen", "Listen"], ["bp", "Take BP"], ["airway", "Airway"], ["ecg", "12-lead ECG"]] },
  { group: "Intervene", items: [["oxygen", "Oxygen"], ["aspirin", "Aspirin"], ["help", "Call help"], ["nitro", "Nitro"]] },
  { group: "Run the code", items: [["cpr", "CPR"], ["defib", "Shock"], ["epi", "Epi"]] },
  { group: "Time", items: [["wait", "Wait 15s"]] },
];
const LOG_COLORS: Record<string, string> = { sys: "#f0b429", you: "#7cc7ff", pt: "#37e08b", bad: "#ff5a52", doctor: "#c9a0ff" };

export default function Sim() {
  const engineRef = useRef<Engine | null>(null);
  if (engineRef.current === null) engineRef.current = new Engine();
  const engine = engineRef.current;

  const [started, setStarted] = useState(false);
  const [v, setV] = useState<Vitals>({ ...engine.v });
  const [phase, setPhase] = useState(engine.phase);
  const [clock, setClock] = useState(0);
  const [log, setLog] = useState<LogMsg[]>([]);
  const [debrief, setDebrief] = useState<{ win: boolean; checks: ReturnType<Engine["scoreChecks"]> } | null>(null);

  useEffect(() => {
    engine.onLog = (m) => setLog((L) => [...L.slice(-6), m]);
    engine.onEnd = (win) => setDebrief({ win, checks: engine.scoreChecks() });
    const id = setInterval(() => {
      setV({ ...engine.v }); setPhase(engine.phase); setClock(engine.t);
    }, 250);
    return () => clearInterval(id);
  }, [engine]);

  const begin = () => { engine.start(); setStarted(true); };
  const act = (id: ActionId) => { engine.action(id); setV({ ...engine.v }); setPhase(engine.phase); };
  const fmt = (t: number) => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`; };
  const arrest = phase === "arrest" || phase === "dead";

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* WebGL / WebXR scene */}
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.55, 0.2], fov: 70 }}
        onCreated={({ camera, gl }) => { camera.lookAt(0, 0.85, -1.5); gl.setClearColor(0x090c11); }}
      >
        <fog attach="fog" args={[0x090c11, 4, 15]} />
        <XR referenceSpace="local-floor">
          <Controllers />
          <WardScene engine={engine} />
        </XR>
      </Canvas>

      {/* Enter-VR button (HTML) */}
      <div style={{ position: "absolute", top: 14, right: 14, zIndex: 10 }}>
        <VRButton />
      </div>

      {/* HUD */}
      {!started && (
        <div style={overlay}>
          <div style={card}>
            <p style={eyebrow}>Shift handoff · SBAR</p>
            <h1 style={h1}>{CASE.title}</h1>
            <p style={{ color: "var(--muted)", marginTop: -6 }}>{CASE.subtitle} · {CASE.patient}</p>
            <div style={{ margin: "16px 0" }}>
              {CASE.sbar.map((s) => (
                <p key={s.tag} style={{ color: "var(--muted)", margin: "6px 0", fontSize: 14.5, lineHeight: 1.5 }}>
                  <span style={{ fontFamily: "var(--mono)", color: "var(--ecg)", marginRight: 8 }}>{s.tag}</span>{s.text}
                </p>
              ))}
            </div>
            <button style={goBtn} onClick={begin}>▶ Begin the shift</button>
            <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 14 }}>
              Training simulation only — not medical advice. Draft pending nurse-educator review.
            </p>
          </div>
        </div>
      )}

      {started && (
        <>
          {/* vitals strip */}
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 10, fontFamily: "var(--mono)", zIndex: 6 }}>
            {[["HR", arrest ? "0" : String(v.hr)], ["BP", v.sbp > 0 ? `${v.sbp}/${v.dbp}` : "--/--"], ["SpO₂", String(v.spo2 || 0)], ["RR", arrest ? "0" : String(v.rr)]].map(([k, val]) => (
              <div key={k} style={vitBox}><div style={{ fontSize: 9, color: "var(--faint)" }}>{k}</div><div style={{ fontSize: 22, color: arrest ? "var(--red)" : "var(--ecg)" }}>{val}</div></div>
            ))}
            <div style={{ ...vitBox, color: "var(--ecg)", alignSelf: "center" }}>⏱ {fmt(clock)}</div>
          </div>

          {/* log */}
          <div style={{ position: "absolute", left: 12, bottom: 96, width: "min(520px,72vw)", display: "flex", flexDirection: "column", gap: 6, zIndex: 6 }}>
            {log.slice(-4).map((m, i) => (
              <div key={i} style={{ background: "rgba(9,13,16,0.82)", borderLeft: `3px solid ${LOG_COLORS[m.kind] || "#5b6a72"}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: LOG_COLORS[m.kind] || "#8a9aa3", marginRight: 8 }}>{m.who}</span>{m.text}
              </div>
            ))}
          </div>

          {/* action bar */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 16, padding: 10, background: "linear-gradient(0deg,var(--panel),transparent)", overflowX: "auto", zIndex: 6 }}>
            {ACTIONS.map((grp) => (
              <div key={grp.group} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: "max-content" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--faint)" }}>{grp.group}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {grp.items.map(([id, lab]) => (
                    <button key={id} onClick={() => act(id)} style={actBtn(grp.group === "Run the code")}>{lab}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {debrief && (
        <div style={overlay}>
          <div style={card}>
            <p style={eyebrow}>After-action · Form ERT-1</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: 22, color: debrief.win ? "var(--ecg)" : "var(--red)", margin: 0 }}>
              {debrief.win ? "ROSC — he survives to the cath lab." : "The patient did not survive."}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "18px 0" }}>
              {debrief.checks.map((c, i) => (
                <li key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                  <span style={{ fontFamily: "var(--mono)", color: c.pass ? "var(--ecg)" : "var(--red)", width: 20 }}>{c.pass ? "✓" : "✕"}</span>
                  <span style={{ color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{c.label}</b> — {c.ev}</span>
                </li>
              ))}
            </ul>
            <button style={goBtn} onClick={() => location.reload()}>↻ Run it again</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* inline styles */
const overlay: React.CSSProperties = { position: "absolute", inset: 0, zIndex: 20, display: "grid", placeItems: "center", padding: 24, background: "rgba(6,9,11,0.92)" };
const card: React.CSSProperties = { maxWidth: 560, width: "100%", background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 14, padding: "28px 26px" };
const eyebrow: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--ecg)", margin: "0 0 10px" };
const h1: React.CSSProperties = { fontFamily: "var(--mono)", fontWeight: 600, fontSize: 26, margin: 0 };
const goBtn: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, background: "var(--ecg)", color: "#03170d", border: "none", borderRadius: 8, padding: "14px 24px", width: "100%" };
const vitBox: React.CSSProperties = { background: "rgba(9,13,16,0.8)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px", fontFamily: "var(--mono)" };
const actBtn = (emerg: boolean): React.CSSProperties => ({ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", background: "rgba(255,255,255,0.04)", border: `1px solid ${emerg ? "rgba(255,90,82,0.5)" : "var(--line-strong)"}`, borderRadius: 7, padding: "9px 12px", whiteSpace: "nowrap" });
