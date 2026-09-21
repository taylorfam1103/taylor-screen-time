"use client";

import { useEffect, useRef, useState } from "react";
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
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(profiles[0]?.id || "");
  const profile = profiles.find(p => p.id === selected) || profiles[0];
  const [weeklyHours, setWeeklyHours] = useState(profile ? profile.weeklyAllowanceMinutes / 60 : 10);
  const [dailyHours, setDailyHours] = useState(profile ? profile.dailyLimitMinutes / 60 : 3);
  const [enabled, setEnabled] = useState(profile?.trackingEnabled ?? true);
  const [deductCustom, setDeductCustom] = useState("");
  const [bonusCustom, setBonusCustom] = useState("");
  const [deductNote, setDeductNote] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);

  useEffect(() => {
    if (!profile) return;
    setWeeklyHours(profile.weeklyAllowanceMinutes / 60);
    setDailyHours(profile.dailyLimitMinutes / 60);
    setEnabled(profile.trackingEnabled);
    setError("");
    setNotice("");
    setDeductCustom("");
    setBonusCustom("");
    setDeductNote("");
    setBonusNote("");
    if (admin) {
      fetch(`/api/history?profileId=${profile.id}`, { cache: "no-store" })
        .then(async r => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error || "Could not load history.");
          return body;
        })
        .then(setHistory)
        .catch(() => setHistory(null));
    }
  }, [profile?.id, admin, profile?.weeklyAllowanceMinutes, profile?.dailyLimitMinutes, profile?.trackingEnabled]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Incorrect PIN.");
      setAdmin(true);
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Incorrect PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshHistory() {
    if (!profile) return;
    try {
      const res = await fetch(`/api/history?profileId=${profile.id}`, { cache: "no-store" });
      const body = await res.json();
      if (res.ok) setHistory(body);
    } catch {
      // Summary data is more important than history. Do not leave controls locked if history refresh fails.
    }
  }

  async function saveSettings() {
    if (!profile || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          weeklyAllowanceMinutes: Math.round(weeklyHours * 60),
          dailyLimitMinutes: Math.round(dailyHours * 60),
          trackingEnabled: enabled
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save.");
      await onChanged();
      setNotice("Settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  async function adjust(kind: "bonus" | "deduction", minutes: number, customNote?: string) {
    if (!profile || actionInFlight.current) return;
    const roundedMinutes = Math.round(minutes);
    if (!Number.isFinite(roundedMinutes) || roundedMinutes <= 0 || roundedMinutes > 1440) {
      setError("Enter an amount between 1 and 1,440 minutes.");
      return;
    }

    actionInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          kind,
          minutes: roundedMinutes,
          note: customNote?.trim() || (kind === "bonus" ? "Parent bonus" : "Manual screen time")
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not adjust time.");
      await onChanged();
      await refreshHistory();
      if (kind === "deduction") {
        setDeductCustom("");
        setDeductNote("");
        setNotice(`Removed ${formatAdjustment(roundedMinutes)} from ${profile.name}.`);
      } else {
        setBonusCustom("");
        setBonusNote("");
        setNotice(`Added ${formatAdjustment(roundedMinutes)} to ${profile.name}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not adjust time.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  async function undo(id: string) {
    if (actionInFlight.current || !confirm("Undo this manual adjustment?")) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/adjustments?id=${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not undo adjustment.");
      await onChanged();
      await refreshHistory();
      setNotice("Manual adjustment undone.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo adjustment.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  if (!admin) {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <section className="parent-panel pin-panel" role="dialog" aria-modal="true" aria-label="Parent Mode">
          <button type="button" className="close-button" onClick={onClose} aria-label="Close">×</button>
          <div className="lock-icon">🔒</div>
          <h2>Parent Mode</h2>
          <p>Enter the parent PIN to change allowances, add bonus time, or deduct missed screen time.</p>
          <form onSubmit={login}>
            <input className="pin-input" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="••••" aria-label="Parent PIN" />
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="primary-button" disabled={busy || !pin}>{busy ? "Checking…" : "Unlock"}</button>
          </form>
        </section>
      </div>
    );
  }

  const manualChanges = history?.activity.filter(a => a.editable).slice(0, 10) || [];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="parent-panel" role="dialog" aria-modal="true" aria-label="Parent controls">
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">×</button>
        <div className="parent-title">
          <div><span className="eyebrow">PARENT CONTROLS</span><h2>Time HQ</h2></div>
          <span className="secure-pill">🔒 Unlocked</span>
        </div>

        <div className="profile-picker" aria-label="Choose family member">
          {profiles.map(p => (
            <button type="button" key={p.id} className={p.id === profile?.id ? "selected" : ""} onClick={() => setSelected(p.id)}>
              <Image src={p.avatarPath} width={52} height={52} alt="" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        {profile && <>
          <div className="admin-section">
            <h3>{profile.name}&apos;s setup</h3>
            <label className="toggle-row">
              <span><b>Track screen time</b><small>Show timer and weekly balance</small></span>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            </label>
            <div className="input-grid">
              <label><span>Weekly allowance</span><div className="number-unit"><input type="number" min="0" max="168" step="0.5" value={weeklyHours} onChange={e => setWeeklyHours(Number(e.target.value))} /><b>hours</b></div></label>
              <label><span>Daily soft limit</span><div className="number-unit"><input type="number" min="0.25" max="24" step="0.25" value={dailyHours} onChange={e => setDailyHours(Number(e.target.value))} /><b>hours</b></div></label>
            </div>
            <div className="rule-note">Rollover is capped at <b>2 hours</b>. Normal weekly starting balance caps at <b>12 hours</b>. Negative time carries forward.</div>
            <button type="button" className="primary-button" onClick={saveSettings} disabled={busy}>Save settings</button>
          </div>

          <div className="admin-section adjustment-section deduction-section">
            <div className="adjustment-heading">
              <div><span className="adjustment-symbol">−</span><div><h3>Deduct missed screen time</h3><p>Use this when the timer was not started.</p></div></div>
            </div>
            <div className="adjust-preset-grid">
              {[15, 30, 60, 90, 120].map(m => (
                <button type="button" className="deduct" key={`d${m}`} onClick={() => adjust("deduction", m)} disabled={busy}>
                  −{formatAdjustment(m)}
                </button>
              ))}
            </div>
            <div className="custom-adjust-stack">
              <label>
                <span>Custom minutes to deduct</span>
                <div className="number-unit"><input type="number" inputMode="numeric" min="1" max="1440" placeholder="e.g. 75" value={deductCustom} onChange={e => setDeductCustom(e.target.value.replace(/[^0-9]/g, ""))} /><b>min</b></div>
              </label>
              <input className="note-input" value={deductNote} onChange={e => setDeductNote(e.target.value)} placeholder="Note (optional), e.g. forgot timer" />
              <button type="button" className="danger-button" onClick={() => adjust("deduction", Number(deductCustom), deductNote)} disabled={busy || !deductCustom || Number(deductCustom) <= 0}>Deduct time</button>
            </div>
          </div>

          <div className="admin-section adjustment-section bonus-section">
            <div className="adjustment-heading">
              <div><span className="adjustment-symbol">+</span><div><h3>Add bonus time</h3><p>Bonus time is only added when you tap one of these buttons.</p></div></div>
            </div>
            <div className="adjust-preset-grid bonus-presets">
              {[15, 30, 60].map(m => (
                <button type="button" className="bonus" key={`b${m}`} onClick={() => adjust("bonus", m)} disabled={busy}>
                  +{formatAdjustment(m)}
                </button>
              ))}
            </div>
            <div className="custom-adjust-stack">
              <label>
                <span>Custom bonus minutes</span>
                <div className="number-unit"><input type="number" inputMode="numeric" min="1" max="1440" placeholder="e.g. 20" value={bonusCustom} onChange={e => setBonusCustom(e.target.value.replace(/[^0-9]/g, ""))} /><b>min</b></div>
              </label>
              <input className="note-input" value={bonusNote} onChange={e => setBonusNote(e.target.value)} placeholder="Reason (optional)" />
              <button type="button" className="bonus-button" onClick={() => adjust("bonus", Number(bonusCustom), bonusNote)} disabled={busy || !bonusCustom || Number(bonusCustom) <= 0}>Add bonus</button>
            </div>
          </div>

          {(error || notice) && <div className={error ? "form-error status-message" : "form-success status-message"} aria-live="polite">{error || notice}</div>}

          <div className="admin-section recent-changes-section">
            <h3>Recent manual changes</h3>
            <div className="admin-activity">
              {manualChanges.map(a => (
                <div className="admin-activity-row" key={a.id}>
                  <span className={`activity-icon ${a.kind}`}>{a.kind === "bonus" ? "+" : "−"}</span>
                  <div><b>{a.note}</b><small>{a.kind === "bonus" ? "+" : "−"}{formatAdjustment(a.minutes)} · {new Date(a.occurredAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></div>
                  <button type="button" onClick={() => undo(a.id)} disabled={busy}>Undo</button>
                </div>
              ))}
              {!manualChanges.length && <div className="muted">No manual changes yet.</div>}
            </div>
          </div>
        </>}
      </section>
    </div>
  );
}

function formatAdjustment(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}
