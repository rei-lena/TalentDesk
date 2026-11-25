# TalentDesk

A lightweight recruiting workbench that sits on top of Workday: daily Workday imports, a pipeline board per req, screen invites, Granola-powered scorecards, HM review packets, HM status pages, and Calendly booking sync.

**Where your data lives:** in a folder you choose (ideally in OneDrive), never in this repository and never on a server. This repo only holds the app's code.

---

## 1. Run it

Pick one. You can switch later. The data folder is the same either way.

### Option A: just open the file (no setup)
Double-click `index.html`. It opens in your browser and everything works **except Google/Calendly sync** and the "install as app" button.

### Option B: host it on GitHub Pages (recommended)
This gives you a web address, an **Install app** button (its own window and taskbar icon), and Calendly sync.

This repo is already set up for that. The live app is at **https://rei-lena.github.io/TalentDesk/**.

- The repo is public because free GitHub accounts need that for Pages. It holds only code and never candidate data.
- Open that address in **Edge**, then go to **⋯ → Apps → Install this site as an app**. In Chrome, use the install icon in the address bar.
- **Updates:** any change pushed to `main` goes live in about a minute. The installed app picks it up the next time you open it while online.

---

## 2. First run: choose your data folder (important)

1. In OneDrive, create a folder called **TalentDesk**.
2. In the app, go to **Settings → Data & backup → Choose data folder…** and pick that folder.

From then on:
- Every change saves to `talentdesk-data.json` in that folder. Resumes go in `resumes/`, and a daily snapshot is kept in `backups/` (last 14 days).
- On another computer or browser (Edge or Chrome), open TalentDesk, choose the same OneDrive folder, and all your data is there.
- Each time you open the app, the browser asks you once to **Reconnect** to the folder. That's a browser security rule.
- **Only one window edits at a time.** If TalentDesk is open somewhere else, the new window opens read-only with a **Take over here** button. OneDrive can take a minute to sync between computers, so close the app on one computer before opening it on another.

To restore an old snapshot, use **Settings → Restore from backup** and pick a file from `backups/`.

---

## 3. Calendly sync (optional, one-time setup, about 15 minutes)

TalentDesk can read the scheduling Gmail account's **calendar and Calendly emails** (read-only) and mark candidates as booked, rescheduled or canceled automatically. This needs Option B (a web address).

Do these steps **signed in to Google as the scheduling Gmail account**:

1. Go to **console.cloud.google.com**, create a project, and name it `TalentDesk`.
2. Go to **APIs & Services → Library**, then enable **Google Calendar API** and **Gmail API**.
3. Go to **OAuth consent screen** (may be labeled *Google Auth Platform*):
   - User type **External**, app name `TalentDesk`, and your support email.
   - Under **Audience / Test users**, add the scheduling Gmail address.
   - Under **Data access / Scopes**, add `.../auth/calendar.readonly` and `.../auth/gmail.readonly`.
   - Leave the app in **Testing**. You don't need to publish it.
4. Go to **Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - Under **Authorized JavaScript origins**, add `https://rei-lena.github.io`.
   - Click **Create** and copy the **Client ID**.
5. In TalentDesk, go to **Settings → Calendly sync**, paste the Client ID and the Gmail address, and click **Sync now**.
   - Google shows a "Google hasn't verified this app" screen. That's expected for your own private app in Testing mode. Click **Continue**.

After that, click **Sync Calendly** on the Pipeline page whenever you want to pull in new bookings. If someone booked with a different email than the one in Workday, TalentDesk asks you to link them once and remembers the address.

What's accessed: read-only calendar events and emails from calendly.com in that account. Nothing is changed or sent, and candidate data is never sent to Google. The sign-in only lasts while the app is open.

---

## 4. Good to know
- **Browsers:** use Edge or Chrome. Firefox and Safari can't save to a folder.
- **Workday is still the official record.** Disposition candidates in Workday too.
- **Later, for a team:** the storage code is separate from the rest of the app, so it can be switched to a SharePoint list. HMs and other recruiters would then share one live pipeline with their work logins. That step needs IT to register the app once in your company's Microsoft 365.

---

## 5. Editing the code
The app is built from the files in `source/src/`. After editing them, run `python3 source/build.py` from the repo root. That rebuilds `index.html` at the root, which is the live site, from those files.
