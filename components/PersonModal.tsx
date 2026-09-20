"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { HistoryResponse, ProfileSummary } from "@/lib/types";

function clock(seconds: number) {
  const negative = seconds < 0;
  const abs = Math.abs(Math.round(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return `${negative ? "−" : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function hm(seconds: number) {
  const negative = seconds < 0;
  const abs = Math.abs(Math.round(seconds));
  return `${negative ? "−" : ""}${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m`;
}

export default function PersonModal({ profile, liveProfile, onClose, onChanged, admin }: {
  profile: ProfileSummary;
  liveProfile: ProfileSummary;
  onClose: () => void;
  onChanged: () => Promise<void>;
  admin: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState("");

  const active = Boolean(profile.activeSessionStartedAt);
  const todayPct = Math.min(100, (liveProfile.todayUsedSeconds / (profile.dailyLimitMinutes * 60)) * 100);

  async function toggleTimer() {
    setBusy(true); setError("");
    const res = await fetch(active ? "/api/sessions/stop" : "/api/sessions/start", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: profile.id })
    });
    const body = await res.json();
    if (!res.ok) setError(body.error || "Something went wrong.");
    await onChanged();
    setBusy(false);
  }

  useEffect(() => {
    fetch(`/api/history?profileId=${profile.id}`).then(r => r.json()).then(setHistory).catch(() => null);
  }, [profile.id, profile.weekUsedSeconds, profile.remainingSeconds]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`person-modal theme-${profile.color}`} role="dialog" aria-modal="true" aria-label={`${profile.name} screen time`}>
        <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        <div className="person-hero">
          <Image src={profile.avatarPath} width={150} height={150} alt={`${profile.name} avatar`} />
          <div>
            <div className="eyebrow">{active ? "SCREEN TIME ACTIVE" : "TIME BANK"}</div>
            <h2>{profile.name}</h2>
            {profile.trackingEnabled && <div className={`hero-clock ${liveProfile.remainingSeconds < 0 ? "negative" : ""}`}>{clock(liveProfile.remainingSeconds)}</div>}
          </div>
        </div>

        {!profile.trackingEnabled ? (
          <div className="empty-state">This profile is ready to go. Turn tracking on from <b>Parent Mode</b>.</div>
        ) : (
          <>
            {liveProfile.dailyLimitReached && <div className="limit-warning">⚠️ Daily 3-hour limit reached. The timer will keep recording actual usage.</div>}
            <button className={`timer-button ${active ? "stop" : "start"}`} onClick={toggleTimer} disabled={busy}>
              {busy ? "Working…" : active ? "■  STOP SCREEN TIME" : "▶  START SCREEN TIME"}
            </button>
            {error && <div className="form-error">{error}</div>}

            <div className="stat-grid">
              <div><span>Today</span><b>{hm(liveProfile.todayUsedSeconds)}</b></div>
              <div><span>This week</span><b>{hm(liveProfile.weekUsedSeconds)}</b></div>
              <div><span>Days left</span><b>{profile.daysRemaining}</b></div>
              <div><span>Suggested pace</span><b>{hm(liveProfile.suggestedDailySeconds)}/day</b></div>
            </div>

            <div className="daily-limit-card">
              <div className="section-heading"><span>Today&apos;s screen time</span><b>{hm(liveProfile.todayUsedSeconds)} / {hm(profile.dailyLimitMinutes * 60)}</b></div>
              <div className="daily-meter"><span style={{ width: `${todayPct}%` }} /></div>
            </div>

            {history && (
              <>
                <div className="history-card">
                  <div className="section-heading"><span>This week</span><span>Monday → Sunday</span></div>
                  <div className="day-bars">
                    {history.daily.map((d) => {
                      const pct = Math.min(100, (d.usedSeconds / (profile.dailyLimitMinutes * 60)) * 100);
                      return <div className="day-bar" key={d.date}><div className="bar-track"><span style={{ height: `${Math.max(3, pct)}%` }} /></div><b>{d.label}</b><small>{Math.round(d.usedSeconds / 60)}m</small></div>;
                    })}
                  </div>
                </div>

                <div className="activity-card">
                  <div className="section-heading"><span>Recent activity</span>{admin && <small>Parent edits available in Parent Mode</small>}</div>
                  <div className="activity-list">
                    {history.activity.slice(0, 6).map((a) => (
                      <div className="activity-row" key={`${a.kind}-${a.id}`}>
                        <span className={`activity-icon ${a.kind}`}>{a.kind === "bonus" ? "+" : a.kind === "deduction" ? "−" : "◷"}</span>
                        <div><b>{a.note}</b><small>{new Date(a.occurredAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></div>
                        <strong>{a.kind === "bonus" ? "+" : a.kind === "deduction" ? "−" : ""}{a.minutes}m</strong>
                      </div>
                    ))}
                    {!history.activity.length && <div className="muted">No activity yet.</div>}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
