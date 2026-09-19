# Taylor Screen Time Tracker 🎮

A private family screen-time tracker built for iPhone/iPad/laptop using **Next.js + Vercel + Supabase**.

## What is already built

- Zayn and Judah start at **10 hours/week**
- Monday midnight reset (America/Chicago by default)
- **3-hour daily soft limit** that warns but keeps counting
- Up to **2 hours positive rollover**
- Normal weekly starting balance capped at **12 hours**
- Negative balances carry into the next week with no forgiveness
- Multiple family timers can run at the same time
- Manual parent **Add Time** and **Deduct Time**
- Manual deductions count as actual usage for that day/week
- Parent PIN mode
- Undo manual adjustments
- Daily/weekly history
- Maizy, Seth and Taylor are already loaded but disabled until you turn them on
- PWA metadata so it can be added to the iPhone Home Screen

---

# SETUP: do these in order

## 1. Create the Supabase project

1. Go to Supabase and create a new project.
2. In the Supabase project, open **SQL Editor**.
3. Open the file `supabase/schema.sql` from this project.
4. Copy the entire file into Supabase SQL Editor and click **Run**.

That creates the database and the five family profiles.

## 2. Get the two Supabase values

In Supabase, open your project and use **Connect** for the Project URL, then go to **Settings → API Keys** for the server key.

You need:

- Project URL
- **Secret key** (`sb_secret_...`)

**Important:** never put the secret key in client-side code, GitHub, screenshots, or chat. In this project it is used only by server routes.

## 3. Pick the parent PIN

Choose whatever PIN Seth/Taylor should use, for example `2468`.

## 4. Put this project in GitHub

Create a new GitHub repository called `taylor-screen-time`, then upload/push all files from this folder.

## 5. Connect GitHub to Vercel

1. In Vercel choose **Add New → Project**.
2. Import your `taylor-screen-time` GitHub repo.
3. Before deploying, add these Environment Variables:

```text
SUPABASE_URL=your Supabase Project URL
SUPABASE_SECRET_KEY=your Supabase secret key
PARENT_PIN=your chosen PIN
ADMIN_SECRET=a long random private string
APP_TIMEZONE=America/Chicago
```

For `ADMIN_SECRET`, use a long random value. Example format:

```text
8f72c96bfbbd4f69b183550f2471485f67b8a450
```

Do not reuse that exact example. Make your own random string.

4. Click **Deploy**.

## 6. Open on iPhone

Open the Vercel URL in Safari.

Then tap:

**Share → Add to Home Screen → Add**

It will launch from the Home Screen like its own app.

---

# How the weekly math works

Each week's balance is:

```text
starting balance + parent bonus time - tracked sessions - manual deductions
```

At the next Monday reset:

- if the ending balance is positive, at most 2 hours rolls over
- base allowance + positive rollover cannot start above 12 hours
- if the ending balance is negative, the entire negative amount carries forward

Example:

```text
Judah base allowance        10:00
Ends week with              +2:45
Rollover                     2:00 max
Next week starts            12:00
```

Another example:

```text
Judah base allowance        10:00
Ends week with              -0:45
Next week starts             9:15
```

Parent bonus time can push the live current-week balance over 12 hours. The 12-hour rule applies to the normal Monday starting balance.

---

# Changing settings

Tap **Parent** in the top-right of the app and enter the PIN.

For each person you can:

- enable/disable tracking
- change weekly allowance
- change daily soft limit
- add 15/30/60 minutes
- deduct 15/30/60 minutes
- enter any custom number of minutes
- add a note
- undo manual adjustments

## Current starting setup

| Person | Weekly allowance | Daily soft limit | Tracking |
|---|---:|---:|---|
| Zayn | 10 hr | 3 hr | On |
| Judah | 10 hr | 3 hr | On |
| Maizy | 0 | 3 hr | Off |
| Seth | 0 | 3 hr | Off |
| Taylor | 0 | 3 hr | Off |

---

# Notes

The timer does **not** depend on Safari staying open. The database stores the real start timestamp, so locking the phone or closing the app does not lose elapsed time.

This first version intentionally uses a private family URL plus a parent PIN rather than individual user accounts. If you ever want stronger device/user access controls, add Supabase Auth in a later version.
