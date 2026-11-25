/* ============================ actions ============================ */
const cur = () => getCand(UI.drawer);
function openCand(id) { UI.drawer = id; UI.tab = 'overview'; renderDrawer(); }
function afterCandChange() { save(); UI._keepScroll = true; render(); }
function selectedIds() { return [...UI.sel].filter(id => getCand(id)); }

function openPacketModal(hmId, ids) {
  const hm = getHM(hmId); if (!hm) return;
  UI.modal = { type: 'packet', hmId, ids };
  const cands = ids.map(getCand).filter(Boolean);
  const noSc = cands.filter(c => !latestScorecard(c)).length, noRes = cands.filter(c => !c.resume).length;
  openModal(`Review packet for ${hm.name}`, `<div class="stack"><p class="sec" style="margin:0">Creates one file for ${esc(hm.name)} to open in any browser. No login and no install, and nothing is uploaded anywhere.</p>
    <div>${cands.map(c => `<label class="cand-line chk"><input type="checkbox" class="pk-c" value="${c.id}" checked><span style="font-weight:600">${esc(candName(c))}</span><span class="muted small">${esc(c.reqId)}</span><span class="spacer"></span>${latestScorecard(c) ? '' : '<span class="chip warn">No scorecard</span>'}${c.resume ? '<span class="chip outline">Resume</span>' : ''}</label>`).join('')}</div>
    ${noSc ? `<div class="callout warn small">${plural(noSc, 'candidate')} without a scorecard will only show basic details.</div>` : ''}
    <label class="chk"><input type="checkbox" id="pk-res" ${S.settings.includeResumes ? 'checked' : ''}> Include attached resumes${noRes ? ` <span class="muted small">(${noRes} have none attached)</span>` : ''}</label>
    <label class="field">Note to ${esc(hm.name.split(' ')[0])} (optional)<textarea class="input" id="pk-note" rows="2" placeholder="e.g. Two strong ones at the top. Would love decisions by Thursday."></textarea></label></div>`,
    `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="packetGo">${icon('download')} Download packet</button>`);
}

const ACT = {
  nav: el => { UI.view = el.dataset.view; UI.sel.clear(); if (UI.view === 'import' && UI.imp && UI.imp.step === 4) UI.imp = null; render(); $('#view').scrollTop = 0; },
  addCand: () => openAddCand(),
  exportCsv: () => exportCsv(),
  loadDemo: () => loadDemo(),
  open: el => openCand(el.dataset.id),
  pick: (el, e) => { e.stopPropagation(); const id = el.dataset.id; UI.sel.has(id) ? UI.sel.delete(id) : UI.sel.add(id); renderResults(); },
  pickcol: (el, e) => { e.stopPropagation(); const ids = filteredCands().filter(c => c.stage === el.dataset.stage).map(c => c.id); const all = ids.every(id => UI.sel.has(id)); ids.forEach(id => all ? UI.sel.delete(id) : UI.sel.add(id)); renderResults(); },
  pickall: () => { const ids = filteredCands().map(c => c.id); const all = ids.every(id => UI.sel.has(id)); ids.forEach(id => all ? UI.sel.delete(id) : UI.sel.add(id)); renderResults(); },
  sort: el => { const k = el.dataset.k; UI.sort = { k, dir: UI.sort.k === k ? -UI.sort.dir : 1 }; renderResults(); },
  clearSel: () => { UI.sel.clear(); renderResults(); },
  bulkEmail: () => openEmail(selectedIds()),
  bulkCopyEmails: () => { const ids = UI.modal && UI.modal.type === 'email' ? UI.modal.ids : selectedIds(); const em = ids.map(getCand).filter(c => c && c.email).map(c => c.email); copyAndToast(em.join('; '), `Copied ${plural(em.length, 'address', 'addresses')}`); },
  bulkReject: () => openReject(selectedIds()),
  bulkPacket: () => { const cands = selectedIds().map(getCand); const hmIds = [...new Set(cands.map(c => (getReq(c.reqId) || {}).hmId || ''))];
    if (hmIds.includes('')) return toast('Some selected candidates are on a req with no hiring manager. Assign one in Reqs & HMs.', 'err');
    if (hmIds.length > 1) return toast('Selected candidates belong to different hiring managers. Select one HM at a time.', 'err');
    openPacketModal(hmIds[0], cands.map(c => c.id)); },
  hmPacket: el => { const ids = S.candidates.filter(c => hmPending(c) && (getReq(c.reqId) || {}).hmId === el.dataset.hid).map(c => c.id); openPacketModal(el.dataset.hid, ids); },
  hmStatus: el => downloadStatus(el.dataset.hid),
  hmTeams: el => { const hm = getHM(el.dataset.hid); const cands = S.candidates.filter(c => hmPending(c) && (getReq(c.reqId) || {}).hmId === hm.id); if (!cands.length) return toast('No pending candidates for this HM'); copyAndToast(hmTeamsText(hm, cands), 'Copied. Paste it into Teams'); },
  packetGo: async () => {
    const m = UI.modal; const hm = getHM(m.hmId); const ids = $$('.pk-c').filter(x => x.checked).map(x => x.value); if (!ids.length) return toast('Pick at least one candidate', 'err');
    const cands = ids.map(getCand).filter(Boolean);
    cands.forEach(c => { if (stageIdx(c.stage) < stageIdx('hm_review')) setStage(c, 'hm_review', 'sent for HM review'); });
    const { payload, html } = await buildPacket(hm, cands, { resumes: $('#pk-res').checked, note: $('#pk-note').value.trim() });
    const fname = `Candidate review - ${hm.name} - ${new Date().toISOString().slice(0, 10)}.html`.replace(/[\\/:*?"<>|]/g, '');
    download(fname, html, 'text/html');
    S.packets.unshift({ id: payload.id, at: payload.at, hmId: hm.id, ids: cands.map(c => c.id) }); S.packets = S.packets.slice(0, 100);
    cands.forEach(c => { c.sentToHmAt = nowIso(); log(c, 'hm', `Sent to ${hm.name} for review`); });
    save(); closeModal(); UI.sel.clear(); render();
    const note = `Hi ${hm.name.split(' ')[0]}, attached ${cands.length === 1 ? 'is 1 candidate' : `are ${cands.length} candidates`} for your review. Open the file, mark Advance / Hold / Decline for each, then click "Copy my reply" and paste it back to me here. Thanks!`;
    toast(`Packet downloaded. Send “${fname}” to ${hm.name} in Teams.`, '', { label: 'Copy Teams note', fn: () => copyAndToast(note, 'Copied Teams note') });
  },
  closeDrawer: () => { UI.drawer = null; renderDrawer(); },
  tab: el => { UI.tab = el.dataset.tab; renderDrawer(); },
  email: () => openEmail([UI.drawer]),
  emailOne: el => openEmail([el.dataset.id], el.dataset.tpl),
  markInvited: () => { const c = cur(); recordEmail(c, { name: 'Screen invite (sent outside TalentDesk)', kind: 'invite' }); afterCandChange(); toast('Marked as invited'); },
  logBooking: () => openBooking(cur()),
  saveBooking: () => { const c = getCand(UI.modal.cid); const v = $('#bk-at').value; if (!v) return; c.bookedAt = new Date(v).toISOString(); if (c.stage === 'new') setStage(c, 'screen', 'screen booked'); if (!c.inviteSentAt) c.inviteSentAt = nowIso(); log(c, 'booking', `Screen booked for ${fmtDateTime(c.bookedAt)}`); closeModal(); afterCandChange(); },
  scorecard: el => openScorecard(cur(), el.dataset.sc),
  copySc: el => { const c = cur(); const sc = c.scorecards.find(s => s.id === el.dataset.sc); if (sc) copyAndToast(scorecardText(c, sc, el.dataset.style), el.dataset.style === 'teams' ? 'Copied for Teams' : 'Copied. Paste it into the Workday candidate note'); },
  delSc: async el => { if (!(await confirmBox('Delete this scorecard?', 'Delete', true))) return; const c = cur(); c.scorecards = c.scorecards.filter(s => s.id !== el.dataset.sc); log(c, 'scorecard', 'Scorecard deleted'); afterCandChange(); },
  copyGranola: () => copyAndToast(granolaTemplate(), 'Granola template copied'),
  scAuto: () => {
    const raw = $('#sc-raw').value; if (!raw.trim()) return toast('Paste your notes first', 'err');
    const res = splitNotes(raw, UI.modal.fields); let n = 0;
    $$('[data-scf]').forEach(t => { const v = res.fields[t.dataset.scf]; if (v) { t.value = v; n++; } });
    if (res.recommendation) $('#sc-rec').value = res.recommendation; if (res.rating) $('#sc-rating').value = res.rating;
    toast(n ? `Filled ${plural(n, 'section')}. Review before saving.` : 'No matching headings found, so everything went into the first section.');
    if (!n) { const f = $('[data-scf]'); if (f) f.value = raw.trim(); }
  },
  saveSc: () => {
    const m = UI.modal; const c = getCand(m.cid); const fields = {}; $$('[data-scf]').forEach(t => { if (t.value.trim()) fields[t.dataset.scf] = t.value.trim(); });
    const rec = $('#sc-rec').value, rating = +$('#sc-rating').value || null, raw = $('#sc-raw').value;
    if (!Object.keys(fields).length && !rec) return toast('The scorecard is empty', 'err');
    let sc;
    if (m.scId) { sc = c.scorecards.find(s => s.id === m.scId); Object.assign(sc, { fields, recommendation: rec, rating, raw }); log(c, 'scorecard', 'Scorecard edited'); }
    else { sc = { id: uid('sc_'), at: nowIso(), fields, recommendation: rec, rating, raw }; c.scorecards.unshift(sc); log(c, 'scorecard', `Recruiter screen scorecard: ${(RECS.find(r => r.id === rec) || {}).label || 'no recommendation'}`); if (c.stage === 'new') setStage(c, 'screen', 'screened'); }
    const mv = $('#sc-move'); if (mv && mv.checked && ['yes', 'strong_yes'].includes(rec)) setStage(c, 'hm_review', 'screen passed');
    closeModal(); UI.tab = 'overview'; afterCandChange();
    toast('Scorecard saved', '', { label: 'Copy for Workday', fn: () => copyAndToast(scorecardText(c, sc, 'workday'), 'Copied. Paste it into the Workday candidate note') });
  },
  reject: () => openReject([UI.drawer]),
  rejectOne: el => openReject([el.dataset.id]),
  saveReject: () => { const reason = $('#rj-reason').value + ($('#rj-note').value.trim() ? ': ' + $('#rj-note').value.trim() : ''); const ids = UI.modal.ids; closeModal();
    const before = ids.map(id => JSON.parse(JSON.stringify(getCand(id))));
    ids.forEach(id => { const c = getCand(id); if (c) { c.rejectReason = reason; setStage(c, 'rejected', reason); } }); UI.sel.clear(); afterCandChange();
    toast(`Rejected ${plural(ids.length, 'candidate')}. Remember to disposition them in Workday.`, '', { label: 'Undo', fn: () => { before.forEach(b => { const i = S.candidates.findIndex(c => c.id === b.id); if (i >= 0) S.candidates[i] = b; }); afterCandChange(); } }); },
  moveOne: el => moveMany([el.dataset.id], el.dataset.stage),
  dismissMissing: () => { cur().missingFromWorkday = false; afterCandChange(); },
  dismissWd: () => { cur().workdayStepChanged = false; afterCandChange(); },
  applyWd: el => { const c = cur(); setStage(c, el.dataset.stage, 'from Workday'); c.workdayStepChanged = false; afterCandChange(); },
  copy: el => copyAndToast(el.dataset.text),
  openResume: async () => { const c = cur(); const blob = await Store.Files.get(c.resume); if (!blob) return toast('Resume file not found', 'err'); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.target = '_blank'; if (!/pdf/.test(c.resume.type || blob.type)) a.download = c.resume.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); },
  removeResume: async () => { if (!(await confirmBox('Remove the attached resume?', 'Remove', true))) return; const c = cur(); await Store.Files.del(c.resume); delete c.resume; log(c, 'file', 'Resume removed'); afterCandChange(); },
  deleteCand: async () => { const c = cur(); if (!(await confirmBox(`Permanently delete <b>${esc(candName(c))}</b> from TalentDesk? (Workday is not affected.)`, 'Delete', true))) return; if (c.resume) await Store.Files.del(c.resume); S.candidates = S.candidates.filter(x => x.id !== c.id); UI.drawer = null; UI.sel.delete(c.id); afterCandChange(); },
  addNote: () => { const t = $('#note-text').value.trim(); if (!t) return; const c = cur(); c.notes.unshift({ id: uid('n_'), at: nowIso(), text: t }); log(c, 'note', 'Note added'); afterCandChange(); },
  delNote: el => { const c = cur(); c.notes = c.notes.filter(n => n.id !== el.dataset.nid); afterCandChange(); },
  modalBg: (el, e) => { if (e.target === el && UI.modal && UI.modal.type !== 'scorecard') { if (UI.modal.type === 'confirm') UI.modal.res(false); closeModal(); } },
  closeModal: () => { if (UI.modal && UI.modal.type === 'confirm') UI.modal.res(false); closeModal(); },
  confirmNo: () => { const r = UI.modal.res; closeModal(); r(false); },
  confirmYes: () => { const r = UI.modal.res; closeModal(); r(true); },
  emOpen: () => { const m = UI.modal; const c = getCand(m.ids[0]); const t = S.templates.find(x => x.id === m.tpl); mailto($('#em-to').value, $('#em-subj').value, $('#em-body').value); if ($('#em-log').checked) recordEmail(c, t); closeModal(); UI._keepScroll = true; render(); },
  emCopy: () => { const m = UI.modal; const c = getCand(m.ids[0]); const t = S.templates.find(x => x.id === m.tpl); copyAndToast(`Subject: ${$('#em-subj').value}\n\n${$('#em-body').value}`, 'Copied subject and message'); if ($('#em-log').checked && !m.done.has(c.id)) { recordEmail(c, t); m.done.add(c.id); UI._keepScroll = true; render(); } },
  emRowOpen: el => { const m = UI.modal; const c = getCand(el.dataset.id); const t = S.templates.find(x => x.id === m.tpl); mailto(c.email, renderTemplate(t.subject, c), renderTemplate(t.body, c)); if (!m.done.has(c.id)) { recordEmail(c, t); m.done.add(c.id); } renderEmailModal(); UI._keepScroll = true; renderResults(); renderDrawer(); },
  emRowCopy: el => { const m = UI.modal; const c = getCand(el.dataset.id); const t = S.templates.find(x => x.id === m.tpl); copyAndToast(`Subject: ${renderTemplate(t.subject, c)}\n\n${renderTemplate(t.body, c)}`, `Copied message for ${candName(c)}`); if (!m.done.has(c.id)) { recordEmail(c, t); m.done.add(c.id); } renderEmailModal(); },
  emMarkAll: () => { const m = UI.modal; const t = S.templates.find(x => x.id === m.tpl); m.ids.forEach(id => { if (!m.done.has(id)) { recordEmail(getCand(id), t); m.done.add(id); } }); closeModal(); UI.sel.clear(); UI._keepScroll = true; render(); toast('Logged as sent'); },
  saveAdd: () => {
    const name = $('#ad-name').value.trim(), email = $('#ad-email').value.trim().toLowerCase(); if (!name && !email) return toast('Add a name or email', 'err');
    const sp = Parse.splitName(name); const stage = $('#ad-stage').value; const t = nowIso(); const url = $('#ad-url').value.trim();
    const c = { id: uid('c_'), key: `man:${uid()}`, origin: 'manual', name: sp.full || email, firstName: sp.first, lastName: sp.last, email, reqId: $('#ad-req').value, currentTitle: $('#ad-title').value.trim(), currentCompany: $('#ad-co').value.trim(), location: $('#ad-loc').value.trim(), source: $('#ad-src').value.trim(), workdayUrl: /workday|myworkday/i.test(url) ? url : '', linkedin: /linkedin/i.test(url) ? url : '', stage, stageEnteredAt: t, createdAt: t, reached: { [stage]: t }, activity: [], notes: url && !/workday/i.test(url) ? [{ id: uid('n_'), at: t, text: 'Profile: ' + url }] : [], scorecards: [], tags: [] };
    log(c, 'create', 'Added manually'); S.candidates.push(c); closeModal(); save(); render(); openCand(c.id);
  },
  viewReq: el => { UI.req = el.dataset.rid; UI.view = 'pipeline'; render(); },
  delReq: el => { S.reqs = S.reqs.filter(r => r.id !== el.dataset.rid); save(); render(); },
  addReq: () => { const id = $('#nr-id').value.trim(); if (!id) return toast('Add a req ID', 'err'); if (S.reqs.some(r => r.id.toLowerCase() === id.toLowerCase())) return toast('That req already exists', 'err'); S.reqs.push({ id, title: $('#nr-title').value.trim(), hmId: $('#nr-hm').value || null, status: 'open', bookingLink: '', createdAt: nowIso() }); save(); render(); },
  delHM: el => { S.hms = S.hms.filter(h => h.id !== el.dataset.hid); save(); render(); },
  addHM: () => { const name = $('#nh-name').value.trim(); if (!name) return toast('Add a name', 'err'); S.hms.push({ id: uid('hm_'), name, email: $('#nh-email').value.trim() }); save(); render(); },
  impBack: () => { UI.imp = null; render(); },
  impDiff: () => {
    const imp = UI.imp; if (!imp.mapping.reqId) { if (!imp.assignReq) return toast('Choose which req this file is for', 'err'); if (imp.assignReq === '__new') { imp.nrId = ($('#imp-nr-id') || {}).value || ''; imp.nrTitle = ($('#imp-nr-title') || {}).value || ''; if (!imp.nrId.trim()) return toast('Add the new req ID', 'err'); } }
    imp.norm = normalizeImport(imp); if (!imp.norm.rows.length) return toast('No usable rows. Check the column mapping and header row.', 'err');
    imp.diff = computeDiff(imp.norm.rows); imp.diff.skipped = imp.norm.skipped; imp.step = 3; render(); $('#view').scrollTop = 0;
  },
  impBackMap: () => { UI.imp.step = 2; render(); },
  impApplyAll: () => applyImport(),
  impReset: () => { UI.imp = null; render(); },
  readReply: () => { UI.reply = parseReply($('#reply-text').value); rerender(); },
  replyCancel: () => { UI.reply = null; rerender(); },
  replyApply: () => applyReply($('#reply-move').checked),
  addTpl: () => { S.templates.push({ id: uid('t_'), name: 'New template', kind: 'other', subject: '{{job_title}} at {{company}}', body: 'Hi {{first_name}},\n\n\n\n{{signature}}' }); save(); rerender(); },
  delTpl: async el => { if (!(await confirmBox('Delete this template?', 'Delete', true))) return; S.templates = S.templates.filter(t => t.id !== el.dataset.tid); save(); rerender(); },
  backup: () => exportBackup(),
  gSync: async el => {
    if (el) el.disabled = true;
    try {
      const r = await Google.sync(); rerender();
      toast(`Calendly sync: ${plural(r.found, 'booking')} found, ${r.updated} updated${r.canceled ? `, ${r.canceled} canceled` : ''}${r.unmatched.length ? `, ${r.unmatched.length} didn't match a candidate` : ''}.${r.errs.length ? ' (' + r.errs.join('; ') + ')' : ''}`, r.errs.length ? 'err' : '', r.unmatched.length ? { label: 'Review', fn: () => openUnmatched(r.unmatched) } : null);
      if (r.unmatched.length) UI.unmatched = r.unmatched;
    } catch (e) { toast(e.message, 'err'); } finally { if (el) el.disabled = false; }
  },
  assignBooking: el => {
    const i = +el.dataset.i; const b = UI.unmatched[i]; const cid = $(`#ub-${i}`).value; if (!cid) return toast('Pick a candidate', 'err');
    const c = getCand(cid); c.altEmails = [...new Set([...(c.altEmails || []), b.email])]; const had = c.bookedAt; c.bookedAt = b.start; if (!c.inviteSentAt) c.inviteSentAt = b.start; if (c.stage === 'new') setStage(c, 'screen', 'booked via Calendly');
    log(c, 'booking', `Calendly: ${had ? 'rescheduled to' : 'booked for'} ${fmtDateTime(b.start)} (booked as ${b.email})`); save();
    UI.unmatched.splice(i, 1); UI.unmatched.length ? openUnmatched(UI.unmatched) : closeModal(); rerender(); toast(`Linked ${b.email} to ${candName(c)}`);
  },
  ignoreBooking: el => { const b = UI.unmatched[+el.dataset.i]; S.settings.ignoredBookingEmails = [...new Set([...(S.settings.ignoredBookingEmails || []), b.email])]; save(); UI.unmatched.splice(+el.dataset.i, 1); UI.unmatched.length ? openUnmatched(UI.unmatched) : closeModal(); },
  connectFolder: async () => { try { const r = await Store.connect(); if (r.cancel) return; if (r.choose) return chooseDataModal(r); afterConnect(r); } catch (e) { toast(e.message, 'err'); } },
  reconnect: async () => { try { afterConnect(await Store.reconnect()); } catch (e) { toast(e.message, 'err'); } },
  useFolderData: async () => { closeModal(); try { afterConnect(await Store.open('folder')); } catch (e) { toast(e.message, 'err'); } },
  useLocalData: async () => { closeModal(); try { afterConnect(await Store.open('local')); } catch (e) { toast(e.message, 'err'); } },
  disconnectFolder: async () => { if (!(await confirmBox('Stop saving to the folder? Your data stays in the folder, and this browser keeps working from its own copy.', 'Stop saving'))) return; await Store.disconnect(); render(); },
  takeOver: async () => { try { await Store.takeOver(); UI.drawer = null; render(); toast('You can edit here now. Any other open window switches to read-only.'); } catch (e) { toast(e.message, 'err'); } },
  wipe: async () => { if (!(await confirmBox('Delete <b>all</b> TalentDesk data in this browser, including candidates, scorecards, notes and resumes? Export a backup first if you might need it.', 'Delete everything', true))) return; if (Store.status === 'ready') await Store.snapshot('before-delete'); await Store.Files.clear(); S = defaultState(); await Store.persistNow(); UI.drawer = null; UI.sel.clear(); UI.imp = null; UI.view = 'pipeline'; render(); toast('All data deleted'); },
};
const CHANGE = {
  bulkMove: el => { if (el.value) moveMany(selectedIds(), el.value); },
  emailTpl: el => { UI.modal.tpl = el.value; renderEmailModal(); },
  attachResume: async el => { const f = el.files[0]; if (!f) return; if (f.size > 8 * 1024 * 1024) return toast('That file is over 8 MB. Try a smaller PDF.', 'err');
    try { const c = cur(); const meta = { id: uid('f_'), name: f.name, type: f.type || 'application/pdf', size: f.size }; await Store.Files.put(meta, f); if (c.resume) await Store.Files.del(c.resume); c.resume = meta; log(c, 'file', 'Resume attached: ' + f.name); afterCandChange(); toast('Resume attached'); } catch (e) { toast(e.message, 'err'); } },
  impFile: el => handleImportFile(el.files[0]),
  impHeader: el => { const imp = UI.imp; imp.headerRow = Math.max(0, Math.min(imp.rows.length - 1, (+el.value || 1) - 1)); imp.mapping = Parse.guessMapping(imp.rows[imp.headerRow]); render(); },
  impMap: el => { UI.imp.mapping[el.dataset.k] = el.value; if (!el.value) delete UI.imp.mapping[el.dataset.k]; rerender(); },
  impAssign: el => { UI.imp.assignReq = el.value; rerender(); },
  impApply: el => { UI.imp.diff.changed[+el.dataset.i].apply = el.checked; },
  impArchive: el => { UI.imp.diff.archiveMissing = el.checked; },
  reportReq: el => { UI.reportReq = el.value; render(); },
  restore: el => { if (el.files[0]) restoreBackup(el.files[0]); el.value = ''; },
};

/* ============================ event wiring ============================ */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.dataset.act === 'open' && e.target.closest('input,select,button:not([data-act="open"]),a:not([data-act="open"])') && e.target.closest('[data-act]') !== el) return;
  fn(el, e);
});
const searchDebounced = debounce(() => renderResults(), 120);
document.addEventListener('input', e => { const el = e.target; if (el.dataset.ui === 'search') { UI.search = el.value; searchDebounced(); } });
document.addEventListener('change', e => {
  const el = e.target; const d = el.dataset;
  if (d.actChange && CHANGE[d.actChange]) return CHANGE[d.actChange](el, e);
  if (d.ui && d.ui !== 'search') { UI[d.ui] = el.type === 'checkbox' ? el.checked : el.value; UI.sel.clear(); return d.ui === 'req' ? render() : renderResults(); }
  if (d.cset === 'stage') { const c = cur(); if (setStage(c, el.value)) { c.workdayStepChanged = false; if (el.value === 'rejected' && !c.rejectReason) c.rejectReason = 'Moved to rejected'; } return afterCandChange(); }
  if (d.cf) { const c = cur(); if (!c) return; const f = d.cf; let v = el.value.trim();
    if (f === 'tags') c.tags = v.split(',').map(x => x.trim()).filter(Boolean);
    else if (f === 'bookedAt') { c.bookedAt = v ? new Date(v).toISOString() : null; if (v) { log(c, 'booking', `Screen booked for ${fmtDateTime(c.bookedAt)}`); if (!c.inviteSentAt) c.inviteSentAt = nowIso(); if (c.stage === 'new') setStage(c, 'screen', 'screen booked'); } }
    else if (f === 'reqId') { log(c, 'req', `Req changed: ${c.reqId} → ${v}`); c.reqId = v; }
    else { if (f === 'name') { const sp = Parse.splitName(v); c.firstName = sp.first; c.lastName = sp.last; v = sp.full; } if (f === 'email') v = v.toLowerCase(); c[f] = v; }
    c.updatedAt = nowIso(); save(); UI._keepScroll = true; renderNav(); if (['pipeline', 'candidates'].includes(UI.view)) renderResults(); if (['bookedAt', 'reqId', 'name'].includes(f)) renderDrawer(); return; }
  if (d.rf) { const r = getReq(d.rid); if (!r) return; r[d.rf] = el.value.trim() || (d.rf === 'hmId' ? null : ''); save(); renderNav(); return; }
  if (d.hf) { const h = getHM(d.hid); if (!h) return; h[d.hf] = el.value.trim(); save(); return; }
  if (d.set) { S.settings[d.set] = el.type === 'number' ? Math.max(1, +el.value || 5) : el.value; save(); renderNav(); return; }
  if (d.setLines) { const v = el.value.split('\n').map(x => x.trim()).filter(Boolean); if (v.length) S.settings[d.setLines] = v; save(); return; }
  if (d.setBool) { S.settings[d.setBool] = el.checked; save(); return; }
  if (d.stageLabel) { const st = S.settings.stages.find(s => s.id === d.stageLabel); if (st && el.value.trim()) st.label = el.value.trim(); save(); return; }
  if (d.tf) { const t = S.templates.find(x => x.id === d.tid); if (t) { t[d.tf] = el.value; save(); } return; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#modal-root').innerHTML) { if (UI.modal && UI.modal.type === 'confirm') UI.modal.res(false); closeModal(); } else if (UI.drawer) { UI.drawer = null; renderDrawer(); } else if (UI.sel.size) { UI.sel.clear(); renderResults(); } return; }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { const s = $('#search'); if (s) { e.preventDefault(); s.focus(); } }
});
/* drag & drop: board cards and import files */
document.addEventListener('dragstart', e => { const card = e.target.closest && e.target.closest('[data-card]'); if (!card) return; const id = card.dataset.card; const ids = UI.sel.has(id) ? [...UI.sel] : [id]; e.dataTransfer.setData('text/plain', 'td:' + ids.join(',')); e.dataTransfer.effectAllowed = 'move'; requestAnimationFrame(() => card.classList.add('dragging')); });
document.addEventListener('dragend', () => { $$('.dragging').forEach(x => x.classList.remove('dragging')); $$('.col.drop').forEach(x => x.classList.remove('drop')); });
document.addEventListener('dragover', e => {
  const files = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'); if (files) { e.preventDefault(); const dz = e.target.closest && e.target.closest('#drop-zone'); $$('.drop-zone').forEach(x => x.classList.toggle('over', x === dz)); return; }
  const col = e.target.closest && e.target.closest('[data-col]'); if (!col) return; e.preventDefault(); $$('.col.drop').forEach(x => x !== col && x.classList.remove('drop')); col.classList.add('drop');
});
document.addEventListener('drop', e => {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); $$('.drop-zone').forEach(x => x.classList.remove('over')); if (UI.view === 'import' && (!UI.imp || UI.imp.step === 1)) handleImportFile(e.dataTransfer.files[0]); else toast('Go to Import from Workday to drop a file', 'err'); return; }
  const col = e.target.closest && e.target.closest('[data-col]'); if (!col) return; e.preventDefault(); col.classList.remove('drop');
  const raw = e.dataTransfer.getData('text/plain') || ''; if (!raw.startsWith('td:')) return; moveMany(raw.slice(3).split(',').filter(Boolean), col.dataset.col);
});
/* chart tooltip */
document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); const tip = $('#tip'); if (!t) { tip.classList.add('hidden'); return; } tip.textContent = t.dataset.tip; tip.classList.remove('hidden'); });
document.addEventListener('mousemove', e => { const tip = $('#tip'); if (tip.classList.contains('hidden')) return; tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; });
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist.flush(); });
window.addEventListener('beforeunload', () => persist.flush());
window.addEventListener('pagehide', () => { Store.releaseLock(); });

function openUnmatched(list) {
  UI.unmatched = list; UI.modal = { type: 'unmatched' };
  const opts = S.candidates.filter(isActive).sort((a, b) => candName(a).localeCompare(candName(b))).map(c => `<option value="${c.id}">${esc(candName(c))} · ${esc(c.reqId)} · ${esc(stageLabel(c.stage))}</option>`).join('');
  openModal('Bookings that didn\'t match a candidate', `<p class="sec small" style="margin-top:0">These people booked through Calendly with an email that isn't on any candidate (often a personal vs. work address). Link each one to the right candidate and TalentDesk will remember that address next time.</p>
    ${list.map((b, i) => `<div class="cand-line" style="flex-wrap:wrap"><div style="flex:1;min-width:220px"><div style="font-weight:600">${esc(b.name || b.email)}</div><div class="muted small">${esc(b.email)} · ${esc(fmtDateTime(b.start))}${b.title ? ' · ' + esc(b.title) : ''}</div></div><select class="input sm" id="ub-${i}" style="max-width:260px"><option value="">Link to candidate…</option>${opts}</select><button class="btn sm primary" data-act="assignBooking" data-i="${i}">Link</button><button class="btn sm ghost" data-act="ignoreBooking" data-i="${i}" title="Not a candidate. Don't show this address again">Ignore</button></div>`).join('')}`,
    `<button class="btn" data-act="closeModal">Done</button>`, true);
}
function chooseDataModal(r) {
  UI.modal = { type: 'choose' };
  openModal('This folder already has TalentDesk data', `<div class="stack"><p style="margin:0">The folder <b>“${esc(Store.folderName)}”</b> has <b>${plural(r.folderCount, 'candidate')}</b> (last saved ${esc(fmtDateTime(r.folderAt))}).<br>This browser has <b>${plural(S.candidates.length, 'candidate')}</b>.</p><p class="sec small" style="margin:0">Which one do you want to keep? If you replace the folder's data, a copy of it is saved in its backups folder first.</p></div>`,
    `<button class="btn" data-act="useLocalData">Replace with this browser's data</button><button class="btn primary" data-act="useFolderData">Use the folder's data</button>`);
}
function afterConnect(r) {
  UI.drawer = null; UI.sel.clear(); render();
  if (r.busy) return;
  toast(r.source === 'folder' ? `Loaded your data from “${Store.folderName}”` : `Saving to “${Store.folderName}” from now on`);
}
async function init() {
  if (/^https?:$/.test(location.protocol)) {
    const m = document.createElement('link'); m.rel = 'manifest'; m.href = 'manifest.webmanifest'; document.head.appendChild(m);
    if ('serviceWorker' in navigator && !window.__tdTestFolder) navigator.serviceWorker.register('sw.js').catch(() => { });
  }
  await DB.init();
  try { const st = await DB.loadState(); if (st) S = migrate(st) || defaultState(); } catch (e) { toast('Could not load saved data: ' + e.message, 'err'); }
  try { if ((await Store.init()) === 'ready') await Store.open('auto'); } catch (e) { toast('Could not open your data folder: ' + e.message, 'err'); }
  render();
  if (DB.mode === 'memory') toast("This browser is blocking storage for local files, so nothing will be saved. Open this file in Chrome or Edge.", 'err');
  if (UI.view === 'settings' && navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(x => { const el = $('#storage-est'); if (el) el.textContent = `Using ${(x.usage / 1048576).toFixed(1)} MB of browser storage.`; }).catch(() => { });
}
init();
