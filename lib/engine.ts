// Early Recognition Trainer — sim engine (ported from the single-file build).
// Deterministic MI -> VF-arrest scenario. Framework-agnostic: no React, no three.js.
// Drive it with step(dt) each frame; read `v` (vitals) and `phase` for rendering.

export type Phase = "ischemia" | "arrest" | "rosc" | "dead";
export type LogKind = "sys" | "you" | "pt" | "bad" | "doctor";
export interface Vitals { hr: number; sbp: number; dbp: number; spo2: number; rr: number; }
export interface LogMsg { t: number; kind: LogKind; who: string; text: string; }

export type ActionId =
  | "pulse" | "listen" | "bp" | "airway" | "ecg"
  | "oxygen" | "aspirin" | "help" | "nitro"
  | "cpr" | "defib" | "epi" | "wait";

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

export class Engine {
  t = 0; running = false; ended = false;
  phase: Phase = "ischemia";
  o2 = false; aspirin = false; help = false; nitro = false; ecgDone = false;
  cpr = false; shocks = 0; epi = 0;
  arrestAt = 120; arrestT = 0; roscT = 0; deadWindow = 120;
  cprStartedT: number | null = null; firstShockT: number | null = null;
  helpT: number | null = null; aspirinT: number | null = null; recognizedArrestT: number | null = null;
  v: Vitals = { hr: 96, sbp: 150, dbp: 92, spo2: 94, rr: 22 };
  log: LogMsg[] = [];
  onLog?: (m: LogMsg) => void;
  onEnd?: (win: boolean) => void;

  private computeArrestAt() {
    return 120 + (this.help ? 18 : 0) + (this.aspirin ? 12 : 0) + (this.o2 ? 10 : 0);
  }

  start() { this.running = true; this.t = 0; this.computeVitals(); }

  step(dt: number) {
    if (!this.running) return;
    this.t += dt;
    this.computeVitals();
  }

  computeVitals() {
    const v = this.v;
    if (this.phase === "ischemia") {
      const p = clamp(this.t / this.arrestAt, 0, 1);
      v.hr = Math.round(96 + 34 * p);
      v.sbp = Math.round(150 - 66 * p);
      v.dbp = Math.round(v.sbp * 0.62);
      let base = 94 - 6 * p; if (this.o2) base += 3.5;
      v.spo2 = Math.round(clamp(base, 84, 99));
      v.rr = Math.round(22 + 8 * p);
      if (this.t >= this.arrestAt) this.enterArrest();
    } else if (this.phase === "arrest") {
      v.hr = 0; v.sbp = 0; v.dbp = 0; v.rr = 0;
      const since = this.t - this.arrestT;
      const floor = this.cpr ? 68 : 42;
      v.spo2 = Math.round(clamp(72 - since * 0.6 + (this.cpr ? 8 : 0), floor, 80));
      if (this.cpr && this.shocks >= 1 && this.firstShockT !== null && (this.t - this.firstShockT) >= 8) {
        this.enterRosc();
      } else if (since > this.deadWindow) {
        this.enterDead();
      }
    } else if (this.phase === "rosc") {
      const q = clamp((this.t - this.roscT) / 40, 0, 1);
      v.hr = Math.round(118 - 30 * q);
      v.sbp = Math.round(78 + 34 * q);
      v.dbp = Math.round(v.sbp * 0.62);
      v.spo2 = Math.round(clamp(88 + 9 * q, 88, 99));
      v.rr = Math.round(24 - 6 * q);
    } else { // dead
      v.hr = 0; v.sbp = 0; v.dbp = 0; v.spo2 = 0; v.rr = 0;
    }
  }

  private enterArrest() {
    if (this.phase !== "ischemia") return;
    this.phase = "arrest"; this.arrestT = this.t;
    this.say("sys", "MONITOR", "⚠ Ventricular fibrillation — the waveform just went chaotic. He slumps back, unresponsive.");
    this.say("sys", "MONITOR", "No palpable pulse. This is a cardiac arrest.");
  }
  private enterRosc() {
    this.phase = "rosc"; this.roscT = this.t;
    this.say("pt", "MONITOR", "A rhythm returns — narrow complexes, a real pulse. ROSC.");
    this.say("sys", "CHARGE RN", "\"Good work — we've got him back.\"");
    this.end(true);
  }
  private enterDead() {
    this.phase = "dead";
    this.say("bad", "MONITOR", "The rhythm has gone flat. Prolonged arrest without effective resuscitation.");
    this.end(false);
  }
  private end(win: boolean) {
    if (this.ended) return; this.ended = true; this.running = false;
    if (this.onEnd) this.onEnd(win);
  }

  inArrest() { return this.phase === "arrest"; }

  say(kind: LogKind, who: string, text: string) {
    const m: LogMsg = { t: this.t, kind, who, text };
    this.log.push(m);
    if (this.onLog) this.onLog(m);
  }
  private say2(you: string, who: string, txt: string) { this.say("you", "YOU", you); this.say("pt", who, txt); }
  private gate(name: string) {
    this.say("bad", "STOP", `${name} on a patient who still has a pulse and a pressure would cause harm. He's having a heart attack, not an arrest — what does he need right now?`);
  }

  action(a: ActionId) {
    if (this.ended) return;
    const v = this.v;
    switch (a) {
      case "wait": if (this.running) { this.t += 15; this.computeVitals(); } return;
      case "pulse":
        if (this.inArrest()) { if (this.recognizedArrestT === null) this.recognizedArrestT = this.t; this.say("you", "YOU", "Check a carotid pulse."); this.say("bad", "FINDING", "No pulse. He is pulseless."); }
        else this.say2("Check a radial pulse.", "FINDING", `Pulse ${v.hr} bpm — fast and thready.`); return;
      case "listen":
        if (this.inArrest()) { this.say("you", "YOU", "Listen for breath sounds."); this.say("bad", "FINDING", "No spontaneous breathing."); }
        else this.say2("Listen to the chest.", "FINDING", "Tachycardic, lungs clear. \"It's like an elephant on my chest.\""); return;
      case "bp":
        if (this.inArrest()) this.say2("Cycle a blood pressure.", "FINDING", "No measurable pressure.");
        else this.say2("Cycle a blood pressure.", "FINDING", `BP ${v.sbp}/${v.dbp} mmHg.`); return;
      case "airway":
        if (this.inArrest()) this.say2("Check the airway.", "FINDING", "Airway open — but he is not breathing on his own.");
        else this.say2("Check the airway.", "FINDING", "Airway patent, speaking in short sentences."); return;
      case "ecg":
        this.ecgDone = true;
        if (this.inArrest()) this.say2("Read the rhythm.", "12-LEAD", "Coarse ventricular fibrillation — a shockable rhythm.");
        else this.say2("Run a 12-lead.", "12-LEAD", "ST-segment elevation, anterior leads. This is a STEMI — an evolving heart attack."); return;
      case "oxygen":
        if (this.o2) { this.say("sys", "NOTE", "Oxygen already running."); return; }
        this.o2 = true; this.say2("Apply high-flow oxygen.", "PATIENT", "\"...that's a little easier.\""); this.arrestAt = this.computeArrestAt(); return;
      case "aspirin":
        if (this.aspirin) { this.say("sys", "NOTE", "Aspirin already given."); return; }
        if (this.inArrest()) { this.say("bad", "NOTE", "He can't swallow in arrest — not now."); return; }
        this.aspirin = true; this.aspirinT = this.t; this.say2("Give 324 mg aspirin, chewed.", "PATIENT", "He chews it down. (Right call for a suspected MI.)"); this.arrestAt = this.computeArrestAt(); return;
      case "help":
        if (this.help) { this.say("sys", "NOTE", "Rapid response already coming."); return; }
        this.help = true; this.helpT = this.t; this.say2("Call the rapid response / code team.", "CHARGE RN", "\"On my way — bringing the crash cart and defibrillator.\""); this.arrestAt = this.computeArrestAt(); return;
      case "nitro":
        if (this.inArrest()) { this.say("bad", "NOTE", "Not in a pulseless arrest."); return; }
        if (v.sbp < 100) { this.say("bad", "CAUTION", `His pressure is ${v.sbp} — nitro could drop it dangerously. Hold it.`); this.nitro = true; return; }
        this.nitro = true; this.say2("Give sublingual nitroglycerin.", "PATIENT", "\"The pressure eased off a bit.\""); return;
      case "cpr":
        if (!this.inArrest()) { this.gate("CPR"); return; }
        if (this.cpr) { this.say("sys", "NOTE", "Compressions already in progress."); return; }
        this.cpr = true; this.cprStartedT = this.t; if (this.recognizedArrestT === null) this.recognizedArrestT = this.t;
        this.say2("Start chest compressions — hard and fast.", "TEAM", "Compressions underway."); return;
      case "defib":
        if (!this.inArrest()) { this.gate("Defibrillation"); return; }
        if (!this.help) { this.say("bad", "NOTE", "There's no defibrillator at the bedside yet — you never called for the cart."); return; }
        this.shocks++; if (this.firstShockT === null) this.firstShockT = this.t;
        this.say2("Charge to 200 J — clear — shock.", "TEAM", `The body jolts. ${this.cpr ? "Resume compressions." : "⚠ Get compressions going!"}`); return;
      case "epi":
        if (!this.inArrest()) { this.gate("Epinephrine"); return; }
        this.epi++; this.say2("1 mg epinephrine IV.", "TEAM", "Epi is in. Continue the cycle."); return;
    }
  }

  scoreChecks() {
    const fmt = (t: number) => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`; };
    const cprFast = this.cprStartedT !== null && (this.cprStartedT - this.arrestT) <= 15;
    return [
      { pass: this.aspirin, label: "Recognized the MI and gave aspirin", ev: this.aspirin && this.aspirinT !== null ? `at ${fmt(this.aspirinT)}` : "never given" },
      { pass: this.help && this.helpT !== null, label: "Called for help", ev: this.help && this.helpT !== null ? `paged at ${fmt(this.helpT)}` : "never called" },
      { pass: cprFast, label: "Started CPR within 15s of arrest", ev: this.cprStartedT !== null ? `${Math.round(this.cprStartedT - this.arrestT)}s after collapse` : "CPR never started" },
      { pass: this.shocks >= 1, label: "Defibrillated the shockable rhythm", ev: this.shocks > 0 ? `${this.shocks} shock(s)` : "never shocked" },
      { pass: this.o2, label: "Supported oxygenation", ev: this.o2 ? "high-flow O2 applied" : "no oxygen" },
    ];
  }
}
