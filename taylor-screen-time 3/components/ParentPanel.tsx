"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { HistoryResponse, ProfileSummary } from "@/lib/types";

export default function ParentPanel({ profiles, admin, setAdmin, onClose, onChanged }: {
  profiles: ProfileSummary[];
  admin: boolean;
  setAdmin: (value: boolean) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(profiles[0]?.id || "");
  const profile = profiles.find(p => p.id === selected) || profiles[0];
  const [weeklyHours, setWeeklyHours] = useState(profile ? profile.weeklyAllowanceMinutes / 60 : 10);
  const [dailyHours, setDailyHours] = useState(profile ? profile.dailyLimitMinutes / 60 : 3);
  const [enabled, setEnabled] = useState(profile?.trackingEnabled ?? true);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [customKind, setCustomKind] = useState<"bonus" | "deduction">("bonus");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setWeeklyHours(profile.weeklyAllowanceMinutes / 60);
    setDailyHours(profile.dailyLimitMinutes / 60);
    setEnabled(profile.trackingEnabled);
    if (admin) fetch(`/api/history?profileId=${profile.id}`).then(r => r.json()).then(setHistory).catch(() => null);
  }, [profile?.id, admin, profile?.weeklyAllowanceMinutes, profile?.dailyLimitMinutes, profile?.trackingEnabled]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    const body = await res.json();
    if (res.ok) { setAdmin(true); setPin(""); } else setError(body.error || "Incorrect PIN.");
    setBusy(false);
  }

  async function saveSettings() {
    if (!profile) return;
    setBusy(true); setError("");
    const res = await fetch("/api/admin/profiles", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id, weeklyAllowanceMinutes: Math.round(weeklyHours * 60), dailyLimitMinutes: Math.round(dailyHours * 60), trackingEnabled: enabled })
    });
    const body = await res.json();
    if (!res.ok) setError(body.error || "Could not save.");
    await onChanged(); setBusy(false);
  }

  async function adjust(kind: "bonus" | "deduction", minutes: number, customNote?: string) {
    if (!profile) return;
    setBusy(true); setError("");
    const res = await fetch("/api/admin/adjustments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id, kind, minutes, note: customNote || (kind === "bonus" ? "Parent bonus" : "Manual screen time") })
    });
    const body = await res.json();
    if (!res.ok) setError(body.error || "Could not adjust time.");
    await onChanged();
    const h = await fetch(`/api/history?profileId=${profile.id}`).then(r => r.json()); setHistory(h);
    setBusy(false);
  }

  async function undo(id: string) {
    if (!confirm("Undo this manual adjustment?")) return;
    setBusy(true);
    await fetch(`/api/admin/adjustments?id=${id}`, { method: "DELETE" });
    await onChanged();
    if (profile) setHistory(await fetch(`/api/history?profileId=${profile.id}`).then(r => r.json()));
    setBusy(false);
  }

  if (!admin) {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <section className="parent-panel pin-panel" role="dialog" aria-modal="true">
          <button className="close-button" onClick={onClose}>×</button>
          <div className="lock-icon">🔒</div>
          <h2>Parent Mode</h2>
          <p>Enter the parent PIN to change allowances, add bonus time, or deduct missed screen time.</p>
          <form onSubmit={login}>
            <input className="pin-input" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="••••" aria-label="Parent PIN" />
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={busy || !pin}>{busy ? "Checking…" : "Unlock"}</button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="parent-panel" role="dialog" aria-modal="true">
        <button className="close-button" onClick={onClose}>×</button>
        <div className="parent-title"><div><span className="eyebrow">PARENT CONTROLS</span><h2>Time HQ</h2></div><span className="secure-pill">🔒 Unlocked</span></div>
        <div className="profile-picker">
          {profiles.map(p => <button key={p.id} className={p.id === profile?.id ? "selected" : ""} onClick={() => setSelected(p.id)}><Image src={p.avatarPath} width={52} height={52} alt="" /><span>{p.name}</span></button>)}
        </div>

        {profile && <>
          <div className="admin-section">
            <h3>{profile.name}&apos;s setup</h3>
            <label className="toggle-row"><span><b>Track screen time</b><small>Show timer and weekly balance</small></span><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /></label>
            <div className="input-grid">
              <label><span>Weekly allowance</span><div className="number-unit"><input type="number" min="0" max="168" step="0.5" value={weeklyHours} onChange={e => setWeeklyHours(Number(e.target.value))} /><b>hours</b></div></label>
              <label><span>Daily soft limit</span><div className="number-unit"><input type="number" min="0.25" max="24" step="0.25" value={dailyHours} onChange={e => setDailyHours(Number(e.target.value))} /><b>hours</b></div></label>
            </div>
            <div className="rule-note">Rollover is capped at <b>2 hours</b>. Normal weekly starting balance caps at <b>12 hours</b>. Negative time carries forward.</div>
            <button className="primary-button" onClick={saveSettings} disabled={busy}>Save settings</button>
          </div>

          <div className="admin-section">
            <h3>Adjust time</h3>
            <div className="quick-adjust-grid">
              {[15,30,60].map(m => <button key={`b${m}`} onClick={() => adjust("bonus", m)} disabled={busy}>+{m === 60 ? "1 hr" : `${m}m`}</button>)}
              {[15,30,60].map(m => <button className="deduct" key={`d${m}`} onClick={() => adjust("deduction", m)} disabled={busy}>−{m === 60 ? "1 hr" : `${m}m`}</button>)}
            </div>
            <div className="custom-adjust">
              <div className="segmented"><button className={customKind === "bonus" ? "on" : ""} onClick={() => setCustomKind("bonus")}>Add</button><button className={customKind === "deduction" ? "on deduct" : ""} onClick={() => setCustomKind("deduction")}>Deduct</button></div>
              <div className="number-unit"><input type="number" min="1" max="1440" value={customMinutes} onChange={e => setCustomMinutes(Number(e.target.value))} /><b>min</b></div>
              <input className="note-input" value={note} onChange={e => setNote(e.target.value)} placeholder={customKind === "bonus" ? "Why? (optional)" : "Forgot to start timer…"} />
              <button className="primary-button" onClick={() => adjust(customKind, customMinutes, note)} disabled={busy || customMinutes <= 0}>Apply</button>
            </div>
          </div>

          <div className="admin-section">
            <h3>Recent manual changes</h3>
            <div className="admin-activity">
              {history?.activity.filter(a => a.editable).slice(0, 8).map(a => <div className="admin-activity-row" key={a.id}><span className={`activity-icon ${a.kind}`}>{a.kind === "bonus" ? "+" : "−"}</span><div><b>{a.note}</b><small>{a.minutes} min · {new Date(a.occurredAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></div><button onClick={() => undo(a.id)} disabled={busy}>Undo</button></div>)}
              {!history?.activity.filter(a => a.editable).length && <div className="muted">No manual changes yet.</div>}
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
        </>}
      </section>
    </div>
  );
}
