"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProfileCard from "@/components/ProfileCard";
import PersonModal from "@/components/PersonModal";
import ParentPanel from "@/components/ParentPanel";
import type { ProfileSummary, SummaryResponse } from "@/lib/types";

export default function AppShell() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [parentOpen, setParentOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/summary", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load data.");
      setData(body);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load data.");
    }
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/admin/status").then(r => r.json()).then(b => setAdmin(Boolean(b.admin))).catch(() => null);
    const refreshId = window.setInterval(refresh, 15000);
    const tickId = window.setInterval(() => setTick(Date.now()), 1000);
    return () => { window.clearInterval(refreshId); window.clearInterval(tickId); };
  }, [refresh]);

  useEffect(() => {
    const modalOpen = Boolean(selected) || parentOpen;
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [selected, parentOpen]);

  const liveProfiles = useMemo(() => {
    if (!data) return new Map<string, ProfileSummary>();
    const elapsedSinceFetch = Math.max(0, Math.floor((tick - new Date(data.serverNow).getTime()) / 1000));
    return new Map(data.profiles.map(p => {
      if (!p.activeSessionStartedAt) return [p.id, p];
      return [p.id, { ...p, remainingSeconds: p.remainingSeconds - elapsedSinceFetch, todayUsedSeconds: p.todayUsedSeconds + elapsedSinceFetch, weekUsedSeconds: p.weekUsedSeconds + elapsedSinceFetch, suggestedDailySeconds: Math.max(0, Math.round((p.remainingSeconds - elapsedSinceFetch) / p.daysRemaining)), dailyLimitReached: p.todayUsedSeconds + elapsedSinceFetch >= p.dailyLimitMinutes * 60 }];
    }));
  }, [data, tick]);

  const selectedProfile = data?.profiles.find(p => p.id === selected) || null;
  const activeCount = data?.profiles.filter(p => p.activeSessionStartedAt).length || 0;

  return (
    <main className="app-shell">
      <div className="bg-orb orb-one" /><div className="bg-orb orb-two" />
      <header className="app-header">
        <div>
          <span className="brand-kicker">TAYLOR FAMILY</span>
          <h1>Screen Time <span>🎮</span></h1>
          <p>Play smart. Make your time count.</p>
        </div>
        <button className="parent-button" onClick={() => setParentOpen(true)}>🔒 <span>Parent</span></button>
      </header>

      {data && <div className="week-strip"><span>THIS WEEK</span><b>{new Date(`${data.weekStart}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })} → {new Date(`${data.weekEnd}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}</b><i>{activeCount ? `${activeCount} active now` : "Nobody playing right now"}</i></div>}

      {loadError && <div className="setup-error"><b>Almost there.</b><span>{loadError}</span><small>If this is your first launch, finish the Supabase + Vercel setup in README.md.</small></div>}

      {!data && !loadError && <div className="loading-grid">Loading the family time bank…</div>}

      {data && <section className="profiles-grid">
        {data.profiles.map(profile => <ProfileCard key={profile.id} profile={profile} liveProfile={liveProfiles.get(profile.id) || profile} onOpen={() => setSelected(profile.id)} />)}
      </section>}

      <footer className="app-footer"><span>⭐</span> Monday resets · up to 2h rolls over · real usage always wins</footer>

      {selectedProfile && <PersonModal profile={selectedProfile} liveProfile={liveProfiles.get(selectedProfile.id) || selectedProfile} onClose={() => setSelected(null)} onChanged={refresh} admin={admin} />}
      {parentOpen && data && <ParentPanel profiles={data.profiles} admin={admin} setAdmin={setAdmin} onClose={() => setParentOpen(false)} onChanged={refresh} />}
    </main>
  );
}
