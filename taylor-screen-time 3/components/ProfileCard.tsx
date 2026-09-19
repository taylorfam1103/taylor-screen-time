"use client";

import Image from "next/image";
import type { ProfileSummary } from "@/lib/types";

function duration(seconds: number, compact = false) {
  const negative = seconds < 0;
  const abs = Math.abs(Math.round(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  if (compact) return `${negative ? "−" : ""}${h}h ${m}m`;
  return `${negative ? "−" : ""}${h}:${String(m).padStart(2, "0")}`;
}

export default function ProfileCard({ profile, liveProfile, onOpen }: {
  profile: ProfileSummary;
  liveProfile: ProfileSummary;
  onOpen: () => void;
}) {
  const active = Boolean(profile.activeSessionStartedAt);
  const weeklyTotal = Math.max(1, (profile.openingBalanceMinutes + profile.bonusMinutes) * 60);
  const pct = Math.max(0, Math.min(100, (liveProfile.remainingSeconds / weeklyTotal) * 100));

  return (
    <button className={`profile-card theme-${profile.color} ${active ? "is-active" : ""}`} onClick={onOpen}>
      <div className="avatar-wrap">
        <Image src={profile.avatarPath} alt={`${profile.name} avatar`} width={128} height={128} priority />
        {active && <span className="active-dot">ACTIVE</span>}
      </div>
      <div className="profile-copy">
        <div className="profile-name-row">
          <h2>{profile.name}</h2>
          {!profile.trackingEnabled && <span className="inactive-pill">Not tracking</span>}
        </div>
        {profile.trackingEnabled ? (
          <>
            <div className={`remaining ${liveProfile.remainingSeconds < 0 ? "negative" : ""}`}>{duration(liveProfile.remainingSeconds)}</div>
            <div className="remaining-label">left this week</div>
            <div className="meter"><span style={{ width: `${pct}%` }} /></div>
            <div className="card-stats">
              <span><b>{duration(liveProfile.todayUsedSeconds, true)}</b> today</span>
              <span><b>{profile.daysRemaining}</b> days left</span>
              <span><b>{duration(liveProfile.suggestedDailySeconds, true)}</b>/day</span>
            </div>
          </>
        ) : (
          <p className="inactive-copy">Enable this profile anytime from Parent Mode.</p>
        )}
      </div>
      <span className="open-arrow">›</span>
    </button>
  );
}
