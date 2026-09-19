export type ProfileColor = "blue" | "green" | "orange" | "gold" | "pink";

export type ProfileSummary = {
  id: string;
  slug: string;
  name: string;
  color: ProfileColor;
  avatarPath: string;
  trackingEnabled: boolean;
  weeklyAllowanceMinutes: number;
  dailyLimitMinutes: number;
  remainingSeconds: number;
  todayUsedSeconds: number;
  weekUsedSeconds: number;
  openingBalanceMinutes: number;
  rolloverMinutes: number;
  bonusMinutes: number;
  deductionMinutes: number;
  activeSessionStartedAt: string | null;
  daysRemaining: number;
  suggestedDailySeconds: number;
  dailyLimitReached: boolean;
};

export type SummaryResponse = {
  serverNow: string;
  weekStart: string;
  weekEnd: string;
  profiles: ProfileSummary[];
};

export type HistoryResponse = {
  daily: { date: string; usedSeconds: number; label: string }[];
  weeks: {
    weekStart: string;
    openingMinutes: number;
    usedMinutes: number;
    bonusMinutes: number;
    endingMinutes: number;
  }[];
  activity: {
    id: string;
    kind: "session" | "bonus" | "deduction";
    occurredAt: string;
    minutes: number;
    note: string;
    editable: boolean;
  }[];
};
