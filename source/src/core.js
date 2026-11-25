'use strict';
/* ============================ utilities ============================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const nowIso = () => new Date().toISOString();
const DAY = 86400000;
function daysSince(iso) { if (!iso) return null; const d = Date.parse(iso); if (isNaN(d)) return null; return Math.max(0, Math.floor((Date.now() - d) / DAY)); }
function fmtDate(iso, opts) {
  if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return String(iso);
  return d.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}
function fmtDateTime(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return String(iso); return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function relDays(iso) { const n = daysSince(iso); if (n === null) return ''; if (n === 0) return 'today'; if (n === 1) return '1d ago'; return n + 'd ago'; }
function toLocalInput(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { } ta.remove(); return ok;
  }
}
async function copyAndToast(text, what = 'Copied') { const ok = await copyText(text); toast(ok ? what : 'Copy failed — select the text and copy manually', ok ? '' : 'err'); return ok; }
function toast(msg, kind = '', action) {
  const t = $('#toast'); const el = document.createElement('div'); el.className = 'toast-item ' + kind;
  const span = document.createElement('span'); span.textContent = msg; el.appendChild(span);
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { action.fn(); el.remove(); }; el.appendChild(b); }
  t.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, action ? 6000 : 2800);
}
function b64urlEncode(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
const readFile = (f, how) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r[how](f); });
function debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = () => { clearTimeout(t); fn(); }; return d; }
const plural = (n, w, pl) => `${n} ${n === 1 ? w : (pl || w + 's')}`;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* ============================ storage ============================ */
const DB = (() => {
  let db = null, mode = 'memory';
  const NAME = 'talentdesk', VER = 1, LS_KEY = 'talentdesk_state_v1';
  function open() {
    return new Promise(res => {
      try {
        const req = indexedDB.open(NAME, VER);
        req.onupgradeneeded = () => { const d = req.result; ['kv', 'files'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
        req.onsuccess = () => { db = req.result; res(true); };
        req.onerror = () => res(false); req.onblocked = () => res(false);
      } catch (e) { res(false); }
    });
  }
  function tx(store, type, fn) {
    return new Promise((res, rej) => {
      const t = db.transaction(store, type); const s = t.objectStore(store); let out; const r = fn(s);
      if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage aborted (disk full?)'));
    });
  }
  async function init() {
    if (await open()) mode = 'idb';
    else { try { localStorage.setItem('__td', '1'); localStorage.removeItem('__td'); mode = 'ls'; } catch (e) { mode = 'memory'; } }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
    return mode;
  }
  async function loadState() {
    if (mode === 'idb') return (await tx('kv', 'readonly', s => s.get('state'))) || null;
    if (mode === 'ls') { try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
    return null;
  }
  async function saveState(state) {
    if (mode === 'idb') return tx('kv', 'readwrite', s => s.put(JSON.parse(JSON.stringify(state)), 'state'));
    if (mode === 'ls') localStorage.setItem(LS_KEY, JSON.stringify(state));
  }
  async function putFile(id, rec) { if (mode !== 'idb') throw new Error('Attachments need IndexedDB, which this browser blocked for local files.'); return tx('files', 'readwrite', s => s.put(rec, id)); }
  async function getFile(id) { if (mode !== 'idb' || !id) return null; return tx('files', 'readonly', s => s.get(id)); }
  async function delFile(id) { if (mode !== 'idb' || !id) return; return tx('files', 'readwrite', s => s.delete(id)); }
  async function allFiles() {
    if (mode !== 'idb') return {};
    const keys = await tx('files', 'readonly', s => s.getAllKeys()); const vals = await tx('files', 'readonly', s => s.getAll());
    const o = {}; keys.forEach((k, i) => o[k] = vals[i]); return o;
  }
  async function clearAll() {
    if (mode === 'idb') { await tx('kv', 'readwrite', s => s.clear()); await tx('files', 'readwrite', s => s.clear()); }
    else if (mode === 'ls') localStorage.removeItem(LS_KEY);
  }
  async function kvGet(k) { if (mode !== 'idb') return null; return tx('kv', 'readonly', s => s.get(k)); }
  async function kvPut(k, v) { if (mode !== 'idb') throw new Error('Needs IndexedDB'); return tx('kv', 'readwrite', s => s.put(v, k)); }
  async function kvDel(k) { if (mode !== 'idb') return; return tx('kv', 'readwrite', s => s.delete(k)); }
  async function clearState() { if (mode === 'idb') { await tx('kv', 'readwrite', s => s.delete('state')); await tx('files', 'readwrite', s => s.clear()); } else if (mode === 'ls') localStorage.removeItem(LS_KEY); }
  return { init, loadState, saveState, putFile, getFile, delFile, allFiles, clearAll, clearState, kvGet, kvPut, kvDel, get mode() { return mode; } };
})();

/* ============================ file parsing ============================ */
const Parse = (() => {
  function csv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const sample = text.split(/\r?\n/).slice(0, 8).join('\n');
    const counts = { ',': (sample.match(/,/g) || []).length, '\t': (sample.match(/\t/g) || []).length, ';': (sample.match(/;/g) || []).length };
    const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; continue; }
      if (ch === '"') { q = true; continue; }
      if (ch === delim) { row.push(field); field = ''; continue; }
      if (ch === '\r') continue;
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
      field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }
  async function inflateRaw(u8) {
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzip(buf, wanted) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error("This doesn't look like an .xlsx file. If it's an old .xls, open it in Excel and save as .xlsx or CSV.");
    const n = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true);
    const out = {}; const dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      const name = dec.decode(u8.subarray(off + 46, off + 46 + nlen)); off += 46 + nlen + elen + clen;
      if (!wanted(name)) continue;
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const data = u8.subarray(start, start + csize);
      const raw = method === 0 ? data : method === 8 ? await inflateRaw(data) : null;
      if (!raw) throw new Error('Unsupported compression inside this .xlsx — save it as CSV instead.');
      out[name] = dec.decode(raw);
    }
    return out;
  }
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const byTag = (el, tag) => Array.from(el.getElementsByTagNameNS('*', tag));
  function colIdx(ref) { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
  function serialToISO(v) {
    const d = new Date(Math.round((v - 25569) * DAY)); if (isNaN(d)) return String(v);
    return Math.abs(v - Math.floor(v)) > 1e-6 ? d.toISOString().slice(0, 16).replace('T', ' ') : d.toISOString().slice(0, 10);
  }
  async function xlsx(buf) {
    if (typeof DecompressionStream === 'undefined') throw new Error("This browser can't open .xlsx directly. In Excel use File → Save As → CSV, then import the CSV.");
    const f = await unzip(buf, n => ['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml', 'xl/styles.xml'].includes(n) || /^xl\/worksheets\/[^/]+\.xml$/.test(n));
    let sheetPath = null;
    if (f['xl/workbook.xml'] && f['xl/_rels/workbook.xml.rels']) {
      const sh = byTag(xml(f['xl/workbook.xml']), 'sheet')[0];
      const rid = sh && (sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sh.getAttribute('r:id'));
      const rel = byTag(xml(f['xl/_rels/workbook.xml.rels']), 'Relationship').find(r => r.getAttribute('Id') === rid);
      if (rel) { const t = rel.getAttribute('Target'); sheetPath = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); }
    }
    if (!sheetPath || !f[sheetPath]) sheetPath = Object.keys(f).filter(n => n.startsWith('xl/worksheets/')).sort()[0];
    if (!sheetPath) throw new Error('No worksheet found in this file.');
    const ss = f['xl/sharedStrings.xml'] ? byTag(xml(f['xl/sharedStrings.xml']), 'si').map(si => byTag(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join('')) : [];
    const dateXf = new Set();
    if (f['xl/styles.xml']) {
      const st = xml(f['xl/styles.xml']); const custom = {};
      byTag(st, 'numFmt').forEach(nf => custom[nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode') || '');
      const cx = byTag(st, 'cellXfs')[0];
      if (cx) Array.from(cx.children).forEach((xf, i) => {
        const id = +xf.getAttribute('numFmtId'); const code = (custom[id] || '').replace(/\[[^\]]*\]|"[^"]*"|\\./g, '');
        if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (code && /[dmy]/i.test(code) && !/general/i.test(code))) dateXf.add(i);
      });
    }
    const rows = [];
    byTag(xml(f[sheetPath]), 'row').forEach(r => {
      const ri = (+r.getAttribute('r') || rows.length + 1) - 1; const arr = [];
      byTag(r, 'c').forEach((c, ci) => {
        let idx = colIdx(c.getAttribute('r')); if (idx < 0) idx = ci;
        const t = c.getAttribute('t'); const vEl = byTag(c, 'v')[0]; let val = '';
        if (t === 's') val = ss[+(vEl ? vEl.textContent : -1)] ?? '';
        else if (t === 'inlineStr') val = byTag(c, 't').map(x => x.textContent).join('');
        else if (t === 'b') val = vEl && vEl.textContent === '1' ? 'TRUE' : 'FALSE';
        else { val = vEl ? vEl.textContent : ''; if (val !== '' && t !== 'str' && t !== 'e' && dateXf.has(+c.getAttribute('s')) && !isNaN(+val)) val = serialToISO(+val); }
        arr[idx] = val;
      });
      rows[ri] = Array.from(arr, v => v ?? '');
    });
    return Array.from(rows, r => r || []).filter(r => r.some(c => String(c).trim() !== ''));
  }
  const FIELDS = [
    { k: 'workdayId', label: 'Workday candidate / application ID', re: [/job application id|application id|candidate id|applicant id/] },
    { k: 'name', label: 'Candidate name', re: [/^(candidate|candidate name|name|full name|applicant|applicant name|legal name|candidate full name)$/, /candidate.*name|applicant.*name|^name\b/] },
    { k: 'firstName', label: 'First name', re: [/first name|given name/] },
    { k: 'lastName', label: 'Last name', re: [/last name|family name|surname/] },
    { k: 'email', label: 'Email', re: [/e-?mail/] },
    { k: 'phone', label: 'Phone', re: [/phone|mobile|cell/] },
    { k: 'reqId', label: 'Job requisition / Req ID', re: [/^job requisition( id)?$/, /requisition(?! title)|^req\b|req ?(id|#|number)/] },
    { k: 'jobTitle', label: 'Job / posting title', re: [/job posting title|posting title|requisition title|position title|job profile/, /^job( title)?$|^position$|^posting$/] },
    { k: 'currentTitle', label: "Candidate's current title", re: [/current (job )?title|most recent (job )?title|recent job title|current position|headline/] },
    { k: 'currentCompany', label: 'Current company', re: [/current (company|employer)|most recent (company|employer)|recent employer|^company$|^employer$/] },
    { k: 'location', label: 'Location', re: [/candidate location|^location$|^city$|location/] },
    { k: 'source', label: 'Source', re: [/source/] },
    { k: 'appliedAt', label: 'Applied date', re: [/date applied|applied (on|date)|application date|^applied$|submitted/] },
    { k: 'workdayStep', label: 'Workday step / status', re: [/step ?\/ ?disposition|^step$|current step|disposition|^stage$|status/] },
    { k: 'workdayUrl', label: 'Workday link', re: [/url|link/] },
    { k: 'hiringManager', label: 'Hiring manager', re: [/hiring manager/] },
  ];
  function guessMapping(headers) {
    const used = new Set(), m = {}; const H = headers.map(h => String(h || '').trim().toLowerCase());
    for (const f of FIELDS) for (const re of f.re) {
      const i = H.findIndex((h, ix) => h && !used.has(ix) && (f.k === 'hiringManager' || !/manager|recruiter/.test(h)) && re.test(h));
      if (i >= 0) { m[f.k] = String(headers[i]).trim(); used.add(i); break; }
    }
    return m;
  }
  function detectHeader(rows) {
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const filled = rows[i].filter(c => String(c).trim() !== '');
      const score = Object.keys(guessMapping(rows[i])).length * 10 + filled.length - (filled.some(c => /@|^\d+([.,]\d+)?$/.test(String(c).trim())) ? 25 : 0);
      if (filled.length >= 2 && score > bestScore) { best = i; bestScore = score; }
    }
    return best;
  }
  function splitReq(v) {
    const s = String(v || '').trim(); if (!s) return { id: '', title: '' };
    const m = /^([A-Za-z]{0,6}[-_ ]?\d{2,}[-\w]*)\s*[-–:|]?\s*(.*)$/.exec(s);
    if (m) return { id: m[1].trim(), title: m[2].replace(/\s*\((open|closed|frozen|filled|on hold)\)\s*$/i, '').trim() };
    return { id: s, title: '' };
  }
  function splitName(n) {
    n = String(n || '').trim().replace(/\s+/g, ' '); if (!n) return { first: '', last: '', full: '' };
    if (n.includes(',')) { const [l, f] = n.split(',').map(x => x.trim()); return { first: (f || '').split(' ')[0], last: l, full: `${f} ${l}`.trim() }; }
    const p = n.split(' '); return { first: p[0], last: p.slice(1).join(' '), full: n };
  }
  async function file(f) {
    const name = f.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return xlsx(await readFile(f, 'readAsArrayBuffer'));
    if (name.endsWith('.xls')) throw new Error("Old .xls files can't be read in the browser. Open it in Excel → Save As → .xlsx or CSV.");
    return csv(await readFile(f, 'readAsText'));
  }
  return { csv, xlsx, file, FIELDS, guessMapping, detectHeader, splitReq, splitName };
})();

/* ============================ model ============================ */
const DEFAULT_STAGES = [
  { id: 'new', label: 'New / Applied' }, { id: 'screen', label: 'Recruiter Screen' }, { id: 'hm_review', label: 'HM Resume Review' },
  { id: 'hm_interview', label: 'HM Interview' }, { id: 'panel', label: 'Panel / Onsite' }, { id: 'offer', label: 'Offer' },
  { id: 'hired', label: 'Hired' }, { id: 'rejected', label: 'Rejected / Withdrawn' },
];
const DEFAULT_SCORECARD = ['Summary', 'Experience match', 'Why they are looking', 'Comp expectations', 'Location / work authorization', 'Notice period / availability', 'Concerns'];
const RECS = [{ id: 'strong_yes', label: 'Strong yes', cls: 'good' }, { id: 'yes', label: 'Yes', cls: 'good' }, { id: 'lean_no', label: 'Lean no', cls: 'warn' }, { id: 'no', label: 'No', cls: 'bad' }];
const DECISIONS = { advance: { label: 'Advance', cls: 'good' }, hold: { label: 'Hold', cls: 'warn' }, decline: { label: 'Decline', cls: 'bad' } };
const DEFAULT_TEMPLATES = [
  { id: 't_invite', name: 'Recruiter screen invite', kind: 'invite', subject: '{{job_title}} at {{company}} – Intro call ({{req_id}})', body: "Hi {{first_name}},\n\nThank you for applying for the {{job_title}} role at {{company}}. I'd love to set up a 30-minute intro call to learn more about your background and share more about the team.\n\nPlease grab a time that works for you here: {{booking_link}}\n\nWhen you book, please include the role ID {{req_id}} so I can match it to your application.\n\nLooking forward to speaking with you,\n{{signature}}" },
  { id: 't_remind', name: 'Invite reminder', kind: 'reminder', subject: 'Re: {{job_title}} at {{company}} – Intro call ({{req_id}})', body: "Hi {{first_name}},\n\nJust following up on my note about the {{job_title}} role. If you're still interested, you can book a time here: {{booking_link}}\n\nBest,\n{{signature}}" },
  { id: 't_next', name: 'Next round – HM interview', kind: 'next', subject: '{{job_title}} at {{company}} – Next steps ({{req_id}})', body: "Hi {{first_name}},\n\nGreat news: {{hm_name}} would like to meet with you for the next round for the {{job_title}} role. Could you share a few times that work for you over the next week?\n\nBest,\n{{signature}}" },
];
const TEMPLATE_VARS = ['first_name', 'candidate_name', 'job_title', 'req_id', 'company', 'booking_link', 'hm_name', 'recruiter_name', 'signature'];

function defaultState() {
  return {
    version: 1, createdAt: nowIso(), dataId: uid('d_'),
    settings: { recruiterName: '', recruiterEmail: '', company: '', bookingLink: '', signature: '', staleDays: 5, stages: DEFAULT_STAGES.map(s => ({ ...s })), scorecardFields: [...DEFAULT_SCORECARD], includeResumes: true },
    hms: [], reqs: [], candidates: [], imports: [], mapping: null, packets: [], templates: DEFAULT_TEMPLATES.map(t => ({ ...t })), lastBackupAt: null,
  };
}
function migrate(s) {
  if (!s || typeof s !== 'object') return null;
  const d = defaultState();
  const out = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
  const ids = out.settings.stages.map(x => x.id);
  DEFAULT_STAGES.forEach(st => { if (!ids.includes(st.id)) out.settings.stages.push({ ...st }); });
  ['hms', 'reqs', 'candidates', 'imports', 'packets', 'templates'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!out.dataId) out.dataId = uid('d_');
  out.candidates.forEach(c => { c.activity = c.activity || []; c.notes = c.notes || []; c.scorecards = c.scorecards || []; c.tags = c.tags || []; c.reached = c.reached || {}; });
  return out;
}

let S = defaultState();
const persist = debounce(() => Store.persistNow(), 400);
function save() { S.updatedAt = nowIso(); persist(); }

const stageList = () => S.settings.stages;
const stageLabel = id => (stageList().find(s => s.id === id) || {}).label || id;
const stageIdx = id => stageList().findIndex(s => s.id === id);
const isActive = c => c.stage !== 'hired' && c.stage !== 'rejected';
const getReq = id => S.reqs.find(r => r.id === id);
const getHM = id => S.hms.find(h => h.id === id);
const getCand = id => S.candidates.find(c => c.id === id);
const hmForCand = c => { const r = getReq(c.reqId); return r ? getHM(r.hmId) : null; };
function candName(c) { return c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unnamed candidate'; }
function firstName(c) { return c.firstName || candName(c).split(' ')[0] || ''; }
function initials(c) { const p = candName(c).split(/\s+/).filter(Boolean); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function reqLabel(id) { const r = getReq(id); return r ? `${r.id}${r.title ? ' · ' + r.title : ''}` : (id || 'No req'); }
function log(c, type, text) { c.activity = c.activity || []; c.activity.unshift({ at: nowIso(), type, text }); c.updatedAt = nowIso(); }
function setStage(c, stage, why) {
  if (!stage || c.stage === stage) return false;
  const from = c.stage; c.stage = stage; c.stageEnteredAt = nowIso();
  c.reached = c.reached || {}; if (!c.reached[stage]) c.reached[stage] = c.stageEnteredAt;
  log(c, 'stage', `${stageLabel(from)} → ${stageLabel(stage)}${why ? ' (' + why + ')' : ''}`); return true;
}
function latestScorecard(c) { return (c.scorecards || [])[0] || null; }
function screenStatus(c) {
  if (c.stage !== 'screen') return null;
  if ((c.scorecards || []).length) return { k: 'done', t: 'Screened', cls: 'good' };
  if (c.bookedAt) return { k: 'booked', t: 'Booked ' + fmtDate(c.bookedAt, { month: 'short', day: 'numeric' }), cls: 'blue' };
  if (c.inviteSentAt) { const d = daysSince(c.inviteSentAt); return { k: 'invited', t: d >= 3 ? `No booking · ${d}d` : 'Invited ' + relDays(c.inviteSentAt), cls: d >= 3 ? 'warn' : 'outline' }; }
  return { k: 'todo', t: 'To invite', cls: 'violet' };
}
function hmPending(c) { return c.stage === 'hm_review' && !(c.hmDecision && c.hmDecision.at >= (c.stageEnteredAt || '')); }
function daysInStage(c) { return daysSince(c.stageEnteredAt || c.createdAt) ?? 0; }
function isStale(c) { return isActive(c) && c.stage !== 'offer' && daysInStage(c) > (+S.settings.staleDays || 5); }
function needsAction(c) {
  if (!isActive(c)) return false;
  const ss = screenStatus(c); if (ss && (ss.k === 'todo' || ss.k === 'done' || (ss.k === 'invited' && daysSince(c.inviteSentAt) >= 3))) return true;
  if (c.stage === 'new') return true;
  if (c.stage === 'hm_review' && c.hmDecision && c.hmDecision.at >= (c.stageEnteredAt || '')) return true;
  return isStale(c) || c.workdayStepChanged;
}
function renderTemplate(str, c) {
  const r = getReq(c && c.reqId) || {}; const hm = getHM(r.hmId) || {};
  const v = {
    first_name: c ? firstName(c) : 'there', candidate_name: c ? candName(c) : '', job_title: r.title || (c && c.jobTitle) || 'open', req_id: r.id || (c && c.reqId) || '',
    company: S.settings.company || 'our company', booking_link: r.bookingLink || S.settings.bookingLink || '[add your booking link in Settings]',
    recruiter_name: S.settings.recruiterName || '', signature: S.settings.signature || S.settings.recruiterName || '', hm_name: hm.name || 'the hiring manager',
  };
  return String(str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in v ? v[k] : m));
}
function guessStage(step) {
  const s = String(step || '').toLowerCase(); if (!s) return 'new';
  if (/declin|reject|withdr|not selected|cancel|disqualif/.test(s)) return 'rejected';
  if (/ready for hire|hired|^hire\b|background check/.test(s)) return 'hired';
  if (/offer/.test(s)) return 'offer';
  if (/panel|onsite|on-site|final/.test(s)) return 'panel';
  if (/manager|hm review/.test(s) && !/interview/.test(s)) return 'hm_review';
  if (/interview/.test(s) && !/screen/.test(s)) return 'hm_interview';
  if (/screen|phone/.test(s)) return 'screen';
  return 'new';
}
function scorecardText(c, sc, style) {
  const r = getReq(c.reqId); const rec = RECS.find(x => x.id === sc.recommendation);
  const fields = S.settings.scorecardFields.filter(f => (sc.fields || {})[f]);
  Object.keys(sc.fields || {}).forEach(f => { if (!fields.includes(f) && sc.fields[f]) fields.push(f); });
  if (style === 'teams') {
    const lines = [`${candName(c)} — ${r ? r.title || r.id : c.jobTitle || ''}${r ? ' (' + r.id + ')' : ''}`];
    const cur = [c.currentTitle, c.currentCompany].filter(Boolean).join(' @ '); if (cur || c.location) lines.push(`Currently: ${[cur, c.location].filter(Boolean).join(' · ')}`);
    lines.push(`Recruiter rec: ${rec ? rec.label : '—'}${sc.rating ? ` (${sc.rating}/4)` : ''}`);
    fields.forEach(f => lines.push(`${f}: ${sc.fields[f].replace(/\s*\n\s*/g, ' / ')}`));
    return lines.join('\n');
  }
  const lines = [`RECRUITER SCREEN — ${candName(c)}`, `Req: ${r ? reqLabel(r.id) : c.reqId || ''} | Date: ${fmtDate(sc.at, { month: 'short', day: 'numeric', year: 'numeric' })}${S.settings.recruiterName ? ' | Recruiter: ' + S.settings.recruiterName : ''}`, `Recommendation: ${rec ? rec.label : '—'}${sc.rating ? ` | Rating: ${sc.rating}/4` : ''}`, ''];
  fields.forEach(f => { lines.push(f.toUpperCase()); lines.push(sc.fields[f]); lines.push(''); });
  return lines.join('\n').trim();
}
function splitNotes(raw, fields) {
  const out = {}; let cur = null, pre = [];
  const fn = fields.map(f => ({ f, n: norm(f) }));
  const match = n => n && fn.find(x => n === x.n || (x.n.startsWith(n) && n.length >= 4) || (n.startsWith(x.n) && n.length <= x.n.length + 4));
  let rec = null, rating = null;
  for (const line of String(raw || '').split(/\r?\n/)) {
    const rm = /recommend(?:ation)?\s*[:\-]\s*(strong yes|lean no|yes|no|advance|decline)/i.exec(line); if (rm) { const v = rm[1].toLowerCase(); rec = v === 'advance' ? 'yes' : v === 'decline' ? 'no' : v.replace(' ', '_'); }
    const ra = /rating\s*[:\-]\s*([1-4])/i.exec(line); if (ra) rating = +ra[1];
    const t = line.trim(); const stripped = t.replace(/^#{1,6}\s*|^\*\*|^__/, '').replace(/\*\*$|__$/, '').replace(/:\s*$/, '').trim();
    const words = stripped.split(/\s+/).length;
    const isHeadingish = /^#{1,6}\s|^\*\*.*\*\*:?$|:$/.test(t) || (words <= 6 && t === t.replace(/[.,;]$/, '') && !/^[-*•]/.test(t));
    const hit = isHeadingish && words <= 6 ? match(norm(stripped)) : null;
    if (hit) { cur = hit.f; out[cur] = out[cur] || ''; continue; }
    const inl = /^\s*(?:[-*•]\s*)?(?:\*\*)?([^:]{2,50}?)(?:\*\*)?\s*:\s*(.+)$/.exec(line);
    if (inl) { const h2 = match(norm(inl[1])); if (h2) { cur = h2.f; out[cur] = (out[cur] ? out[cur] + '\n' : '') + inl[2].trim(); continue; } }
    if (/^\s*#{1,6}\s*recommend/i.test(line) || /^\s*recommend/i.test(line)) { cur = '__rec'; continue; }
    if (cur === '__rec') { const rv = /^\s*(?:[-*•]\s*)?(?:\*\*)?(strong yes|lean no|yes|no|advance|decline)\b/i.exec(line); if (rv && !rec) { const v = rv[1].toLowerCase(); rec = v === 'advance' ? 'yes' : v === 'decline' ? 'no' : v.replace(' ', '_'); } continue; }
    if (cur) out[cur] += (out[cur] ? '\n' : '') + line; else pre.push(line);
  }
  Object.keys(out).forEach(k => out[k] = out[k].replace(/\n{3,}/g, '\n\n').trim());
  const preTxt = pre.join('\n').trim(); if (preTxt) { const f0 = fields[0]; out[f0] = out[f0] ? preTxt + '\n' + out[f0] : preTxt; }
  return { fields: out, recommendation: rec, rating };
}
function granolaTemplate() {
  return ['Recruiter screen notes. Use these exact headings, in this order, as markdown "##" headings.', 'Under each heading write 1–3 short bullets using only what was said in the call. Write "Not discussed" if a topic did not come up.', '',
    ...S.settings.scorecardFields.map(f => `## ${f}`), '## Recommendation', 'One of: Strong yes / Yes / Lean no / No, followed by a one-line reason.'].join('\n');
}
