/* ============================ Google (Calendly bookings via Calendar + Gmail) ============================ */
const Google = (() => {
  const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly';
  let token = null, exp = 0;
  const available = () => /^https?:$/.test(location.protocol);
  const configured = () => !!(S.settings.googleClientId || '').trim();
  function loadGis() {
    return new Promise((res, rej) => {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error("Couldn't load Google sign-in. Check your internet connection.")); document.head.appendChild(s);
    });
  }
  async function getToken() {
    if (token && Date.now() < exp - 60000) return token;
    await loadGis();
    return new Promise((res, rej) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: S.settings.googleClientId.trim(), scope: SCOPES, hint: S.settings.googleAccount || undefined,
        callback: r => { if (r.error) return rej(new Error(r.error_description || r.error)); token = r.access_token; exp = Date.now() + (+r.expires_in || 3600) * 1000; res(token); },
        error_callback: e => rej(new Error(e && e.type === 'popup_closed' ? 'Google sign-in was closed.' : (e && (e.message || e.type)) || 'Google sign-in failed.')),
      });
      client.requestAccessToken({ prompt: '' });
    });
  }
  async function api(url) {
    const t = await getToken(); const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (r.status === 401) { token = null; throw new Error('Google session expired. Click Sync again.'); }
    if (r.status === 403) throw new Error('Google refused access. Check that the Calendar and Gmail APIs are enabled in your Google Cloud project.');
    if (!r.ok) throw new Error('Google returned error ' + r.status);
    return r.json();
  }
  const emailsIn = t => (String(t || '').match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(e => e.toLowerCase());
  const junk = e => /calendly\.com$|google\.com$|resource\.calendar|noreply|no-reply|zoom\.us$|teams\.microsoft/.test(e);
  function b64(d) { try { return b64urlDecode(d); } catch (e) { return ''; } }
  function msgText(payload) {
    let txt = '', html = '';
    (function walk(p) { if (!p) return; if (p.body && p.body.data) { if (p.mimeType === 'text/plain') txt += b64(p.body.data) + '\n'; else if (p.mimeType === 'text/html') html += b64(p.body.data); } (p.parts || []).forEach(walk); })(payload);
    return txt || html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ');
  }
  function parseCalendlyDate(s) {
    const m = /(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s*[-–]\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+\.? \d{1,2},? \d{4})/i.exec(s || '');
    if (!m) return null; let t = m[1].replace(/\./g, '').replace(/\s*([ap]m)/i, ' $1'); if (!/:/.test(t)) t = t.replace(/ /, ':00 ');
    const d = new Date(`${m[2].replace('.', '')} ${t}`); return isNaN(d) ? null : d.toISOString();
  }
  async function collect() {
    const own = (S.settings.googleAccount || '').toLowerCase(); const now = Date.now(); const out = []; const errs = [];
    try {
      let pageToken = '';
      do {
        const q = new URLSearchParams({ timeMin: new Date(now - 45 * DAY).toISOString(), timeMax: new Date(now + 60 * DAY).toISOString(), singleEvents: 'true', showDeleted: 'true', maxResults: '250' }); if (pageToken) q.set('pageToken', pageToken);
        const r = await api('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + q);
        (r.items || []).forEach(ev => {
          const em = new Set([...(ev.attendees || []).filter(a => !a.self && !a.organizer).map(a => (a.email || '').toLowerCase()), ...emailsIn(ev.description)]);
          const emails = [...em].filter(e => e && e !== own && !junk(e)); const start = ev.start && (ev.start.dateTime || ev.start.date);
          if (!emails.length || !start) return;
          out.push({ emails, start: new Date(start).toISOString(), canceled: ev.status === 'cancelled', title: ev.summary || '', source: 'calendar', name: ((ev.attendees || []).find(a => !a.self && !a.organizer) || {}).displayName || '' });
        });
        pageToken = r.nextPageToken;
      } while (pageToken && out.length < 3000);
    } catch (e) { errs.push('Calendar: ' + e.message); }
    try {
      const list = await api('https://gmail.googleapis.com/gmail/v1/users/me/messages?' + new URLSearchParams({ q: 'from:calendly.com newer_than:45d', maxResults: '100' }));
      const ids = (list.messages || []).map(m => m.id);
      for (let i = 0; i < ids.length; i += 10) {
        const batch = await Promise.all(ids.slice(i, i + 10).map(id => api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`).catch(() => null)));
        batch.filter(Boolean).forEach(full => {
          const subj = ((full.payload.headers || []).find(h => h.name.toLowerCase() === 'subject') || {}).value || '';
          const text = msgText(full.payload);
          const inv = /Invitee Email:?\s*\n?\s*([^\s<>]+@[^\s<>]+)/i.exec(text); if (!inv) return;
          const dt = /Event Date\/Time:?\s*\n?\s*([^\n]+)/i.exec(text);
          out.push({ emails: [inv[1].toLowerCase().replace(/[.,;]$/, '')], start: dt ? parseCalendlyDate(dt[1]) : null, canceled: /cancel/i.test(subj), title: subj, source: 'gmail', name: ((/Invitee:?\s*\n?\s*([^\n]+)/i.exec(text) || [])[1] || '').trim() });
        });
      }
    } catch (e) { errs.push('Gmail: ' + e.message); }
    return { bookings: out, errs };
  }
  function apply(bookings) {
    const ignored = new Set((S.settings.ignoredBookingEmails || []).map(e => e.toLowerCase()));
    const byEmail = new Map();
    S.candidates.filter(isActive).forEach(c => [c.email, ...(c.altEmails || [])].filter(Boolean).forEach(e => { const k = e.toLowerCase(); if (!byEmail.has(k)) byEmail.set(k, []); byEmail.get(k).push(c); }));
    const perCand = new Map(), unmatched = new Map();
    bookings.forEach(b => {
      const cs = [...new Set(b.emails.flatMap(e => byEmail.get(e) || []))];
      if (!cs.length) {
        if (b.canceled || !b.start || Date.parse(b.start) < Date.now() - 14 * DAY) return;
        b.emails.filter(e => !ignored.has(e) && !S.candidates.some(c => (c.email || '').toLowerCase() === e)).forEach(e => { const k = e + '|' + b.start; if (!unmatched.has(k)) unmatched.set(k, { ...b, email: e }); });
        return;
      }
      cs.forEach(c => { if (!perCand.has(c.id)) perCand.set(c.id, []); perCand.get(c.id).push(b); });
    });
    let matched = 0, updated = 0, canceled = 0;
    perCand.forEach((bs, id) => {
      const c = getCand(id); const canceledStarts = new Set(bs.filter(b => b.canceled && b.start).map(b => b.start));
      const valid = bs.filter(b => !b.canceled && b.start && !canceledStarts.has(b.start)).sort((a, b) => a.start < b.start ? -1 : 1);
      const pick = valid.find(b => Date.parse(b.start) >= Date.now() - 2 * 3600e3) || valid[valid.length - 1];
      if (pick) {
        matched++;
        if (c.bookedAt !== pick.start) { const had = c.bookedAt; c.bookedAt = pick.start; if (!c.inviteSentAt) c.inviteSentAt = pick.start; if (c.stage === 'new') setStage(c, 'screen', 'booked via Calendly'); log(c, 'booking', `Calendly: ${had ? 'rescheduled to' : stageLabel(c.stage) + ' booked for'} ${fmtDateTime(pick.start)}`); updated++; }
      } else if (c.bookedAt && canceledStarts.has(c.bookedAt)) { log(c, 'booking', `Calendly: booking for ${fmtDateTime(c.bookedAt)} was canceled`); c.bookedAt = null; canceled++; }
    });
    return { matched, updated, canceled, unmatched: [...unmatched.values()].sort((a, b) => a.start < b.start ? -1 : 1) };
  }
  async function sync() {
    if (!available()) throw new Error('Google sync needs TalentDesk opened from its web address (GitHub Pages or a local server), not as a file.');
    if (!configured()) throw new Error('Add your Google OAuth client ID in Settings first.');
    const { bookings, errs } = await collect();
    if (errs.length === 2) throw new Error(errs.join(' · '));
    const res = apply(bookings); res.errs = errs; res.found = bookings.length;
    S.settings.lastGoogleSync = nowIso(); save(); return res;
  }
  return { sync, available, configured, parseCalendlyDate, apply, signOut() { if (token && window.google && google.accounts) try { google.accounts.oauth2.revoke(token); } catch (e) { } token = null; } };
})();
