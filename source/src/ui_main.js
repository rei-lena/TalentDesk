/* ============================ UI state & shell ============================ */
const UI = { view: 'pipeline', req: 'all', search: '', onlyAction: false, showClosed: false, sel: new Set(), drawer: null, tab: 'overview', sort: { k: 'stageEnteredAt', dir: 1 }, imp: null, reportReq: 'all', reply: null, modal: null };

const ICONS = {
  board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const VIEWS = {
  pipeline: { title: 'Pipeline', icon: 'board', render: viewPipeline, actions: () => `${Google.configured() && Google.available() ? `<button class="btn" data-act="gSync" title="${S.settings.lastGoogleSync ? 'Last synced ' + esc(fmtDateTime(S.settings.lastGoogleSync)) : 'Not synced yet'}">${icon('calendar')} Sync Calendly</button>` : ''}<button class="btn" data-act="addCand">${icon('plus')} Add candidate</button><button class="btn primary" data-act="nav" data-view="import">${icon('upload')} Import from Workday</button>` },
  candidates: { title: 'Candidates', icon: 'list', render: viewCandidates, actions: () => `<button class="btn" data-act="exportCsv">${icon('download')} Export CSV</button><button class="btn" data-act="addCand">${icon('plus')} Add candidate</button>` },
  reqs: { title: 'Reqs & hiring managers', icon: 'briefcase', render: viewReqs },
  import: { title: 'Import from Workday', icon: 'upload', render: viewImport },
  reviews: { title: 'HM reviews', icon: 'inbox', render: viewReviews },
  reports: { title: 'Reports', icon: 'chart', render: viewReports },
  settings: { title: 'Settings', icon: 'gear', render: viewSettings },
};

function renderNav() {
  const actionN = S.candidates.filter(c => needsAction(c) && (getReq(c.reqId) || {}).status !== 'closed').length;
  const hmN = S.candidates.filter(c => hmPending(c) || (c.stage === 'hm_review' && c.hmDecision && c.hmDecision.at >= (c.stageEnteredAt || ''))).length;
  const badges = { pipeline: actionN, reviews: hmN };
  const order = ['pipeline', 'candidates', 'reqs', 'sep', 'import', 'reviews', 'reports', 'sep', 'settings'];
  $('#nav').innerHTML = order.map(k => k === 'sep' ? '<div class="nav-sep"></div>' :
    `<button class="nav-btn ${UI.view === k ? 'active' : ''}" data-act="nav" data-view="${k}">${icon(VIEWS[k].icon)}<span>${esc(VIEWS[k].title.replace(' & hiring managers', ' & HMs'))}</span>${badges[k] ? `<span class="nav-badge ${k === 'reviews' ? 'hot' : ''}" title="${k === 'pipeline' ? 'Candidates needing action' : 'Waiting on HM review or your follow-up'}">${badges[k]}</span>` : ''}</button>`).join('');
  const d = daysSince(S.lastBackupAt); const warn = Store.status !== 'ready' && (d === null ? S.candidates.length > 0 : d >= 7);
  $('#backup-btn').innerHTML = `<span class="dot ${warn ? 'warn' : ''}"></span><span>${Store.status === 'ready' ? 'Daily backups on' : S.lastBackupAt ? 'Backed up ' + relDays(S.lastBackupAt) : 'No backup yet'}</span><span class="spacer"></span>${icon('download')}`;
  $('#storage-note').innerHTML = Store.status === 'ready' ? `<span title="Data is saved to this folder">📁 Saving to “${esc(Store.folderName)}”</span>${Store.readonly ? ' · <b>read-only</b>' : ''}`
    : DB.mode === 'memory' ? 'Not saving: browser storage blocked' : `<a href="#" class="warnlink" data-act="nav" data-view="settings">⚠ Saved in this browser only. Set up a data folder</a>`;
}

function render() {
  renderNav();
  const v = VIEWS[UI.view] || VIEWS.pipeline;
  $('#view-title').textContent = v.title;
  $('#view-actions').innerHTML = v.actions ? v.actions() : '';
  const scroller = $('#view'); const top = scroller.scrollTop, left = (scroller.querySelector('.board') || {}).scrollLeft;
  scroller.innerHTML = v.render();
  if (UI._keepScroll) { scroller.scrollTop = top; UI._keepScroll = false; } else scroller.scrollTop = 0;
  renderDrawer(); renderBulk();
  $('#banner').innerHTML = storageBannerHTML(); $('#gate-root').innerHTML = gateHTML();
}
function rerender() { UI._keepScroll = true; render(); }

function secsAgo(iso) { const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000)); return s < 90 ? s + 's ago' : Math.round(s / 60) + ' min ago'; }
function storageBannerHTML() {
  const ro = Store.readonly; if (!ro) return '';
  if (ro.kind === 'changed') return `<div class="banner warn"><b>Your data was changed somewhere else</b> (another computer or window). This window is read-only so nothing gets overwritten.<button class="btn sm" data-act="takeOver">Load the latest and continue here</button></div>`;
  const l = ro.lock || {};
  return `<div class="banner warn"><b>Read-only:</b> TalentDesk is open ${l.device === DEVICE ? 'in another window or tab in this browser' : 'on <b>' + esc(l.device || 'another computer') + '</b>'}${l.at ? ' (active ' + secsAgo(l.at) + ')' : ''}. Close it there, or<button class="btn sm" data-act="takeOver">Take over here</button></div>`;
}
function gateHTML() {
  if (Store.status !== 'needs-permission') return '';
  return `<div class="gate" role="dialog" aria-modal="true" aria-label="Reconnect data folder"><div class="gate-card"><div class="brand-mark" style="width:40px;height:40px;font-size:15px">TD</div><h2>Welcome back</h2>
   <p>Reconnect to your data folder <b>“${esc(Store.folderName)}”</b> to pick up where you left off. Your browser asks for this once each time you open TalentDesk.</p>
   <button class="btn primary" data-act="reconnect" autofocus>Reconnect to “${esc(Store.folderName)}”</button><button class="btn ghost sm" data-act="connectFolder">Choose a different folder</button></div></div>`;
}

/* ============================ pipeline & candidates ============================ */
function filteredCands() {
  const q = norm(UI.search);
  return S.candidates.filter(c => {
    if (UI.req !== 'all') { if (c.reqId !== UI.req) return false; }
    else { const r = getReq(c.reqId); if (r && r.status === 'closed') return false; }
    if (!UI.showClosed && c.stage === 'rejected') return false;
    if (UI.onlyAction && !needsAction(c)) return false;
    if (q) { const hay = norm([candName(c), c.email, c.currentTitle, c.currentCompany, c.reqId, (getReq(c.reqId) || {}).title, c.source, (c.tags || []).join(' '), c.location].join(' ')); if (!q.split(' ').every(w => hay.includes(w))) return false; }
    return true;
  });
}
function filterBar() {
  const open = S.reqs.filter(r => r.status !== 'closed');
  return `<div class="toolbar">
    <select class="input" data-ui="req" aria-label="Req"><option value="all">All open reqs (${open.length})</option>${S.reqs.map(r => `<option value="${esc(r.id)}" ${UI.req === r.id ? 'selected' : ''}>${esc(reqLabel(r.id))}${r.status === 'closed' ? ' (closed)' : ''}</option>`).join('')}</select>
    <div class="search">${icon('search')}<input class="input" id="search" data-ui="search" placeholder="Search name, title, company, tag…  ( / )" value="${esc(UI.search)}" autocomplete="off"></div>
    <label class="chk"><input type="checkbox" data-ui="onlyAction" ${UI.onlyAction ? 'checked' : ''}> Needs action only</label>
    <label class="chk"><input type="checkbox" data-ui="showClosed" ${UI.showClosed ? 'checked' : ''}> Show rejected</label>
    <span class="spacer"></span><span class="muted small" id="result-count"></span></div>`;
}
function emptyState() {
  return `<div class="empty"><h2>No candidates yet</h2><p>Export your candidates from Workday (any report or grid → <b>Export to Excel</b>) and drop the file in.<br>Or load sample data to see how everything works first.</p>
  <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-act="nav" data-view="import">${icon('upload')} Import from Workday</button><button class="btn" data-act="loadDemo">Load demo data</button></div></div>`;
}
function viewPipeline() {
  if (!S.candidates.length) return emptyState();
  return filterBar() + `<div id="results">${boardHTML()}</div>`;
}
function stageSortKey(c) { const ss = screenStatus(c); const o = { todo: 0, done: 1, invited: 2, booked: 3 }; return [needsAction(c) ? 0 : 1, ss ? o[ss.k] : 0, c.stageEnteredAt || '']; }
function cmpKeys(a, b) { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; }
function cardChips(c, showReq) {
  const chips = [];
  if (showReq) chips.push(`<span class="chip outline" title="${esc(reqLabel(c.reqId))}">${esc(c.reqId || 'No req')}</span>`);
  const ss = screenStatus(c); if (ss) chips.push(`<span class="chip ${ss.cls}">${esc(ss.t)}</span>`);
  if (c.stage === 'hm_review' && hmPending(c)) { const sent = c.sentToHmAt && c.sentToHmAt >= (c.stageEnteredAt || ''); chips.push(`<span class="chip ${sent ? 'outline' : 'violet'}">${sent ? 'With HM · ' + relDays(c.sentToHmAt) : 'To send to HM'}</span>`); }
  if (c.hmDecision && c.hmDecision.at >= (c.stageEnteredAt || '')) { const d = DECISIONS[c.hmDecision.decision]; if (d) chips.push(`<span class="chip ${d.cls}">HM: ${d.label}</span>`); }
  const sc = latestScorecard(c); if (sc && c.stage === 'hm_review') { const r = RECS.find(x => x.id === sc.recommendation); if (r) chips.push(`<span class="chip">Rec: ${r.label}</span>`); }
  if (isActive(c)) chips.push(isStale(c) ? `<span class="chip warn" title="Longer than ${S.settings.staleDays} days in this stage">${daysInStage(c)}d in stage</span>` : `<span class="chip" title="Days in stage">${daysInStage(c)}d</span>`);
  if (c.workdayStepChanged) chips.push(`<span class="chip blue" title="Workday step changed in the last import">WD: ${esc(c.workdayStep)}</span>`);
  if (c.missingFromWorkday) chips.push(`<span class="chip bad" title="Not in the latest Workday export for this req">Not in export</span>`);
  return chips.join('');
}
function cardHTML(c, showReq) {
  return `<div class="card ${UI.sel.has(c.id) ? 'sel' : ''}" draggable="true" data-card="${c.id}" data-act="open" data-id="${c.id}">
    <input type="checkbox" class="pick" data-act="pick" data-id="${c.id}" ${UI.sel.has(c.id) ? 'checked' : ''} aria-label="Select ${esc(candName(c))}">
    <div class="nm">${esc(candName(c))}</div><div class="sub">${esc([c.currentTitle, c.currentCompany].filter(Boolean).join(' @ ') || c.email || ' ')}</div>
    <div class="chips">${cardChips(c, showReq)}</div></div>`;
}
function boardHTML() {
  const list = filteredCands();
  const stages = stageList().filter(s => s.id !== 'rejected' || UI.showClosed);
  setTimeout(() => { const rc = $('#result-count'); if (rc) rc.textContent = plural(list.length, 'candidate'); });
  return `<div class="board ${UI.sel.size ? 'selecting' : ''}">${stages.map(s => {
    const items = list.filter(c => c.stage === s.id).sort((a, b) => cmpKeys(stageSortKey(a), stageSortKey(b)));
    const allSel = items.length && items.every(c => UI.sel.has(c.id));
    return `<section class="col" data-col="${s.id}" aria-label="${esc(s.label)}"><div class="col-head">${esc(s.label)} <span class="count">${items.length}</span><span class="spacer"></span>${items.length ? `<input type="checkbox" class="pick-col" data-act="pickcol" data-stage="${s.id}" ${allSel ? 'checked' : ''} title="Select all in column" aria-label="Select all in ${esc(s.label)}">` : ''}</div>
      <div class="col-body">${items.map(c => cardHTML(c, UI.req === 'all')).join('') || '<div class="col-empty">Drag candidates here</div>'}</div></section>`;
  }).join('')}</div>`;
}
function viewCandidates() {
  if (!S.candidates.length) return emptyState();
  return filterBar() + `<div id="results" class="page full" style="padding-top:12px">${tableHTML()}</div>`;
}
const COLS = [
  { k: 'name', l: 'Name', v: c => candName(c).toLowerCase() }, { k: 'reqId', l: 'Req', v: c => c.reqId || '' }, { k: 'stage', l: 'Stage', v: c => stageIdx(c.stage) },
  { k: 'status', l: 'Status', v: c => (screenStatus(c) || {}).t || '' }, { k: 'rec', l: 'Recruiter rec', v: c => { const s = latestScorecard(c); return s ? RECS.findIndex(r => r.id === s.recommendation) : 9; } },
  { k: 'stageEnteredAt', l: 'In stage', v: c => c.stageEnteredAt || '', num: true }, { k: 'appliedAt', l: 'Applied', v: c => c.appliedAt || '' }, { k: 'source', l: 'Source', v: c => (c.source || '').toLowerCase() }, { k: 'workdayStep', l: 'Workday step', v: c => (c.workdayStep || '').toLowerCase() },
];
function tableHTML() {
  const list = filteredCands(); const col = COLS.find(x => x.k === UI.sort.k) || COLS[5];
  list.sort((a, b) => { const x = col.v(a), y = col.v(b); return (x < y ? -1 : x > y ? 1 : 0) * UI.sort.dir; });
  setTimeout(() => { const rc = $('#result-count'); if (rc) rc.textContent = plural(list.length, 'candidate'); });
  const allSel = list.length && list.every(c => UI.sel.has(c.id));
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:28px"><input type="checkbox" data-act="pickall" ${allSel ? 'checked' : ''} aria-label="Select all"></th>${COLS.map(x => `<th class="sortable ${x.num ? 'num' : ''}" data-act="sort" data-k="${x.k}">${x.l}${UI.sort.k === x.k ? (UI.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead><tbody>
  ${list.map(c => { const sc = latestScorecard(c); const rec = sc && RECS.find(r => r.id === sc.recommendation); const ss = screenStatus(c); const hd = c.hmDecision && DECISIONS[c.hmDecision.decision];
    return `<tr class="click ${UI.sel.has(c.id) ? 'sel' : ''}" data-act="open" data-id="${c.id}"><td><input type="checkbox" data-act="pick" data-id="${c.id}" ${UI.sel.has(c.id) ? 'checked' : ''} aria-label="Select"></td>
    <td><div style="font-weight:600">${esc(candName(c))}</div><div class="muted small">${esc(c.email || '')}</div></td><td title="${esc(reqLabel(c.reqId))}">${esc(c.reqId || '')}</td><td>${esc(stageLabel(c.stage))}</td>
    <td>${ss ? `<span class="chip ${ss.cls}">${esc(ss.t)}</span>` : ''}${hd ? ` <span class="chip ${hd.cls}">HM: ${hd.label}</span>` : ''}${c.missingFromWorkday ? ' <span class="chip bad">Not in export</span>' : ''}</td>
    <td>${rec ? `<span class="chip ${rec.cls}">${rec.label}</span>` : '<span class="muted">—</span>'}</td><td class="num">${isActive(c) ? (isStale(c) ? `<span class="chip warn">${daysInStage(c)}d</span>` : daysInStage(c) + 'd') : '—'}</td>
    <td>${esc(fmtDate(c.appliedAt))}</td><td>${esc(c.source || '')}</td><td class="sec">${esc(c.workdayStep || '')}</td></tr>`; }).join('') || `<tr><td colspan="${COLS.length + 1}" class="empty">No candidates match these filters.</td></tr>`}
  </tbody></table></div>`;
}
function renderResults() { const el = $('#results'); if (!el) return render(); el.innerHTML = UI.view === 'pipeline' ? boardHTML() : tableHTML(); renderBulk(); renderNav(); }

function renderBulk() {
  const root = $('#bulk-root');
  if (!UI.sel.size || !['pipeline', 'candidates'].includes(UI.view)) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="bulkbar" role="toolbar" aria-label="Bulk actions"><strong>${UI.sel.size} selected</strong>
   <select data-act-change="bulkMove" aria-label="Move to stage"><option value="">Move to…</option>${stageList().map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select>
   <button class="btn sm" data-act="bulkEmail">${icon('mail')} Email</button><button class="btn sm" data-act="bulkPacket">${icon('send')} HM review packet</button>
   <button class="btn sm" data-act="bulkCopyEmails">${icon('copy')} Copy emails</button><button class="btn sm" data-act="bulkReject">Reject</button><button class="btn sm" data-act="clearSel">${icon('x')}</button></div>`;
}

function moveMany(ids, stage, why) {
  const before = ids.map(id => { const c = getCand(id); return c && JSON.parse(JSON.stringify(c)); }).filter(Boolean);
  let n = 0; ids.forEach(id => { const c = getCand(id); if (c && setStage(c, stage, why)) { c.workdayStepChanged = false; n++; } });
  if (!n) return; save(); UI.sel.clear(); rerender();
  toast(`Moved ${plural(n, 'candidate')} to ${stageLabel(stage)}`, '', { label: 'Undo', fn: () => { before.forEach(b => { const i = S.candidates.findIndex(c => c.id === b.id); if (i >= 0) S.candidates[i] = b; }); save(); rerender(); } });
}

/* ============================ drawer ============================ */
function renderDrawer() {
  const root = $('#drawer-root'); const c = UI.drawer && getCand(UI.drawer);
  if (!c) { root.innerHTML = ''; return; }
  const body = root.querySelector('.drawer-body'); const st = body ? body.scrollTop : 0; const same = root.dataset.cid === c.id && root.dataset.tab === UI.tab;
  root.dataset.cid = c.id; root.dataset.tab = UI.tab;
  root.innerHTML = `<div class="scrim" data-act="closeDrawer"></div><aside class="drawer" role="dialog" aria-label="${esc(candName(c))}">${drawerInner(c)}</aside>`;
  if (same) { const b = root.querySelector('.drawer-body'); if (b) b.scrollTop = st; }
}
function drawerInner(c) {
  const sc = latestScorecard(c); const ss = screenStatus(c);
  const tabs = [['overview', 'Overview'], ['scorecards', `Scorecards${c.scorecards.length ? ' (' + c.scorecards.length + ')' : ''}`], ['notes', `Notes${c.notes.length ? ' (' + c.notes.length + ')' : ''}`], ['activity', 'Activity']];
  return `<div class="drawer-head"><div class="row"><div class="avatar">${esc(initials(c))}</div><div style="min-width:0;flex:1"><h2>${esc(candName(c))}</h2><div class="sec small">${esc([c.currentTitle, c.currentCompany].filter(Boolean).join(' @ ') || c.email || '')}</div></div><button class="btn ghost" data-act="closeDrawer" aria-label="Close">${icon('x')}</button></div>
   <div class="row wrap mt-s"><select class="input sm" data-cset="stage" aria-label="Stage">${stageList().map(s => `<option value="${s.id}" ${c.stage === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
    <span class="chip outline">${esc(reqLabel(c.reqId))}</span>${ss ? `<span class="chip ${ss.cls}">${esc(ss.t)}</span>` : ''}${isActive(c) ? `<span class="chip">${daysInStage(c)}d in stage</span>` : ''}</div>
   <div class="row wrap mt-s"><button class="btn sm" data-act="email">${icon('mail')} Email</button>
    ${['new', 'screen'].includes(c.stage) && !sc ? `<button class="btn sm" data-act="markInvited">Mark invited</button><button class="btn sm" data-act="logBooking">${icon('calendar')} Log booking</button>` : ''}
    <button class="btn sm ${['new', 'screen'].includes(c.stage) && !sc ? 'primary' : ''}" data-act="scorecard">${icon('plus')} Scorecard</button>
    ${sc ? `<button class="btn sm" data-act="copySc" data-style="workday" data-sc="${sc.id}">${icon('copy')} For Workday</button><button class="btn sm" data-act="copySc" data-style="teams" data-sc="${sc.id}">${icon('copy')} For Teams</button>` : ''}
    ${c.stage !== 'rejected' ? `<button class="btn sm danger" data-act="reject">Reject</button>` : ''}</div></div>
   <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>
   <div class="drawer-body">${UI.tab === 'scorecards' ? tabScorecards(c) : UI.tab === 'notes' ? tabNotes(c) : UI.tab === 'activity' ? tabActivity(c) : tabOverview(c)}</div>`;
}
function inp(c, f, ph = '', type = 'text') { return `<input class="input flat" type="${type}" data-cf="${f}" value="${esc(c[f] || '')}" placeholder="${esc(ph)}">`; }
function tabOverview(c) {
  const hd = c.hmDecision; const d = hd && DECISIONS[hd.decision]; const hm = hd && getHM(hd.hmId);
  const sug = c.workdayStepChanged ? guessStage(c.workdayStep) : null;
  return `${c.missingFromWorkday ? `<div class="callout warn mb">Not in the latest Workday export for this req. They may have been dispositioned or withdrawn in Workday. <button class="btn sm" data-act="dismissMissing">Dismiss</button></div>` : ''}
  ${c.workdayStepChanged ? `<div class="callout mb">Workday step changed to <b>${esc(c.workdayStep)}</b>. <span class="row mt-s">${sug && sug !== c.stage ? `<button class="btn sm primary" data-act="applyWd" data-stage="${sug}">Move to ${esc(stageLabel(sug))}</button>` : ''}<button class="btn sm" data-act="dismissWd">Dismiss</button></span></div>` : ''}
  ${d ? `<div class="decision ${hd.decision}"><div class="row"><strong>${esc(hm ? hm.name : 'Hiring manager')}: ${d.label}</strong><span class="spacer"></span><span class="small sec">${fmtDate(hd.at)}</span></div>${hd.comment ? `<div class="mt-s">${esc(hd.comment)}</div>` : ''}</div>` : ''}
  <div class="section-t">Contact & details</div>
  <dl class="kv">
   <dt>Name</dt><dd>${inp(c, 'name')}</dd>
   <dt>Email</dt><dd class="row">${inp(c, 'email', 'name@example.com', 'email')}${c.email ? `<button class="btn ghost sm" data-act="copy" data-text="${esc(c.email)}" title="Copy email">${icon('copy')}</button>` : ''}</dd>
   <dt>Phone</dt><dd>${inp(c, 'phone')}</dd>
   <dt>Current title</dt><dd>${inp(c, 'currentTitle')}</dd><dt>Current company</dt><dd>${inp(c, 'currentCompany')}</dd>
   <dt>Location</dt><dd>${inp(c, 'location')}</dd><dt>Source</dt><dd>${inp(c, 'source')}</dd>
   <dt>Req</dt><dd><select class="input sm" data-cf="reqId">${S.reqs.map(r => `<option value="${esc(r.id)}" ${r.id === c.reqId ? 'selected' : ''}>${esc(reqLabel(r.id))}</option>`).join('')}${getReq(c.reqId) ? '' : `<option selected value="${esc(c.reqId || '')}">${esc(c.reqId || 'None')}</option>`}</select></dd>
   <dt>Applied</dt><dd class="sec" style="padding:3px 6px">${esc(fmtDate(c.appliedAt) || '—')}</dd>
   <dt>Workday step</dt><dd class="sec" style="padding:3px 6px">${esc(c.workdayStep || '—')}</dd>
   <dt>Workday ID</dt><dd>${inp(c, 'workdayId')}</dd>
   <dt>Workday link</dt><dd class="row">${inp(c, 'workdayUrl', "Paste the candidate's Workday URL")}${c.workdayUrl ? `<a class="btn ghost sm" href="${esc(c.workdayUrl)}" target="_blank" rel="noopener">Open</a>` : ''}</dd>
   <dt>Tags</dt><dd><input class="input flat" data-cf="tags" value="${esc((c.tags || []).join(', '))}" placeholder="e.g. referral, silver medalist"></dd>
  </dl>
  <div class="section-t">Resume</div>
  ${c.resume ? `<div class="row">${icon('file')}<span>${esc(c.resume.name)}</span><span class="muted small">${Math.round((c.resume.size || 0) / 1024)} KB</span><span class="spacer"></span><button class="btn sm" data-act="openResume">Open</button><button class="btn sm ghost danger" data-act="removeResume">Remove</button></div>`
      : `<div class="row wrap"><label class="btn sm">${icon('file')} Attach resume<input type="file" accept=".pdf,.doc,.docx" data-act-change="attachResume" hidden></label><span class="muted small">Download it from Workday and attach it here. It's included in HM review packets.</span></div>`}
  <div class="section-t">Recruiter screen</div>
  <dl class="kv"><dt>Invite sent</dt><dd class="sec" style="padding:3px 6px">${c.inviteSentAt ? esc(fmtDateTime(c.inviteSentAt)) : '—'}</dd>
   <dt>Booked for</dt><dd><input class="input sm" type="datetime-local" data-cf="bookedAt" value="${toLocalInput(c.bookedAt)}" aria-label="Booked for"></dd>
   <dt>Screened</dt><dd class="sec" style="padding:3px 6px">${latestScorecard(c) ? esc(fmtDate(latestScorecard(c).at)) : '—'}</dd>
   <dt>Sent to HM</dt><dd class="sec" style="padding:3px 6px">${c.sentToHmAt ? esc(fmtDate(c.sentToHmAt)) : '—'}</dd></dl>
  ${c.stage === 'rejected' && c.rejectReason ? `<div class="section-t">Rejection</div><div>${esc(c.rejectReason)}</div>` : ''}
  <div class="row mt" style="justify-content:flex-end"><button class="btn sm ghost danger" data-act="deleteCand">Delete candidate</button></div>`;
}
function tabScorecards(c) {
  if (!c.scorecards.length) return `<div class="empty"><p>No scorecard yet.</p><button class="btn primary" data-act="scorecard">${icon('plus')} Add scorecard</button><p class="muted small mt">Tip: paste your Granola notes and it will fill in the fields.</p></div>`;
  return c.scorecards.map(sc => { const rec = RECS.find(r => r.id === sc.recommendation);
    return `<div class="sc"><div class="row"><strong>Recruiter screen</strong><span class="muted small">${esc(fmtDate(sc.at))}</span>${rec ? `<span class="chip ${rec.cls}">${rec.label}</span>` : ''}${sc.rating ? `<span class="chip">${sc.rating}/4</span>` : ''}<span class="spacer"></span>
    <button class="btn sm" data-act="copySc" data-style="workday" data-sc="${sc.id}">For Workday</button><button class="btn sm" data-act="copySc" data-style="teams" data-sc="${sc.id}">For Teams</button><button class="btn sm ghost" data-act="scorecard" data-sc="${sc.id}">Edit</button><button class="btn sm ghost danger" data-act="delSc" data-sc="${sc.id}" aria-label="Delete scorecard">${icon('x')}</button></div>
    <dl>${Object.keys(sc.fields || {}).filter(f => sc.fields[f]).map(f => `<dt>${esc(f)}</dt><dd>${esc(sc.fields[f])}</dd>`).join('')}</dl></div>`; }).join('');
}
function tabNotes(c) {
  return `<textarea class="input" id="note-text" rows="3" placeholder="Add a note…"></textarea><div class="row mt-s"><span class="spacer"></span><button class="btn sm primary" data-act="addNote">Add note</button></div>
  <ul class="timeline mt">${c.notes.map(n => `<li><span class="when">${esc(fmtDateTime(n.at))}</span><span style="flex:1;white-space:pre-wrap">${esc(n.text)}</span><button class="btn ghost sm" data-act="delNote" data-nid="${n.id}" aria-label="Delete note">${icon('x')}</button></li>`).join('') || '<li class="muted">No notes yet.</li>'}</ul>`;
}
function tabActivity(c) { return `<ul class="timeline">${c.activity.map(a => `<li><span class="when">${esc(fmtDateTime(a.at))}</span><span>${esc(a.text)}</span></li>`).join('') || '<li class="muted">No activity.</li>'}</ul>`; }

/* ============================ modals ============================ */
function openModal(title, body, foot, wide) {
  $('#modal-root').innerHTML = `<div class="modal-wrap" data-act="modalBg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><span class="spacer"></span><button class="btn ghost" data-act="closeModal" aria-label="Close">${icon('x')}</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
  const f = $('#modal-root [autofocus]') || $('#modal-root .modal-body input, #modal-root .modal-body textarea, #modal-root .modal-body select'); if (f) setTimeout(() => f.focus(), 30);
}
function closeModal() { $('#modal-root').innerHTML = ''; UI.modal = null; }
function confirmBox(msg, ok = 'Confirm', danger = false) {
  return new Promise(res => { UI.modal = { type: 'confirm', res }; openModal('Please confirm', `<p style="margin:0">${msg}</p>`, `<button class="btn" data-act="confirmNo">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirmYes" autofocus>${esc(ok)}</button>`); });
}

function defaultTplFor(cands) { const c = cands[0]; const kind = c && c.stage === 'hm_interview' ? 'next' : c && c.inviteSentAt && !c.bookedAt ? 'reminder' : 'invite'; return (S.templates.find(t => t.kind === kind) || S.templates[0] || {}).id; }
function openEmail(ids, tplId) { const cands = ids.map(getCand).filter(Boolean); if (!cands.length) return; UI.modal = { type: 'email', ids: cands.map(c => c.id), tpl: tplId || defaultTplFor(cands), done: new Set() }; renderEmailModal(); }
function renderEmailModal() {
  const m = UI.modal; const t = S.templates.find(x => x.id === m.tpl) || S.templates[0]; if (!t) { toast('Add an email template in Settings first', 'err'); return; }
  const cands = m.ids.map(getCand).filter(Boolean);
  const sel = `<label class="field">Template<select class="input" data-act-change="emailTpl">${S.templates.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`;
  const marks = t.kind === 'invite' ? ' and mark the invite as sent' : '';
  if (cands.length === 1) {
    const c = cands[0];
    openModal(`Email ${candName(c)}`, `<div class="stack">${sel}<label class="field">To<input class="input" value="${esc(c.email || '')}" id="em-to"></label><label class="field">Subject<input class="input" id="em-subj" value="${esc(renderTemplate(t.subject, c))}"></label><label class="field">Message<textarea class="input" id="em-body" rows="12">${esc(renderTemplate(t.body, c))}</textarea></label>
      <label class="chk"><input type="checkbox" id="em-log" checked> Log this on the candidate${marks}</label>${!S.settings.bookingLink && /booking_link/.test(t.body) ? '<div class="callout warn small">Tip: add your booking link in Settings so it fills in automatically.</div>' : ''}</div>`,
      `<button class="btn" data-act="emCopy">${icon('copy')} Copy message</button><button class="btn primary" data-act="emOpen">${icon('mail')} Open in Outlook</button>`);
  } else {
    const noEmail = cands.filter(c => !c.email).length;
    openModal(`Email ${cands.length} candidates`, `<div class="stack">${sel}<p class="sec small" style="margin:0">Each <b>Open</b> starts a personalized Outlook draft. Sending them one by one keeps them personal and logs each candidate${marks}.</p>
      ${noEmail ? `<div class="callout warn small">${plural(noEmail, 'candidate')} have no email address.</div>` : ''}
      <div>${cands.map(c => `<div class="cand-line"><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(candName(c))}</div><div class="muted small">${esc(c.email || 'no email')} · ${esc(c.reqId || '')}</div></div>${m.done.has(c.id) ? '<span class="chip good">Logged</span>' : ''}<button class="btn sm" data-act="emRowCopy" data-id="${c.id}">${icon('copy')}</button><button class="btn sm ${m.done.has(c.id) ? '' : 'primary'}" data-act="emRowOpen" data-id="${c.id}" ${c.email ? '' : 'disabled'}>Open</button></div>`).join('')}</div></div>`,
      `<button class="btn" data-act="bulkCopyEmails">${icon('copy')} Copy all addresses (for BCC)</button><span class="spacer"></span><button class="btn" data-act="emMarkAll">Log all as sent</button><button class="btn primary" data-act="closeModal">Done</button>`, false);
  }
}
function mailto(to, subject, body) { const a = document.createElement('a'); a.href = `mailto:${encodeURIComponent(to || '').replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`; document.body.appendChild(a); a.click(); a.remove(); }
function recordEmail(c, t) {
  if (!c || !t) return; log(c, 'email', `Email: ${t.name}`);
  if (t.kind === 'invite') { c.inviteSentAt = nowIso(); if (c.stage === 'new') setStage(c, 'screen', 'invite sent'); }
  if (t.kind === 'reminder') c.reminderSentAt = nowIso();
  save();
}

function openBooking(c) {
  const d = new Date(Date.now() + DAY); d.setMinutes(0, 0, 0); d.setHours(10);
  UI.modal = { type: 'booking', cid: c.id };
  openModal('Log screen booking', `<div class="stack"><p class="sec" style="margin:0">When is your call with <b>${esc(candName(c))}</b>?</p><input class="input" type="datetime-local" id="bk-at" value="${toLocalInput(c.bookedAt) || toLocalInput(d.toISOString())}"></div>`,
    `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveBooking">Save</button>`);
}

function openScorecard(c, scId) {
  const ex = scId ? c.scorecards.find(s => s.id === scId) : null;
  const fields = [...S.settings.scorecardFields]; if (ex) Object.keys(ex.fields || {}).forEach(f => { if (!fields.includes(f)) fields.push(f); });
  UI.modal = { type: 'scorecard', cid: c.id, scId: ex && ex.id, fields };
  const canMove = ['new', 'screen'].includes(c.stage) && !ex;
  openModal(`${ex ? 'Edit' : 'New'} scorecard: ${candName(c)}`, `<div class="grid2" style="grid-template-columns:1fr 1.2fr">
    <div class="stack"><label class="field">Paste your call notes (e.g. from Granola)<textarea class="input mono" id="sc-raw" rows="20" placeholder="Paste notes here, then click Auto-fill.\n\nThe best results come from a Granola template that uses the same headings as your scorecard. Copy it with the button below.">${esc(ex ? ex.raw || '' : '')}</textarea></label>
      <div class="row wrap"><button class="btn primary sm" data-act="scAuto">Auto-fill fields →</button><button class="btn sm" data-act="copyGranola">${icon('copy')} Copy Granola template</button></div></div>
    <div class="stack">${fields.map((f, i) => `<label class="field">${esc(f)}<textarea class="input" rows="${i === 0 ? 3 : 2}" data-scf="${esc(f)}">${esc(ex ? (ex.fields || {})[f] || '' : '')}</textarea></label>`).join('')}
      <div class="row wrap"><label class="field" style="flex:1">Recommendation<select class="input" id="sc-rec"><option value="">—</option>${RECS.map(r => `<option value="${r.id}" ${ex && ex.recommendation === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}</select></label>
       <label class="field" style="flex:1">Rating<select class="input" id="sc-rating"><option value="">—</option>${[4, 3, 2, 1].map(n => `<option value="${n}" ${ex && +ex.rating === n ? 'selected' : ''}>${n} – ${['', 'Weak', 'Mixed', 'Strong', 'Exceptional'][n]}</option>`).join('')}</select></label></div>
      ${canMove ? `<label class="chk"><input type="checkbox" id="sc-move" checked> Move to ${esc(stageLabel('hm_review'))} if recommendation is Yes or Strong yes</label>` : ''}</div></div>`,
    `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveSc">Save scorecard</button>`, true);
}

function openReject(ids) {
  UI.modal = { type: 'reject', ids };
  openModal(ids.length > 1 ? `Reject ${ids.length} candidates` : `Reject ${candName(getCand(ids[0]))}`, `<div class="stack"><label class="field">Reason<select class="input" id="rj-reason">${['Not a fit: experience', 'Not a fit: skills', 'Comp expectations', 'Location / work authorization', 'Candidate withdrew', 'No response', 'Position filled', 'HM declined', 'Other'].map(r => `<option>${r}</option>`).join('')}</select></label><label class="field">Note (optional)<input class="input" id="rj-note"></label>
   <div class="callout small">Remember to disposition them in Workday too. Workday is still where the official status and candidate emails live.</div></div>`,
    `<button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="saveReject">Reject</button>`);
}

function openAddCand() {
  if (!S.reqs.length) { toast('Add a req first (Reqs & HMs) or import from Workday', 'err'); UI.view = 'reqs'; render(); return; }
  UI.modal = { type: 'add' };
  const cur = UI.req !== 'all' ? UI.req : S.reqs[0].id;
  openModal('Add candidate', `<div class="grid2"><label class="field">Full name<input class="input" id="ad-name" autofocus></label><label class="field">Email<input class="input" id="ad-email" type="email"></label>
   <label class="field">Req<select class="input" id="ad-req">${S.reqs.filter(r => r.status !== 'closed').map(r => `<option value="${esc(r.id)}" ${r.id === cur ? 'selected' : ''}>${esc(reqLabel(r.id))}</option>`).join('')}</select></label>
   <label class="field">Stage<select class="input" id="ad-stage">${stageList().map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></label>
   <label class="field">Current title<input class="input" id="ad-title"></label><label class="field">Current company<input class="input" id="ad-co"></label>
   <label class="field">Location<input class="input" id="ad-loc"></label><label class="field">Source<input class="input" id="ad-src" value="Sourced"></label>
   <label class="field" style="grid-column:1/-1">LinkedIn or Workday link<input class="input" id="ad-url"></label></div>
   <p class="muted small">Sourced candidates still need to apply or be added in Workday so it stays the source of truth.</p>`,
    `<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveAdd">Add candidate</button>`);
}
