"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Interactive } from "@react-three/xr";
import * as THREE from "three";
import type { Engine, ActionId } from "@/lib/engine";

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
function beatWave(p: number) {
  const g = (c: number, w: number, a: number) => { const d = (p - c) / w; return a * Math.exp(-d * d * 0.5); };
  return g(0.3, 0.008, 1) + g(0.28, 0.01, -0.18) + g(0.325, 0.01, -0.28) + g(0.52, 0.045, 0.28) + g(0.16, 0.02, 0.1);
}

function useCanvasTexture(w: number, h: number) {
  const canvas = useMemo(() => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }, [w, h]);
  const ctx = useMemo(() => canvas.getContext("2d")!, [canvas]);
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t; }, [canvas]);
  return { canvas, ctx, tex };
}

/* ---- floating vitals monitor ---- */
function Monitor({ engine }: { engine: Engine }) {
  const { canvas, ctx, tex } = useCanvasTexture(512, 320);
  useFrame(() => {
    const v = engine.v, W = canvas.width, H = canvas.height;
    const arrest = engine.phase === "arrest" || engine.phase === "dead";
    const g = arrest ? "#ff5a52" : "#37e08b";
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "rgba(8,12,15,0.94)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    const stat = (x: number, y: number, lab: string, val: string, col: string) => {
      ctx.fillStyle = "#5b6a72"; ctx.font = "16px ui-monospace,monospace"; ctx.fillText(lab, x, y);
      ctx.fillStyle = col; ctx.font = "700 44px ui-monospace,monospace"; ctx.fillText(val, x, y + 18);
    };
    stat(24, 16, "HR", arrest ? "0" : String(v.hr), g);
    stat(268, 16, "BP", v.sbp > 0 ? `${v.sbp}/${v.dbp}` : "--/--", "#e9eef1");
    stat(24, 116, "SpO2", String(v.spo2 || 0), v.spo2 < 90 ? "#f0b429" : "#37e08b");
    stat(268, 116, "RR", arrest ? "0" : String(v.rr), "#e9eef1");
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath();
    const midY = 252, amp = 38, ph = engine.t * 2;
    for (let x = 0; x <= W; x += 3) {
      const u = x / W; let y = midY;
      if (engine.phase === "dead") y = midY;
      else if (arrest) y = midY - (Math.sin(u * 40 + ph * 7) * 0.5 + Math.sin(u * 97 + ph * 13) * 0.4) * amp;
      else { const beats = clamp(v.hr / 20, 3, 8), lo = u * beats - ph * (v.hr / 60), fp = lo - Math.floor(lo); y = midY - beatWave(fp) * amp; }
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#5b6a72"; ctx.font = "16px ui-monospace,monospace"; ctx.textAlign = "right";
    const m = Math.floor(engine.t / 60), s = Math.floor(engine.t % 60);
    ctx.fillText(`BAY 2  ${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`, W - 16, 16);
    tex.needsUpdate = true;
  });
  return (
    <mesh position={[1.05, 1.5, -1.5]} rotation={[0, -0.5, 0]}>
      <planeGeometry args={[0.72, 0.45]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/* ---- patient (low-poly, supine) ---- */
function Patient({ engine }: { engine: Engine }) {
  const torso = useRef<THREE.Mesh>(null);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xceb2a6, roughness: 0.7 }), []);
  useFrame((state) => {
    const v = engine.v, arrest = engine.phase === "arrest" || engine.phase === "dead", dead = engine.phase === "dead";
    const s = clamp((v.spo2 - 70) / 25, 0, 1);
    const r = dead ? 120 : Math.round(150 + 70 * s), g = dead ? 124 : Math.round(120 + 70 * s), b = dead ? 130 : Math.round(120 + 60 * s);
    skin.color.setRGB(r / 255, g / 255, b / 255);
    if (torso.current) torso.current.scale.y = 1 + (arrest ? 0 : Math.sin(state.clock.elapsedTime * (Math.max(v.rr, 8) / 60) * Math.PI * 2) * 0.06);
  });
  return (
    <group position={[0, 0, -1.6]}>
      <mesh ref={torso} position={[0.02, 0.8, 0]}><boxGeometry args={[0.8, 0.26, 0.44]} /><meshStandardMaterial color={0x8fb9c9} roughness={0.85} /></mesh>
      <mesh position={[-0.66, 0.82, 0]} material={skin}><sphereGeometry args={[0.135, 20, 16]} /></mesh>
      <mesh position={[0.66, 0.78, 0]}><boxGeometry args={[0.75, 0.22, 0.4]} /><meshStandardMaterial color={0x27404e} roughness={0.9} /></mesh>
      <mesh position={[0, 0.82, 0.26]} material={skin}><boxGeometry args={[0.5, 0.1, 0.12]} /></mesh>
      <mesh position={[0, 0.82, -0.26]} material={skin}><boxGeometry args={[0.5, 0.1, 0.12]} /></mesh>
    </group>
  );
}

/* ---- beating heart hologram ---- */
function Heart({ engine }: { engine: Engine }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xff5a6e, emissive: 0x3a0810, roughness: 0.5, transparent: true, opacity: 0.92 }), []);
  const phase = useRef(0);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const arrest = engine.phase === "arrest", dead = engine.phase === "dead", rosc = engine.phase === "rosc";
    let beat: number;
    if (dead) beat = 1;
    else if (arrest) beat = 1 + Math.sin(state.clock.elapsedTime * 22) * 0.03;
    else { phase.current += dt * (Math.max(engine.v.hr, 40) / 60); const p = phase.current % 1; beat = 1 + (p < 0.16 ? Math.sin((p / 0.16) * Math.PI) * 0.13 : 0); }
    if (group.current) { group.current.scale.setScalar(beat); group.current.rotation.y += dt * 0.3; }
    mat.color.setHex(dead ? 0x6a6f77 : arrest ? 0xff5a52 : rosc ? 0x37e08b : 0xff5a6e);
    mat.emissive.setHex(dead ? 0x141619 : arrest ? 0x5a0e0e : 0x3a0810);
  });
  return (
    <group ref={group} position={[-1.05, 1.5, -1.4]}>
      <mesh material={mat} scale={[1, 0.92, 0.9]}><sphereGeometry args={[0.16, 20, 16]} /></mesh>
      <mesh material={mat} position={[0.1, 0.06, 0]}><sphereGeometry args={[0.11, 16, 12]} /></mesh>
      <mesh material={mat} position={[0.02, -0.16, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.14, 0.26, 18]} /></mesh>
    </group>
  );
}

/* ---- controller/mouse-pointable action panel ---- */
const BTN: [ActionId, string][] = [
  ["pulse", "Pulse"], ["listen", "Listen"], ["bp", "BP"], ["ecg", "ECG"],
  ["oxygen", "O2"], ["aspirin", "Aspirin"], ["help", "Call help"], ["nitro", "Nitro"],
  ["cpr", "CPR"], ["defib", "Shock"], ["epi", "Epi"], ["wait", "Wait"],
];
function ButtonPanel({ engine }: { engine: Engine }) {
  const cols = 4, rows = 3;
  const { canvas, ctx, tex } = useCanvasTexture(768, 384);
  const flash = useRef<Record<string, number>>({});
  const draw = () => {
    const W = canvas.width, H = canvas.height, cw = W / cols, ch = H / rows;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "rgba(9,13,16,0.85)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    BTN.forEach(([id, lab], i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      const emerg = id === "cpr" || id === "defib" || id === "epi", fl = (flash.current[id] || 0) > 0;
      ctx.fillStyle = fl ? "rgba(55,224,139,0.4)" : "rgba(255,255,255,0.05)"; ctx.fillRect(cx + 6, cy + 6, cw - 12, ch - 12);
      ctx.strokeStyle = emerg ? "rgba(255,90,82,0.6)" : "rgba(160,190,200,0.35)"; ctx.lineWidth = 2; ctx.strokeRect(cx + 6, cy + 6, cw - 12, ch - 12);
      ctx.fillStyle = emerg ? "#ff8a84" : "#e9eef1"; ctx.font = "600 26px ui-monospace,monospace";
      ctx.fillText(lab, cx + cw / 2, cy + ch / 2);
    });
    tex.needsUpdate = true;
  };
  useFrame((_, delta) => { let any = false; for (const k in flash.current) if (flash.current[k] > 0) { flash.current[k] -= delta; any = true; } draw(); void any; });
  const pick = (uv?: THREE.Vector2) => {
    if (!uv) return;
    const col = Math.floor(uv.x * cols), row = Math.floor((1 - uv.y) * rows), idx = row * cols + col;
    if (idx >= 0 && idx < BTN.length) { const id = BTN[idx][0]; flash.current[id] = 0.4; engine.action(id); }
  };
  return (
    <Interactive onSelect={(e: any) => pick(e.intersection?.uv)}>
      <mesh position={[-0.55, 1.02, -0.98]} rotation={[-0.5, 0.35, 0]} onClick={(e: any) => { e.stopPropagation(); pick(e.uv); }}>
        <planeGeometry args={[0.92, 0.46]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </Interactive>
  );
}

export default function WardScene({ engine }: { engine: Engine }) {
  // Step the simulation exactly once per frame, here at the scene root.
  useFrame((_, delta) => engine.step(Math.min(delta, 0.1)));
  return (
    <group>
      <hemisphereLight args={[0x7d97b8, 0x0a0e13, 0.55]} />
      <spotLight position={[0, 3.2, -1.5]} angle={0.7} penumbra={0.6} intensity={14} distance={9} color={0xffe6c0} />
      <pointLight position={[1.3, 1.7, -1.2]} intensity={3} distance={7} color={0x9fd0ff} />
      {/* room shell */}
      <mesh position={[0, 2, -2]}>
        <boxGeometry args={[9, 4, 9]} />
        <meshStandardMaterial color={0x11161c} roughness={1} side={THREE.BackSide} />
      </mesh>
      <gridHelper args={[9, 18, 0x22303c, 0x161f28]} position={[0, 0.01, -2]} />
      {/* bed */}
      <group position={[0, 0, -1.6]}>
        <mesh position={[0, 0.32, 0]}><boxGeometry args={[2, 0.45, 0.95]} /><meshStandardMaterial color={0x1b2530} roughness={0.85} /></mesh>
        <mesh position={[0, 0.6, 0]}><boxGeometry args={[1.95, 0.14, 0.9]} /><meshStandardMaterial color={0x2a3a48} roughness={0.9} /></mesh>
        <mesh position={[-0.72, 0.7, 0]}><boxGeometry args={[0.42, 0.12, 0.6]} /><meshStandardMaterial color={0x35485a} roughness={0.9} /></mesh>
      </group>
      <Patient engine={engine} />
      <Monitor engine={engine} />
      <Heart engine={engine} />
      <ButtonPanel engine={engine} />
    </group>
  );
}
