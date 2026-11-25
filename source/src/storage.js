/* ============================ storage: data folder (OneDrive) ============================ */
const DATA_FILE = 'talentdesk-data.json', LOCK_FILE = 'talentdesk.lock', RES_DIR = 'resumes', BK_DIR = 'backups';
const SESSION = uid('s_');
const DEVICE = (() => {
  try {
    let d = localStorage.getItem('td_device');
    if (!d) { const ua = navigator.userAgent; const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'; const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''; d = `${br}${os ? ' on ' + os : ''} · ${Math.random().toString(36).slice(2, 6)}`; localStorage.setItem('td_device', d); }
    return d;
  } catch (e) { return 'This browser'; }
})();
const resumeFileName = (id, name) => `${id}__${String(name || 'resume').replace(/[\\/:*?"<>|]/g, '_')}`;

const Store = (() => {
  // status: unsupported | none | needs-permission | ready
  let dir = null, status = 'none', lastMod = 0, lastWrittenAt = null, hb = null, readonly = null, roWarned = false, writing = Promise.resolve(), lastSavedAt = null;
  const LOCK_TTL = 90000;
  const supported = () => typeof window.showDirectoryPicker === 'function' && DB.mode === 'idb';
  const fsMode = () => status === 'ready';
  async function perm(h, ask) { if (!h || !h.queryPermission) return 'granted'; const o = { mode: 'readwrite' }; let p = await h.queryPermission(o); if (p !== 'granted' && ask) p = await h.requestPermission(o); return p; }
  async function fileOf(name, create, sub) { let d = dir; if (sub) d = await dir.getDirectoryHandle(sub, { create: true }); return d.getFileHandle(name, { create }); }
  async function exists(name, sub) { try { await fileOf(name, false, sub); return true; } catch (e) { return false; } }
  async function writeRaw(fh, content) { const w = await fh.createWritable(); await w.write(content); await w.close(); return (await fh.getFile()).lastModified; }
  async function readData() {
    try { const f = await (await fileOf(DATA_FILE, false)).getFile(); if (!f.size) return null; return { data: JSON.parse(await f.text()), lastModified: f.lastModified }; }
    catch (e) { if (e.name === 'NotFoundError') return null; if (e instanceof SyntaxError) throw new Error('The data file in this folder is damaged. Restore one from the backups folder.'); throw e; }
  }
  /* --- lock: stops two windows/computers editing at once --- */
  async function readLock() { try { const f = await (await fileOf(LOCK_FILE, false)).getFile(); return JSON.parse(await f.text()); } catch (e) { return null; } }
  async function writeLock() { await writeRaw(await fileOf(LOCK_FILE, true), JSON.stringify({ session: SESSION, device: DEVICE, at: nowIso() })); }
  const lockBusy = l => l && l.session !== SESSION && Date.now() - Date.parse(l.at) < LOCK_TTL;
  function stopHeartbeat() { if (hb) clearInterval(hb); hb = null; }
  function startHeartbeat() {
    stopHeartbeat();
    hb = setInterval(async () => { if (readonly || !fsMode()) return; try { const l = await readLock(); if (lockBusy(l)) return setReadonly({ kind: 'taken', lock: l }); await writeLock(); } catch (e) { } }, 30000);
  }
  async function releaseLock() { try { const l = await readLock(); if (l && l.session === SESSION) await dir.removeEntry(LOCK_FILE); } catch (e) { } }
  function setReadonly(info) { readonly = info; stopHeartbeat(); if (typeof render === 'function') render(); }
  /* --- backups: one snapshot per day, keep 14 --- */
  async function dailyBackup(file) {
    try {
      const name = `talentdesk-data-${new Date().toISOString().slice(0, 10)}.json`;
      if (await exists(name, BK_DIR)) return;
      await writeRaw(await fileOf(name, true, BK_DIR), file);
      const bk = await dir.getDirectoryHandle(BK_DIR); const names = [];
      for await (const [n] of bk.entries()) if (/^talentdesk-data-\d{4}-\d{2}-\d{2}\.json$/.test(n)) names.push(n);
      names.sort(); for (const n of names.slice(0, Math.max(0, names.length - 14))) await bk.removeEntry(n);
    } catch (e) { console.warn('backup failed', e); }
  }
  async function snapshot(label) { try { const f = await (await fileOf(DATA_FILE, false)).getFile(); if (f.size) await writeRaw(await fileOf(`talentdesk-data-${label}-${Date.now()}.json`, true, BK_DIR), f); } catch (e) { } }
  async function copyBrowserFilesToFolder() {
    for (const c of S.candidates) if (c.resume) {
      const fn = resumeFileName(c.resume.id, c.resume.name); if (await exists(fn, RES_DIR)) continue;
      const f = await DB.getFile(c.resume.id); if (f && f.data) await writeRaw(await fileOf(fn, true, RES_DIR), dataURLtoBlob(f.data));
    }
  }
  /* --- writing --- */
  function flushFile(force) {
    if (!fsMode() || readonly) return writing;
    writing = writing.then(async () => {
      if (!fsMode() || readonly) return;
      if (!force) { const l = await readLock(); if (lockBusy(l)) return setReadonly({ kind: 'taken', lock: l }); }
      const fh = await fileOf(DATA_FILE, true); const f = await fh.getFile();
      if (!force && lastMod && f.lastModified !== lastMod && f.size) {
        let other = null; try { other = JSON.parse(await f.text()); } catch (e) { }
        if (!other || other.updatedAt !== lastWrittenAt) return setReadonly({ kind: 'changed', at: other && other.updatedAt });
      }
      if (f.size) await dailyBackup(f);
      lastMod = await writeRaw(fh, JSON.stringify(S)); lastWrittenAt = S.updatedAt; lastSavedAt = nowIso();
      const el = document.getElementById('storage-note'); if (el) el.textContent = 'Saved to folder ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }).catch(e => { toast('Could not save to your data folder: ' + e.message + '. Your changes are kept in this browser until it works again.', 'err'); });
    return writing;
  }
  async function persistNow() {
    if (readonly) { if (!roWarned) { toast("Read-only right now, so changes aren't being saved. Use the banner at the top to take over.", 'err'); roWarned = true; } return; }
    try { await DB.saveState(S); } catch (e) { toast('Could not save: ' + e.message, 'err'); }
    if (fsMode()) await flushFile();
  }
  /* --- opening --- */
  // mode: 'auto' (startup), 'picked' (user just chose a folder), 'folder' (use folder data), 'local' (overwrite folder with this browser's data)
  async function open(mode = 'auto') {
    const l = await readLock(); const r = await readData();
    if (mode === 'picked' && r && S.candidates.length && r.data.dataId !== S.dataId) return { choose: true, folderCount: (r.data.candidates || []).length, folderAt: r.data.updatedAt };
    if (lockBusy(l) && (mode === 'auto' || mode === 'picked')) {
      if (r) { S = migrate(r.data); lastMod = r.lastModified; lastWrittenAt = r.data.updatedAt; }
      setReadonly({ kind: 'busy', lock: l }); return { busy: true };
    }
    readonly = null; roWarned = false;
    if (mode === 'local') { await snapshot('replaced'); await copyBrowserFilesToFolder(); await writeLock(); startHeartbeat(); await flushFile(true); return { ok: true, source: 'browser' }; }
    if (r) {
      const localNewer = mode === 'auto' && S.dataId === r.data.dataId && (S.updatedAt || '') > (r.data.updatedAt || '');
      lastMod = r.lastModified; lastWrittenAt = r.data.updatedAt;
      if (!localNewer) S = migrate(r.data);
      await writeLock(); startHeartbeat();
      if (localNewer) await flushFile(true);
      await DB.saveState(S); return { ok: true, source: localNewer ? 'browser' : 'folder' };
    }
    await copyBrowserFilesToFolder(); lastMod = 0; await writeLock(); startHeartbeat(); await flushFile(true); await DB.saveState(S);
    return { ok: true, source: 'new' };
  }
  async function init() {
    if (!supported()) { status = 'unsupported'; return status; }
    let h = null; try { h = window.__tdTestFolder ? await window.__tdTestFolder() : await DB.kvGet('folderHandle'); } catch (e) { } // __tdTestFolder: automated tests only
    if (!h) { status = 'none'; return status; }
    dir = h; status = (await perm(h, false)) === 'granted' ? 'ready' : 'needs-permission'; return status;
  }
  async function connect() {
    let h; try { h = await window.showDirectoryPicker({ id: 'talentdesk', mode: 'readwrite', startIn: 'documents' }); } catch (e) { if (e.name === 'AbortError') return { cancel: true }; throw e; }
    if ((await perm(h, true)) !== 'granted') throw new Error('TalentDesk needs permission to edit files in that folder.');
    if (fsMode()) { stopHeartbeat(); await releaseLock(); }
    dir = h; status = 'ready'; lastMod = 0; if (!window.__tdTestFolder) await DB.kvPut('folderHandle', h);
    return open('picked');
  }
  async function reconnect() { if ((await perm(dir, true)) !== 'granted') throw new Error('Permission was not granted.'); status = 'ready'; return open('auto'); }
  async function disconnect() { stopHeartbeat(); await releaseLock(); await DB.kvDel('folderHandle'); dir = null; status = supported() ? 'none' : 'unsupported'; readonly = null; await DB.saveState(S); }
  async function takeOver() { const r = await readData(); if (r) { S = migrate(r.data); lastMod = r.lastModified; lastWrittenAt = r.data.updatedAt; } readonly = null; roWarned = false; await writeLock(); startHeartbeat(); await DB.saveState(S); }
  /* --- attachments (resumes) --- */
  const Files = {
    async put(meta, blob) { if (fsMode()) return writeRaw(await fileOf(resumeFileName(meta.id, meta.name), true, RES_DIR), blob); return DB.putFile(meta.id, { name: meta.name, type: meta.type, data: await readFile(blob, 'readAsDataURL') }); },
    async get(meta) {
      if (!meta) return null;
      if (fsMode()) { try { return await (await fileOf(resumeFileName(meta.id, meta.name), false, RES_DIR)).getFile(); } catch (e) { } }
      const f = await DB.getFile(meta.id); return f && f.data ? dataURLtoBlob(f.data) : null;
    },
    async dataURL(meta) { const b = await this.get(meta); return b ? readFile(b, 'readAsDataURL') : null; },
    async del(meta) { if (!meta) return; if (fsMode()) { try { await (await dir.getDirectoryHandle(RES_DIR)).removeEntry(resumeFileName(meta.id, meta.name)); } catch (e) { } } await DB.delFile(meta.id).catch(() => { }); },
    async all() { const o = {}; for (const c of S.candidates) if (c.resume) { const d = await this.dataURL(c.resume); if (d) o[c.resume.id] = { name: c.resume.name, type: c.resume.type, data: d }; } return o; },
    async clear() { if (fsMode()) { try { await dir.removeEntry(RES_DIR, { recursive: true }); } catch (e) { } } await DB.clearState(); },
  };
  return {
    init, open, connect, reconnect, disconnect, takeOver, persistNow, flushFile, releaseLock, snapshot, Files,
    get status() { return status; }, get readonly() { return readonly; }, get folderName() { return dir ? dir.name : ''; }, get supported() { return supported(); }, get lastSavedAt() { return lastSavedAt; },
  };
})();
function dataURLtoBlob(d) { const [h, b] = d.split(','); const type = (/data:([^;]+)/.exec(h) || [])[1] || 'application/octet-stream'; const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); }
