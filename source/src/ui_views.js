/* ============================ reqs & HMs ============================ */
function viewReqs() {
  const counts = id => { const o = {}; S.candidates.filter(c => c.reqId === id).forEach(c => o[c.stage] = (o[c.stage] || 0) + 1); return o; };
  const hmOpts = sel => `<option value="">— Unassigned —</option>${S.hms.map(h => `<option value="${h.id}" ${h.id === sel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}`;
  return `<div class="page"><div class="panel"><div class="panel-head"><h2>Requisitions</h2><span class="muted small">Reqs are created automatically from your Workday imports. Assign each one an HM so review packets work.</span></div>
  <div style="overflow:auto"><table class="tbl"><thead><tr><th>Req ID</th><th>Title</th><th>Hiring manager</th><th>Booking link override</th><th>Status</th><th class="num">Active</th><th class="num">Screen</th><th class="num">HM review</th><th></th></tr></thead><tbody>
  ${S.reqs.map(r => { const n = counts(r.id); const act = S.candidates.filter(c => c.reqId === r.id && isActive(c)).length;
    return `<tr><td class="mono">${esc(r.id)}</td><td><input class="input flat" data-rf="title" data-rid="${esc(r.id)}" value="${esc(r.title || '')}"></td><td><select class="input sm" data-rf="hmId" data-rid="${esc(r.id)}">${hmOpts(r.hmId)}</select></td>
    <td><input class="input flat" data-rf="bookingLink" data-rid="${esc(r.id)}" value="${esc(r.bookingLink || '')}" placeholder="Uses your default"></td>
    <td><select class="input sm" data-rf="status" data-rid="${esc(r.id)}"><option value="open" ${r.status !== 'closed' ? 'selected' : ''}>Open</option><option value="closed" ${r.status === 'closed' ? 'selected' : ''}>Closed</option></select></td>
    <td class="num">${act}</td><td class="num">${n.screen || 0}</td><td class="num">${n.hm_review || 0}</td>
    <td class="row"><button class="btn sm" data-act="viewReq" data-rid="${esc(r.id)}">Pipeline</button>${S.candidates.some(c => c.reqId === r.id) ? '' : `<button class="btn sm ghost danger" data-act="delReq" data-rid="${esc(r.id)}" aria-label="Delete req">${icon('x')}</button>`}</td></tr>`; }).join('') || '<tr><td colspan="9" class="muted" style="padding:16px">No reqs yet. Import from Workday or add one below.</td></tr>'}
  </tbody></table></div>
  <div class="panel-body row wrap" style="border-top:1px solid var(--border)"><input class="input" id="nr-id" placeholder="Req ID (e.g. R-01234)" style="width:170px"><input class="input" id="nr-title" placeholder="Job title" style="width:260px"><select class="input" id="nr-hm">${hmOpts('')}</select><button class="btn" data-act="addReq">${icon('plus')} Add req</button></div></div>

  <div class="panel mt"><div class="panel-head"><h2>Hiring managers</h2><span class="muted small">Used for review packets and the "waiting on HM" report.</span></div>
  <table class="tbl"><thead><tr><th>Name</th><th>Email</th><th class="num">Open reqs</th><th class="num">Waiting on them</th><th></th></tr></thead><tbody>
  ${S.hms.map(h => { const reqs = S.reqs.filter(r => r.hmId === h.id && r.status !== 'closed'); const pend = S.candidates.filter(c => hmPending(c) && (getReq(c.reqId) || {}).hmId === h.id).length;
    return `<tr><td><input class="input flat" data-hf="name" data-hid="${h.id}" value="${esc(h.name)}"></td><td><input class="input flat" data-hf="email" data-hid="${h.id}" value="${esc(h.email || '')}" placeholder="name@company.com"></td><td class="num">${reqs.length}</td><td class="num">${pend}</td>
    <td class="row">${reqs.length ? `<button class="btn sm" data-act="hmStatus" data-hid="${h.id}">Status page</button>` : ''}${S.reqs.some(r => r.hmId === h.id) ? '' : `<button class="btn sm ghost danger" data-act="delHM" data-hid="${h.id}" aria-label="Delete">${icon('x')}</button>`}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted" style="padding:16px">No hiring managers yet.</td></tr>'}
  </tbody></table>
  <div class="panel-body row wrap" style="border-top:1px solid var(--border)"><input class="input" id="nh-name" placeholder="Name" style="width:200px"><input class="input" id="nh-email" placeholder="Email" style="width:240px"><button class="btn" data-act="addHM">${icon('plus')} Add hiring manager</button></div></div></div>`;
}

/* ============================ import ============================ */
function viewImport() {
  const imp = UI.imp; const step = imp ? imp.step : 1;
  const steps = ['Choose file', 'Map columns', 'Review changes', 'Done'];
  const bar = `<div class="steps">${steps.map((s, i) => `<span class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div>`;
  if (step === 1) return `<div class="page" style="max-width:900px">${bar}
    <label class="drop-zone" id="drop-zone"><input type="file" id="imp-file" accept=".csv,.xlsx,.xlsm,.txt,.tsv" data-act-change="impFile" hidden>
      <div style="font-size:15px;font-weight:600">Drop your Workday export here</div><div class="sec mt-s">or click to choose a file (.xlsx or .csv)</div></label>
    <div class="panel mt"><div class="panel-body"><h3>How to get the export from Workday</h3>
      <ol class="sec" style="margin:8px 0 0;padding-left:18px;line-height:1.7"><li>Open the report or grid you already use to review candidates (for example your <i>Job Requisition → Candidates</i> tab, or a saved report of all your open reqs).</li>
      <li>Click the <b>Export to Excel</b> icon in the top right of the grid. You don't need IT or an integration.</li><li>Drop the file above. The first time you'll confirm which column is which. After that it remembers.</li></ol>
      <p class="sec small" style="margin-top:10px">The best export includes <b>candidate name, email, job requisition, step/disposition</b>, and if possible the <b>candidate or application ID</b> (most reliable for matching). One report across all your reqs is ideal.<br>Re-import every morning. It shows you who's new, who moved in Workday, and who dropped off.</p></div></div>
    ${S.imports.length ? `<div class="panel mt"><div class="panel-head"><h3>Import history</h3></div><table class="tbl"><thead><tr><th>When</th><th>File</th><th class="num">Rows</th><th class="num">New</th><th class="num">Step changed</th><th class="num">Not in export</th></tr></thead><tbody>${S.imports.slice(0, 12).map(i => `<tr><td>${esc(fmtDateTime(i.at))}</td><td>${esc(i.fileName)}</td><td class="num">${i.counts.total}</td><td class="num">${i.counts.new}</td><td class="num">${i.counts.changed}</td><td class="num">${i.counts.missing}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
  if (step === 2) {
    const headers = (imp.rows[imp.headerRow] || []).map(h => String(h || '').trim());
    const sample = imp.rows.slice(imp.headerRow + 1, imp.headerRow + 4);
    const ex = k => { const i = headers.indexOf(imp.mapping[k]); return i < 0 ? '' : sample.map(r => r[i]).filter(Boolean).slice(0, 2).join(' · '); };
    const ok = imp.mapping.name || imp.mapping.firstName || imp.mapping.email;
    return `<div class="page" style="max-width:1000px">${bar}<div class="panel"><div class="panel-head"><div><h2>Match your columns</h2><div class="sec small">${esc(imp.fileName)} · ${plural(imp.rows.length - imp.headerRow - 1, 'data row')}</div></div><span class="spacer"></span>
      <label class="row small sec">Header is row <input class="input sm" type="number" min="1" max="${Math.min(imp.rows.length, 20)}" value="${imp.headerRow + 1}" data-act-change="impHeader" style="width:64px"></label></div>
      <table class="tbl"><thead><tr><th style="width:240px">Field</th><th style="width:300px">Column in your file</th><th>Example values</th></tr></thead><tbody>
      ${Parse.FIELDS.map(f => `<tr><td>${esc(f.label)}${['name', 'email', 'reqId'].includes(f.k) ? ' <span class="muted small">(recommended)</span>' : ''}</td><td><select class="input sm" data-act-change="impMap" data-k="${f.k}" style="width:100%"><option value="">— not in file —</option>${headers.filter(Boolean).map(h => `<option ${imp.mapping[f.k] === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></td><td class="sec small">${esc(ex(f.k))}</td></tr>`).join('')}
      </tbody></table>
      ${!imp.mapping.reqId ? `<div class="panel-body" style="border-top:1px solid var(--border)"><div class="callout warn">No requisition column found. Pick which req every row in this file belongs to.</div>
        <div class="row wrap mt-s"><select class="input" data-act-change="impAssign"><option value="">Choose req…</option>${S.reqs.map(r => `<option value="${esc(r.id)}" ${imp.assignReq === r.id ? 'selected' : ''}>${esc(reqLabel(r.id))}</option>`).join('')}<option value="__new" ${imp.assignReq === '__new' ? 'selected' : ''}>+ New req…</option></select>
        ${imp.assignReq === '__new' ? `<input class="input" id="imp-nr-id" placeholder="Req ID" value="${esc(imp.nrId || '')}"><input class="input" id="imp-nr-title" placeholder="Job title" value="${esc(imp.nrTitle || '')}">` : ''}</div></div>` : ''}
      <div class="modal-foot"><button class="btn" data-act="impBack">Back</button><span class="spacer"></span>${ok ? '' : '<span class="small" style="color:var(--bad)">Map a name or email column to continue</span>'}<button class="btn primary" data-act="impDiff" ${ok ? '' : 'disabled'}>Review changes →</button></div></div></div>`;
  }
  if (step === 3) {
    const d = imp.diff;
    return `<div class="page" style="max-width:1100px">${bar}<div class="diff-grid">
      <div class="stat"><div class="v">${d.newC.length}</div><div class="l">New candidates</div><div class="h">Not seen before</div></div>
      <div class="stat"><div class="v">${d.changed.length}</div><div class="l">Workday step changed</div><div class="h">Moved in Workday since last import</div></div>
      <div class="stat"><div class="v">${d.same.length}</div><div class="l">Unchanged</div><div class="h">Already up to date</div></div>
      <div class="stat"><div class="v">${d.missing.length}</div><div class="l">Not in this export</div><div class="h">Active here, missing from file</div></div></div>
      ${d.skipped ? `<div class="callout warn mt">${plural(d.skipped, 'row')} skipped (no name/email, or no req).</div>` : ''}
      ${d.newReqs.length ? `<div class="panel mt"><div class="panel-head"><h3>New reqs to create (${d.newReqs.length})</h3></div><div class="panel-body">${d.newReqs.map(r => `<span class="chip outline" style="margin:2px">${esc(r.id)}${r.title ? ' · ' + esc(r.title) : ''}${r.hm ? ' · HM: ' + esc(r.hm) : ''}</span>`).join('')}</div></div>` : ''}
      ${d.changed.length ? `<div class="panel mt"><div class="panel-head"><h3>Workday step changes</h3><span class="muted small">Tick to also move them in your pipeline.</span></div><table class="tbl"><thead><tr><th style="width:40px">Move</th><th>Candidate</th><th>Req</th><th>Workday step</th><th>Your stage → suggested</th></tr></thead><tbody>
        ${d.changed.map((x, i) => `<tr><td><input type="checkbox" data-act-change="impApply" data-i="${i}" ${x.apply ? 'checked' : ''} ${x.sug === x.c.stage ? 'disabled' : ''} aria-label="Apply"></td><td>${esc(candName(x.c))}</td><td>${esc(x.c.reqId)}</td><td><span class="muted">${esc(x.from || '—')}</span> → <b>${esc(x.to)}</b></td><td>${esc(stageLabel(x.c.stage))}${x.sug !== x.c.stage ? ' → <b>' + esc(stageLabel(x.sug)) + '</b>' : ' <span class="muted">(no change)</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${d.newC.length ? `<div class="panel mt"><div class="panel-head"><h3>New candidates (${d.newC.length})</h3></div><div style="max-height:320px;overflow:auto"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Req</th><th>Workday step</th><th>Starts in</th></tr></thead><tbody>
        ${d.newC.map(x => `<tr><td>${esc(x.r.name)}</td><td class="sec">${esc(x.r.email)}</td><td>${esc(x.r.reqId)}</td><td class="sec">${esc(x.r.workdayStep)}</td><td>${esc(stageLabel(x.stage))}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${d.missing.length ? `<div class="panel mt"><div class="panel-head"><h3>Not in this export (${d.missing.length})</h3><span class="spacer"></span><label class="chk small"><input type="checkbox" data-act-change="impArchive" ${d.archiveMissing ? 'checked' : ''}> Move them to Rejected</label></div><div class="panel-body sec small">${d.missing.map(c => esc(candName(c)) + ' (' + esc(c.reqId) + ')').join(', ')}<br><span class="muted">Left unticked, they're only flagged. Your export may simply be filtered.</span></div></div>` : ''}
      <div class="row mt"><button class="btn" data-act="impBackMap">Back</button><span class="spacer"></span><button class="btn primary" data-act="impApplyAll">Apply import</button></div></div>`;
  }
  const r = imp.result || {};
  return `<div class="page" style="max-width:800px">${bar}<div class="panel"><div class="panel-body"><h2>Import complete</h2><p class="sec">${plural(r.new || 0, 'new candidate')}, ${plural(r.changed || 0, 'step change')}, ${r.missing || 0} flagged as not in export${r.reqs ? `, ${plural(r.reqs, 'new req')}` : ''}.</p>
    ${r.reqs ? `<div class="callout mb">New reqs were created. Assign their hiring managers in <a href="#" data-act="nav" data-view="reqs">Reqs & HMs</a>.</div>` : ''}
    <div class="row"><button class="btn primary" data-act="nav" data-view="pipeline">Go to pipeline</button><button class="btn" data-act="impReset">Import another file</button></div></div></div></div>`;
}
async function handleImportFile(file) {
  if (!file) return;
  try {
    const rows = await Parse.file(file);
    if (!rows.length) throw new Error('The file looks empty.');
    const headerRow = Parse.detectHeader(rows); const headers = rows[headerRow].map(h => String(h || '').trim());
    let mapping = Parse.guessMapping(headers);
    if (S.mapping) { const saved = {}; Object.entries(S.mapping).forEach(([k, h]) => { if (headers.includes(h)) saved[k] = h; }); mapping = { ...mapping, ...saved }; }
    UI.imp = { step: 2, fileName: file.name, rows, headerRow, mapping, assignReq: '' }; render();
  } catch (e) { toast(e.message || String(e), 'err'); }
}
function normDate(v) {
  v = String(v || '').trim(); if (!v) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12).toISOString();
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(v); if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[1] - 1, +m[2], 12).toISOString(); }
  const t = Date.parse(v); return isNaN(t) ? v : new Date(t).toISOString();
}
function normalizeImport(imp) {
  const headers = imp.rows[imp.headerRow].map(h => String(h || '').trim()); const idx = {};
  Object.entries(imp.mapping).forEach(([k, h]) => { const i = headers.indexOf(h); if (h && i >= 0) idx[k] = i; });
  const out = new Map(); let skipped = 0;
  for (const r of imp.rows.slice(imp.headerRow + 1)) {
    const g = k => idx[k] !== undefined ? String(r[idx[k]] ?? '').trim() : '';
    let name = g('name'); const fn = g('firstName'), ln = g('lastName'); if (!name && (fn || ln)) name = `${fn} ${ln}`.trim();
    const sp = Parse.splitName(name); const email = g('email').toLowerCase();
    if (!name && !email) { skipped++; continue; }
    if (headers.includes(name) && name === imp.mapping.name) { continue; }
    let reqId = '', jobTitle = g('jobTitle');
    if (idx.reqId !== undefined) { const s = Parse.splitReq(g('reqId')); reqId = s.id; if (!jobTitle) jobTitle = s.title; }
    else reqId = imp.assignReq === '__new' ? (imp.nrId || '').trim() : imp.assignReq || '';
    if (!reqId) { skipped++; continue; }
    const wid = g('workdayId'); const rl = reqId.toLowerCase();
    const key = wid ? `wd:${wid.toLowerCase()}|${rl}` : email ? `em:${email}|${rl}` : `nm:${norm(sp.full)}|${rl}`;
    out.set(key, { key, name: sp.full || email, firstName: fn || sp.first, lastName: ln || sp.last, email, phone: g('phone'), reqId, jobTitle, currentTitle: g('currentTitle'), currentCompany: g('currentCompany'), location: g('location'), source: g('source'), appliedAt: normDate(g('appliedAt')), workdayStep: g('workdayStep'), workdayId: wid, workdayUrl: g('workdayUrl'), hiringManager: g('hiringManager') });
  }
  return { rows: [...out.values()], skipped };
}
function computeDiff(rows) {
  const byKey = new Map(S.candidates.map(c => [c.key, c]));
  const byEm = new Map(S.candidates.filter(c => c.email).map(c => [`${c.email.toLowerCase()}|${(c.reqId || '').toLowerCase()}`, c]));
  const byWd = new Map(S.candidates.filter(c => c.workdayId).map(c => [`${c.workdayId.toLowerCase()}|${(c.reqId || '').toLowerCase()}`, c]));
  const newC = [], changed = [], same = [], seen = new Set();
  rows.forEach(r => {
    const rl = r.reqId.toLowerCase();
    const c = byKey.get(r.key) || (r.workdayId && byWd.get(`${r.workdayId.toLowerCase()}|${rl}`)) || (r.email && byEm.get(`${r.email}|${rl}`));
    if (!c || seen.has(c.id)) { newC.push({ r, stage: guessStage(r.workdayStep) }); return; }
    seen.add(c.id);
    if (r.workdayStep && r.workdayStep !== (c.workdayStep || '')) {
      const sug = guessStage(r.workdayStep);
      const apply = c.stage !== 'rejected' && sug !== c.stage && (sug === 'rejected' || sug === 'hired' || stageIdx(sug) > stageIdx(c.stage));
      changed.push({ c, r, from: c.workdayStep || '', to: r.workdayStep, sug, apply });
    } else same.push({ c, r });
  });
  const reqsInFile = new Set(rows.map(r => r.reqId.toLowerCase()));
  const missing = S.candidates.filter(c => !seen.has(c.id) && c.origin !== 'manual' && reqsInFile.has((c.reqId || '').toLowerCase()) && isActive(c));
  const newReqs = []; const known = new Set(S.reqs.map(r => r.id.toLowerCase()));
  rows.forEach(r => { const rl = r.reqId.toLowerCase(); if (!known.has(rl)) { known.add(rl); newReqs.push({ id: r.reqId, title: r.jobTitle, hm: r.hiringManager }); } });
  return { newC, changed, same, missing, newReqs, archiveMissing: false };
}
function applyImport() {
  const imp = UI.imp, d = imp.diff, t = nowIso();
  const canon = id => (S.reqs.find(r => r.id.toLowerCase() === id.toLowerCase()) || {}).id || id;
  const findHM = name => { if (!name) return null; let hm = S.hms.find(h => norm(h.name) === norm(name)); if (!hm) { hm = { id: uid('hm_'), name, email: '' }; S.hms.push(hm); } return hm.id; };
  d.newReqs.forEach(nr => S.reqs.push({ id: nr.id, title: nr.title || (imp.assignReq === '__new' ? imp.nrTitle : '') || '', hmId: findHM(nr.hm), status: 'open', bookingLink: '', createdAt: t }));
  const fill = (c, r) => {
    ['email', 'phone', 'currentTitle', 'currentCompany', 'location', 'source', 'appliedAt', 'workdayId', 'firstName', 'lastName', 'name', 'jobTitle'].forEach(f => { if (!c[f] && r[f]) c[f] = r[f]; });
    if (r.workdayUrl) c.workdayUrl = r.workdayUrl; c.key = r.key; c.missingFromWorkday = false; c.lastSeenAt = t;
    const req = getReq(c.reqId); if (req) { if (!req.title && r.jobTitle) req.title = r.jobTitle; if (!req.hmId && r.hiringManager) req.hmId = findHM(r.hiringManager); }
  };
  d.newC.forEach(({ r, stage }) => {
    const { hiringManager, ...rest } = r;
    const c = { ...rest, id: uid('c_'), origin: 'workday', reqId: canon(r.reqId), stage, stageEnteredAt: t, createdAt: t, lastSeenAt: t, reached: { [stage]: t }, activity: [], notes: [], scorecards: [], tags: [] };
    log(c, 'import', `Imported from Workday${r.workdayStep ? ' (step: ' + r.workdayStep + ')' : ''}`); S.candidates.push(c);
  });
  d.changed.forEach(x => { const c = x.c; log(c, 'workday', `Workday step: ${x.from || '—'} → ${x.to}`); c.workdayStep = x.to; fill(c, x.r); if (x.apply) { setStage(c, x.sug, 'from Workday'); c.workdayStepChanged = false; } else c.workdayStepChanged = x.sug !== c.stage && c.stage !== 'rejected' && (x.sug === 'rejected' || stageIdx(x.sug) > stageIdx(c.stage)); });
  d.same.forEach(x => fill(x.c, x.r));
  d.missing.forEach(c => { if (!c.missingFromWorkday) log(c, 'workday', 'Not in latest Workday export'); c.missingFromWorkday = true; if (d.archiveMissing) setStage(c, 'rejected', 'not in Workday export'); });
  const counts = { total: imp.norm.rows.length, new: d.newC.length, changed: d.changed.length, missing: d.missing.length };
  S.imports.unshift({ at: t, fileName: imp.fileName, counts }); S.imports = S.imports.slice(0, 60);
  S.mapping = { ...imp.mapping }; save();
  imp.step = 4; imp.result = { ...counts, reqs: d.newReqs.length }; render();
}

/* ============================ HM reviews ============================ */
function viewReviews() {
  const inReview = S.candidates.filter(c => c.stage === 'hm_review');
  const byHM = new Map(); const noHM = [];
  inReview.forEach(c => { const hm = hmForCand(c); if (!hm) { noHM.push(c); return; } if (!byHM.has(hm.id)) byHM.set(hm.id, []); byHM.get(hm.id).push(c); });
  const decided = c => c.hmDecision && c.hmDecision.at >= (c.stageEnteredAt || '');
  const line = c => { const sc = latestScorecard(c); const rec = sc && RECS.find(r => r.id === sc.recommendation); const d = decided(c) && DECISIONS[c.hmDecision.decision];
    return `<div class="cand-line"><a href="#" data-act="open" data-id="${c.id}" style="font-weight:600">${esc(candName(c))}</a><span class="muted small">${esc(c.reqId)}</span>${rec ? `<span class="chip ${rec.cls}">Rec: ${rec.label}</span>` : '<span class="chip warn">No scorecard</span>'}${c.resume ? '' : '<span class="chip outline" title="No resume attached">No resume</span>'}<span class="spacer"></span>
    ${d ? `<span class="chip ${d.cls}">HM: ${d.label}</span>${d.label === 'Advance' ? `<button class="btn sm" data-act="moveOne" data-id="${c.id}" data-stage="hm_interview">Move to ${esc(stageLabel('hm_interview'))}</button>` : d.label === 'Decline' ? `<button class="btn sm" data-act="rejectOne" data-id="${c.id}">Reject</button>` : ''}`
      : c.sentToHmAt && c.sentToHmAt >= (c.stageEnteredAt || '') ? `<span class="chip outline">Sent ${relDays(c.sentToHmAt)}</span>` : '<span class="chip violet">Not sent yet</span>'}</div>`; };
  const hmCards = S.hms.filter(h => byHM.has(h.id)).map(h => { const list = byHM.get(h.id); const pending = list.filter(c => !decided(c)); const unsent = pending.filter(c => !(c.sentToHmAt && c.sentToHmAt >= (c.stageEnteredAt || '')));
    return `<div class="panel hm-card"><div class="panel-head"><div><h2>${esc(h.name)}</h2><div class="muted small">${plural(pending.length, 'candidate')} waiting on review${unsent.length ? ` · ${unsent.length} not sent yet` : ''}</div></div><span class="spacer"></span>
    <button class="btn" data-act="hmStatus" data-hid="${h.id}">${icon('chart')} Status page</button><button class="btn" data-act="hmTeams" data-hid="${h.id}">${icon('copy')} Copy as Teams message</button><button class="btn primary" data-act="hmPacket" data-hid="${h.id}" ${pending.length ? '' : 'disabled'}>${icon('send')} Create review packet (${pending.length})</button></div>
    <div class="panel-body" style="padding-top:4px;padding-bottom:4px">${list.map(line).join('')}</div></div>`; }).join('');
  return `<div class="page" style="max-width:1100px"><div class="grid2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>
    <div class="callout mb small"><b>How this works:</b> candidates you move to <b>${esc(stageLabel('hm_review'))}</b> show up here, grouped by hiring manager. <b>Create review packet</b> downloads one file. Send it to the HM in Teams. They open it in any browser, choose Advance, Hold or Decline, and click <i>Copy my reply</i>. Paste their reply on the right and every candidate updates.</div>
    ${hmCards || `<div class="panel"><div class="empty"><h2>Nothing waiting on HMs</h2><p>Move screened candidates to <b>${esc(stageLabel('hm_review'))}</b> to queue them for review.</p></div></div>`}
    ${noHM.length ? `<div class="panel hm-card"><div class="panel-head"><h2>No hiring manager assigned</h2><span class="spacer"></span><button class="btn" data-act="nav" data-view="reqs">Assign in Reqs & HMs</button></div><div class="panel-body">${noHM.map(line).join('')}</div></div>` : ''}</div>
   <div><div class="panel"><div class="panel-head"><h2>Paste an HM reply</h2></div><div class="panel-body stack"><textarea class="input mono" id="reply-text" rows="7" placeholder="Paste the HM's whole Teams message here. TalentDesk finds the reply code in it."></textarea><div class="row"><span class="spacer"></span><button class="btn primary" data-act="readReply">Read reply</button></div>
     ${UI.reply ? replyPreviewHTML() : ''}</div></div>
    <div class="panel mt"><div class="panel-head"><h3>Packets sent</h3></div><table class="tbl"><thead><tr><th>Sent</th><th>HM</th><th class="num">Cands</th><th>Reply</th></tr></thead><tbody>${S.packets.slice(0, 15).map(p => `<tr><td>${esc(fmtDate(p.at))}</td><td>${esc((getHM(p.hmId) || {}).name || '—')}</td><td class="num">${p.ids.length}</td><td>${p.repliedAt ? `<span class="chip good">${esc(fmtDate(p.repliedAt))}</span>` : `<span class="chip outline">Waiting ${relDays(p.at)}</span>`}</td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="padding:14px">None yet.</td></tr>'}</tbody></table></div></div></div></div>`;
}
function replyPreviewHTML() {
  const r = UI.reply; if (r.error) return `<div class="callout warn">${esc(r.error)}</div>`;
  return `<div class="stack"><div class="sec small">Reply from <b>${esc(r.hmName)}</b>, ${esc(fmtDateTime(r.at))}</div>${r.items.map(it => `<div class="cand-line"><span style="font-weight:600;flex:1">${esc(it.c ? candName(it.c) : 'Unknown candidate (deleted?)')}</span><span class="chip ${(DECISIONS[it.v] || {}).cls}">${(DECISIONS[it.v] || {}).label || it.v}</span></div>${it.m ? `<div class="small sec" style="margin:-4px 0 6px">“${esc(it.m)}”</div>` : ''}`).join('')}
   <label class="chk small"><input type="checkbox" id="reply-move" checked> Also move candidates: Advance → ${esc(stageLabel('hm_interview'))}, Decline → ${esc(stageLabel('rejected'))}</label>
   <div class="row"><button class="btn" data-act="replyCancel">Cancel</button><span class="spacer"></span><button class="btn primary" data-act="replyApply">Apply ${plural(r.items.filter(i => i.c).length, 'decision')}</button></div></div>`;
}
function parseReply(text) {
  const m = /TDR1\.([A-Za-z0-9_\-\s]+)/.exec(text || ''); if (!m) return { error: "Couldn't find a reply code. It starts with TDR1. Make sure the HM clicked “Copy my reply” in their packet." };
  let data; try { data = JSON.parse(b64urlDecode(m[1].replace(/\s+/g, ''))); } catch (e) { return { error: 'The reply code looks cut off or edited. Ask the HM to copy it again.' }; }
  const hm = getHM(data.h); const items = (data.d || []).map(([cid, v, msg]) => ({ cid, v, m: msg || '', c: getCand(cid) }));
  return { packetId: data.p, hmId: data.h, hmName: hm ? hm.name : (data.n || 'Hiring manager'), at: data.at, items };
}
function applyReply(move) {
  const r = UI.reply; let n = 0;
  r.items.forEach(it => { const c = it.c; if (!c || !DECISIONS[it.v]) return; n++;
    c.hmDecision = { decision: it.v, comment: it.m, at: r.at && r.at > (c.stageEnteredAt || '') ? r.at : nowIso(), hmId: r.hmId, packetId: r.packetId };
    log(c, 'hm', `${r.hmName}: ${DECISIONS[it.v].label}${it.m ? ' — ' + it.m : ''}`);
    if (move && c.stage === 'hm_review') { if (it.v === 'advance') setStage(c, 'hm_interview', 'HM advanced'); if (it.v === 'decline') { c.rejectReason = 'HM declined' + (it.m ? ': ' + it.m : ''); setStage(c, 'rejected', 'HM declined'); } }
  });
  const p = S.packets.find(x => x.id === r.packetId); if (p) p.repliedAt = nowIso();
  save(); UI.reply = null; toast(`Applied ${plural(n, 'decision')}`); render();
}
function hmTeamsText(hm, cands) {
  const lines = [`Hi ${hm.name.split(' ')[0]}, ${cands.length === 1 ? 'here is a candidate' : `here are ${cands.length} candidates`} for your review. Please reply with Advance / Hold / Decline for each.`, ''];
  cands.forEach((c, i) => { const sc = latestScorecard(c); lines.push(`${i + 1}. ` + (sc ? scorecardText(c, sc, 'teams') : `${candName(c)} (${c.reqId})${c.currentTitle ? ' · ' + c.currentTitle : ''}`)); lines.push(''); });
  return lines.join('\n').trim();
}
async function buildPacket(hm, cands, opts) {
  const files = {};
  if (opts.resumes) for (const c of cands) if (c.resume) { const d = await Store.Files.dataURL(c.resume); if (d) files[c.id] = { name: c.resume.name, type: c.resume.type, data: d }; }
  const payload = {
    id: uid('p_'), at: nowIso(), hm: { id: hm.id, name: hm.name }, recruiter: { name: S.settings.recruiterName, email: S.settings.recruiterEmail }, company: S.settings.company, note: opts.note || '',
    candidates: cands.map(c => { const sc = latestScorecard(c); const r = getReq(c.reqId);
      return { id: c.id, name: candName(c), reqId: c.reqId, jobTitle: (r && r.title) || c.jobTitle || '', currentTitle: c.currentTitle || '', currentCompany: c.currentCompany || '', location: c.location || '', source: c.source || '', workdayUrl: c.workdayUrl || '',
        rec: sc ? { label: (RECS.find(x => x.id === sc.recommendation) || {}).label || '', rating: sc.rating || '', fields: S.settings.scorecardFields.filter(f => (sc.fields || {})[f]).map(f => [f, sc.fields[f]]) } : null, resume: files[c.id] || null }; }),
  };
  const html = PACKET_TEMPLATE.replace('__TITLE__', esc(`Candidate review for ${hm.name}`)).replace('__PAYLOAD__', () => JSON.stringify(payload).replace(/</g, '\\u003c'));
  return { payload, html };
}

function statusNext(c) {
  const ss = screenStatus(c); const d = c.hmDecision && c.hmDecision.at >= (c.stageEnteredAt || '') ? DECISIONS[c.hmDecision.decision] : null;
  switch (c.stage) {
    case 'screen': return !ss ? '' : ss.k === 'todo' ? 'Recruiter reaching out' : ss.k === 'invited' ? 'Invited to recruiter screen' : ss.k === 'booked' ? 'Recruiter screen ' + fmtDateTime(c.bookedAt) : 'Screened, write-up coming to you';
    case 'hm_review': return hmPending(c) ? 'Your resume review' : d ? `You chose ${d.label}. Recruiter following up` : '';
    case 'hm_interview': return c.bookedAt && c.bookedAt > (c.stageEnteredAt || '') && Date.parse(c.bookedAt) > Date.now() ? 'Interview with you ' + fmtDateTime(c.bookedAt) : 'Interview with you (scheduling)';
    case 'panel': return 'Panel / onsite';
    case 'offer': return 'Offer in progress';
    case 'hired': return 'Hired';
    default: return '';
  }
}
function buildStatusPage(hm) {
  const reqs = S.reqs.filter(r => r.hmId === hm.id && r.status !== 'closed');
  const stages = stageList().filter(s => !['new', 'rejected'].includes(s.id));
  const payload = {
    at: nowIso(), hm: { name: hm.name }, recruiter: { name: S.settings.recruiterName }, company: S.settings.company,
    reqs: reqs.map(r => { const mine = S.candidates.filter(c => c.reqId === r.id);
      return { id: r.id, title: r.title, stages: stages.map(s => ({ id: s.id, label: s.label })),
        funnel: stageList().filter(s => s.id !== 'rejected').map(s => ({ label: s.label, n: mine.filter(c => c.stage === s.id).length })),
        closedCount: mine.filter(c => c.stage === 'rejected').length,
        cands: mine.filter(c => c.stage !== 'new' && c.stage !== 'rejected').map(c => { const sc = latestScorecard(c); const rec = sc && RECS.find(x => x.id === sc.recommendation); const d = c.hmDecision && DECISIONS[c.hmDecision.decision];
          return { name: candName(c), stageId: c.stage, current: [c.currentTitle, c.currentCompany].filter(Boolean).join(' @ '), location: c.location || '', days: daysInStage(c), rec: rec ? rec.label : '', recCls: rec ? rec.cls : '', decision: d ? d.label : '', decisionCls: d ? d.cls : '', waiting: hmPending(c), next: statusNext(c), closed: false }; }) }; }),
  };
  return STATUS_TEMPLATE.replace('__TITLE__', esc(`Hiring pipeline – ${hm.name}`)).replace('__PAYLOAD__', () => JSON.stringify(payload).replace(/</g, '\\u003c'));
}
function downloadStatus(hmId) {
  const hm = getHM(hmId); if (!hm) return;
  if (!S.reqs.some(r => r.hmId === hm.id && r.status !== 'closed')) return toast(`${hm.name} has no open reqs assigned`, 'err');
  const fname = `Pipeline status - ${hm.name} - ${new Date().toISOString().slice(0, 10)}.html`.replace(/[\\/:*?"<>|]/g, '');
  download(fname, buildStatusPage(hm), 'text/html');
  toast(`Status page downloaded. Send “${fname}” to ${hm.name.split(' ')[0]} in Teams.`);
}

/* ============================ reports ============================ */
function viewReports() {
  if (!S.candidates.length) return emptyState();
  const all = S.candidates.filter(c => UI.reportReq === 'all' ? (getReq(c.reqId) || {}).status !== 'closed' : c.reqId === UI.reportReq);
  const active = all.filter(isActive); const wk = Date.now() - 7 * DAY;
  const screens7 = all.filter(c => c.scorecards.some(s => Date.parse(s.at) >= wk)).length;
  const pend = all.filter(hmPending); const oldest = pend.reduce((m, c) => Math.max(m, daysSince(c.sentToHmAt || c.stageEnteredAt) || 0), 0);
  const stale = active.filter(isStale).sort((a, b) => daysInStage(b) - daysInStage(a));
  const funnel = stageList().filter(s => s.id !== 'rejected');
  const reached = s => all.filter(c => c.reached && c.reached[s.id] || c.stage === s.id).length;
  const rows = funnel.map((s, i) => ({ s, now: all.filter(c => c.stage === s.id).length, reached: reached(s), next: funnel[i + 1] ? reached(funnel[i + 1]) : null }));
  const max = Math.max(1, ...rows.map(r => r.reached));
  const noBook = active.filter(c => c.stage === 'screen' && c.inviteSentAt && !c.bookedAt && daysSince(c.inviteSentAt) >= 3);
  const sources = {}; all.forEach(c => { const k = c.source || 'Unknown'; const o = sources[k] = sources[k] || { n: 0, screen: 0, hm: 0, hired: 0 }; o.n++; if (c.reached.screen) o.screen++; if (c.reached.hm_interview) o.hm++; if (c.reached.hired) o.hired++; });
  const hmRows = S.hms.map(h => { const mine = all.filter(c => (getReq(c.reqId) || {}).hmId === h.id); const p = mine.filter(hmPending); const dec = mine.filter(c => c.hmDecision && Date.parse(c.hmDecision.at) >= Date.now() - 30 * DAY);
    return { h, pending: p.length, oldest: p.reduce((m, c) => Math.max(m, daysSince(c.sentToHmAt || c.stageEnteredAt) || 0), 0), decided: dec.length }; }).filter(r => r.pending || r.decided);
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  return `<div class="page"><div class="row mb"><select class="input" data-act-change="reportReq"><option value="all">All open reqs</option>${S.reqs.map(r => `<option value="${esc(r.id)}" ${UI.reportReq === r.id ? 'selected' : ''}>${esc(reqLabel(r.id))}</option>`).join('')}</select></div>
   <div class="grid4"><div class="stat"><div class="v">${active.length}</div><div class="l">Active candidates</div></div><div class="stat"><div class="v">${screens7}</div><div class="l">Screens done · last 7 days</div></div>
    <div class="stat"><div class="v">${pend.length}</div><div class="l">Waiting on HMs</div><div class="h">${pend.length ? 'Oldest ' + oldest + 'd' : 'All caught up'}</div></div><div class="stat"><div class="v">${stale.length}</div><div class="l">Stale (> ${S.settings.staleDays}d in stage)</div></div></div>
   <div class="panel mt"><div class="panel-head"><h2>Pipeline funnel</h2><span class="muted small">Reached = ever got to that stage. Conversion = share that went on to the next stage.</span></div><div class="panel-body">
    <div class="bars" role="table" aria-label="Pipeline funnel"><div class="hd" role="columnheader">Stage</div><div class="hd" role="columnheader">Reached</div><div class="hd num" role="columnheader">Reached</div><div class="hd num" role="columnheader">In stage now</div><div class="hd num" role="columnheader">→ next stage</div>
    ${rows.map(r => `<div role="cell">${esc(r.s.label)}</div><div role="cell"><div class="bar-track"><div class="bar" style="width:${r.reached / max * 100}%"></div><div class="bar-hit" data-tip="${esc(`${r.s.label}: ${r.reached} reached · ${r.now} in stage now${r.next !== null ? ' · ' + pct(r.next, r.reached) + ' moved on' : ''}`)}"></div></div></div><div class="num" role="cell">${r.reached}</div><div class="num sec" role="cell">${r.now}</div><div class="num sec" role="cell">${r.next !== null ? pct(r.next, r.reached) : ''}</div>`).join('')}</div>
    <div class="muted small mt-s">${all.filter(c => c.stage === 'rejected').length} rejected or withdrawn in this view.</div></div></div>
   <div class="grid2 mt" style="align-items:start">
    <div class="panel"><div class="panel-head"><h2>Needs attention</h2></div><div class="panel-body">
      <h3 class="mb">Stale in stage</h3>${stale.slice(0, 10).map(c => `<div class="cand-line"><a href="#" data-act="open" data-id="${c.id}">${esc(candName(c))}</a><span class="muted small">${esc(c.reqId)} · ${esc(stageLabel(c.stage))}</span><span class="spacer"></span><span class="chip warn">${daysInStage(c)}d</span></div>`).join('') || '<div class="muted small">Nothing stale. Nice.</div>'}
      <h3 class="mb mt">Invited, no booking after 3+ days</h3>${noBook.map(c => `<div class="cand-line"><a href="#" data-act="open" data-id="${c.id}">${esc(candName(c))}</a><span class="muted small">${esc(c.reqId)}</span><span class="spacer"></span><span class="chip outline">Invited ${relDays(c.inviteSentAt)}</span><button class="btn sm" data-act="emailOne" data-id="${c.id}" data-tpl="t_remind">Send reminder</button></div>`).join('') || '<div class="muted small">None.</div>'}</div></div>
    <div><div class="panel"><div class="panel-head"><h2>Hiring manager responsiveness</h2></div><table class="tbl"><thead><tr><th>HM</th><th class="num">Waiting</th><th class="num">Oldest</th><th class="num">Decided (30d)</th></tr></thead><tbody>${hmRows.map(r => `<tr><td>${esc(r.h.name)}</td><td class="num">${r.pending}</td><td class="num">${r.pending ? (r.oldest >= 3 ? `<span class="chip warn">${r.oldest}d</span>` : r.oldest + 'd') : '—'}</td><td class="num">${r.decided}</td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="padding:14px">No HM activity yet.</td></tr>'}</tbody></table></div>
     <div class="panel mt"><div class="panel-head"><h2>Sources</h2></div><table class="tbl"><thead><tr><th>Source</th><th class="num">Candidates</th><th class="num">Reached screen</th><th class="num">Reached HM interview</th><th class="num">Hired</th></tr></thead><tbody>${Object.entries(sources).sort((a, b) => b[1].n - a[1].n).map(([k, o]) => `<tr><td>${esc(k)}</td><td class="num">${o.n}</td><td class="num">${o.screen}</td><td class="num">${o.hm}</td><td class="num">${o.hired}</td></tr>`).join('')}</tbody></table></div></div></div></div>`;
}

/* ============================ settings ============================ */
function viewSettings() {
  setTimeout(() => { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(x => { const el = $('#storage-est'); if (el) el.textContent = `Using ${(x.usage / 1048576).toFixed(1)} MB of browser storage on this computer.`; }).catch(() => { }); });
  const s = S.settings; const bind = (k, ph = '', type = 'text') => `<input class="input" type="${type}" data-set="${k}" value="${esc(s[k] ?? '')}" placeholder="${esc(ph)}">`;
  return `<div class="page" style="max-width:980px">
  <div class="panel"><div class="panel-head"><h2>You</h2></div><div class="panel-body grid2">
   <label class="field">Your name${bind('recruiterName', 'Jane Recruiter')}</label><label class="field">Your email${bind('recruiterEmail', 'you@company.com', 'email')}</label>
   <label class="field">Company name (used in emails)${bind('company', 'Company')}</label><label class="field">Default booking link (Bookings, Calendly…)${bind('bookingLink', 'https://outlook.office.com/bookwithme/…')}</label>
   <label class="field" style="grid-column:1/-1">Email signature<textarea class="input" rows="3" data-set="signature" placeholder="Jane Recruiter&#10;Senior Technical Recruiter">${esc(s.signature || '')}</textarea></label>
   <label class="field">Flag as stale after (days in stage)${bind('staleDays', '5', 'number')}</label></div></div>
  <div class="panel mt"><div class="panel-head"><h2>Pipeline stages</h2><span class="muted small">Rename to match your process. The order is fixed.</span></div><div class="panel-body grid4">${s.stages.map((st, i) => `<label class="field">Stage ${i + 1}<input class="input" data-stage-label="${st.id}" value="${esc(st.label)}"></label>`).join('')}</div></div>
  <div class="panel mt"><div class="panel-head"><h2>Scorecard & Granola</h2><span class="spacer"></span><button class="btn" data-act="copyGranola">${icon('copy')} Copy Granola template</button></div><div class="panel-body grid2">
   <label class="field">Scorecard sections (one per line)<textarea class="input" rows="9" data-set-lines="scorecardFields">${esc(s.scorecardFields.join('\n'))}</textarea></label>
   <div class="sec small"><p style="margin-top:0"><b>Set up Granola once:</b> create a custom template in Granola called "Recruiter Screen" and paste in the template from the button above. The headings match your scorecard, so <i>Auto-fill</i> drops each section into the right field.</p><p>After the call, copy the Granola note → open the candidate → <b>+ Scorecard</b> → paste → Auto-fill → Save. Then <b>For Workday</b> copies a clean version for Workday's candidate notes.</p></div></div></div>
  <div class="panel mt"><div class="panel-head"><h2>Email templates</h2><span class="spacer"></span><button class="btn" data-act="addTpl">${icon('plus')} Add template</button></div><div class="panel-body stack">
   <div class="muted small">Placeholders: ${TEMPLATE_VARS.map(v => `<code>{{${v}}}</code>`).join(' ')}</div>
   ${S.templates.map(t => `<div class="sc"><div class="grid2" style="grid-template-columns:1fr 180px auto"><input class="input" data-tf="name" data-tid="${t.id}" value="${esc(t.name)}" aria-label="Template name"><select class="input" data-tf="kind" data-tid="${t.id}" aria-label="Type"><option value="invite" ${t.kind === 'invite' ? 'selected' : ''}>Screen invite (marks invited)</option><option value="reminder" ${t.kind === 'reminder' ? 'selected' : ''}>Reminder</option><option value="next" ${t.kind === 'next' ? 'selected' : ''}>Next round</option><option value="other" ${t.kind === 'other' ? 'selected' : ''}>Other</option></select><button class="btn ghost danger" data-act="delTpl" data-tid="${t.id}" aria-label="Delete template">${icon('x')}</button></div>
     <input class="input mt-s" style="width:100%" data-tf="subject" data-tid="${t.id}" value="${esc(t.subject)}" aria-label="Subject"><textarea class="input mt-s" rows="6" data-tf="body" data-tid="${t.id}" aria-label="Body">${esc(t.body)}</textarea></div>`).join('')}</div></div>
  <div class="panel mt"><div class="panel-head"><h2>Calendly sync (Google account)</h2>${S.settings.lastGoogleSync ? `<span class="muted small">Last synced ${esc(fmtDateTime(S.settings.lastGoogleSync))}</span>` : ''}</div><div class="panel-body stack">
   <p class="sec small" style="margin:0">Connect the Gmail account your Calendly is linked to. TalentDesk reads that account's <b>calendar events and Calendly emails</b> (read-only) and marks matching candidates as booked, rescheduled or canceled, matched by email address. Candidate data is never sent to Google, and the sign-in lasts until you close the app.</p>
   ${Google.available() ? '' : '<div class="callout warn small">This only works when TalentDesk is opened from its <b>web address</b> (GitHub Pages or a local web server, as described in the README), not when you double-click the file.</div>'}
   <div class="grid2"><label class="field">Google OAuth client ID<input class="input" data-set="googleClientId" value="${esc(s.googleClientId || '')}" placeholder="1234567890-abc….apps.googleusercontent.com"></label><label class="field">Scheduling Gmail address<input class="input" data-set="googleAccount" value="${esc(s.googleAccount || '')}" placeholder="team.interviews@gmail.com"></label></div>
   <div class="row"><button class="btn" data-act="gSync" ${Google.available() ? '' : 'disabled'}>${icon('calendar')} Sync now</button><span class="muted small">One-time setup: create the client ID in Google Cloud (steps in the README).</span></div></div></div>
  <div class="panel mt"><div class="panel-head"><h2>Data & backup</h2></div><div class="panel-body stack">
   ${storageCardHTML()}
   <div class="section-t" style="margin-top:6px">Manual backup & export</div>
   <div class="row wrap"><button class="btn" data-act="backup">${icon('download')} Export backup</button><label class="btn">${icon('upload')} Restore from backup<input type="file" accept=".json" data-act-change="restore" hidden></label><button class="btn" data-act="exportCsv">${icon('download')} Export candidates CSV</button>
    <label class="chk small" style="margin-left:8px"><input type="checkbox" data-set-bool="includeResumes" ${s.includeResumes ? 'checked' : ''}> Include resumes in HM packets</label><span class="spacer"></span><button class="btn" data-act="loadDemo">Load demo data</button><button class="btn danger" data-act="wipe">Delete all data</button></div>
   <div class="muted small" id="storage-est"></div></div></div></div>`;
}
function storageCardHTML() {
  const st = Store.status;
  if (st === 'ready') return `<div class="callout small"><b>📁 Saving to folder “${esc(Store.folderName)}”.</b> Every change is written to <span class="mono">${DATA_FILE}</span> in that folder, resumes go in <span class="mono">resumes/</span>, and a daily snapshot is kept in <span class="mono">backups/</span> (last 14 days). If the folder is in OneDrive, open TalentDesk on any computer in Edge or Chrome, choose the same folder, and your data is there.<br>Only one window can edit at a time. Others open read-only.</div>
   <div class="row wrap"><button class="btn" data-act="connectFolder">Change folder…</button><button class="btn ghost danger" data-act="disconnectFolder">Stop saving to folder</button><span class="muted small">${Store.lastSavedAt ? 'Last saved ' + esc(fmtDateTime(Store.lastSavedAt)) : ''}</span></div>`;
  if (st === 'unsupported') return `<div class="callout warn small">Your data is only stored <b>in this browser</b>. To save it to a OneDrive folder so it works across browsers and computers, open TalentDesk in <b>Microsoft Edge or Google Chrome</b>. Until then, export a backup regularly.</div>`;
  return `<div class="callout warn small"><b>Your data is only stored in this browser right now.</b> Clearing browser data or switching browsers would start you over.<br><b>Fix it once:</b> create a folder called <b>TalentDesk</b> inside your OneDrive, then click below and choose it. Everything (including resumes) moves there, gets daily backups, and follows you to any computer.</div>
   <div class="row"><button class="btn primary" data-act="connectFolder">📁 Choose data folder…</button></div>`;
}
function exportCsv() {
  const cols = ['Name', 'Email', 'Phone', 'Req ID', 'Job title', 'Stage', 'Days in stage', 'Screen status', 'Recruiter rec', 'HM decision', 'HM comment', 'Workday step', 'Source', 'Applied', 'Current title', 'Current company', 'Location', 'Tags', 'Last activity'];
  const q = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = S.candidates.map(c => { const r = getReq(c.reqId); const sc = latestScorecard(c); return [candName(c), c.email, c.phone, c.reqId, (r && r.title) || c.jobTitle, stageLabel(c.stage), isActive(c) ? daysInStage(c) : '', (screenStatus(c) || {}).t || '', sc ? (RECS.find(x => x.id === sc.recommendation) || {}).label || '' : '', c.hmDecision ? DECISIONS[c.hmDecision.decision].label : '', c.hmDecision ? c.hmDecision.comment : '', c.workdayStep, c.source, fmtDate(c.appliedAt), c.currentTitle, c.currentCompany, c.location, (c.tags || []).join('; '), c.activity[0] ? fmtDateTime(c.activity[0].at) + ' ' + c.activity[0].text : '']; });
  download(`talentdesk-candidates-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [cols, ...rows].map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
}
async function exportBackup() {
  const files = await Store.Files.all();
  download(`talentdesk-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'talentdesk', version: 1, exportedAt: nowIso(), state: S, files }), 'application/json');
  S.lastBackupAt = nowIso(); save(); renderNav(); toast('Backup downloaded. Keep it somewhere safe, like your OneDrive.');
}
async function restoreBackup(file) {
  try {
    const data = JSON.parse(await readFile(file, 'readAsText'));
    if (data.app !== 'talentdesk' || !data.state) throw new Error("That file isn't a TalentDesk backup.");
    if (!(await confirmBox(`Replace everything with the backup from <b>${esc(fmtDateTime(data.exportedAt))}</b> (${plural((data.state.candidates || []).length, 'candidate')})? Your current data will be overwritten.`, 'Restore', true))) return;
    if (Store.status === 'ready') await Store.snapshot('before-restore');
    await Store.Files.clear(); const metas = {}; (data.state.candidates || []).forEach(c => { if (c.resume) metas[c.resume.id] = c.resume; });
    for (const [k, v] of Object.entries(data.files || {})) { if (v && v.data) await Store.Files.put(metas[k] || { id: k, name: v.name, type: v.type }, dataURLtoBlob(v.data)).catch(() => { }); }
    S = migrate(data.state); S.updatedAt = nowIso(); await Store.persistNow(); await Store.flushFile(true); UI.drawer = null; UI.sel.clear(); toast('Backup restored'); render();
  } catch (e) { toast(e.message, 'err'); }
}

/* ============================ demo data ============================ */
function loadDemo() {
  const t0 = Date.now(); const ago = d => new Date(t0 - d * DAY - Math.random() * DAY * .5).toISOString();
  const hms = [{ id: 'hm_demo1', name: 'Priya Natarajan', email: 'priya.n@example.com' }, { id: 'hm_demo2', name: 'Marcus Chen', email: 'marcus.c@example.com' }, { id: 'hm_demo3', name: 'Dana Okafor', email: 'dana.o@example.com' }];
  hms.forEach(h => { const ex = S.hms.find(x => norm(x.name) === norm(h.name)); if (ex) h.id = ex.id; });
  const reqs = [{ id: 'R-10421', title: 'Senior Hardware Validation Engineer', hmId: hms[0].id }, { id: 'R-10433', title: 'Rack Integration Technician II', hmId: hms[1].id }, { id: 'R-10458', title: 'Supply Chain Program Manager', hmId: hms[2].id }].map(r => ({ ...r, status: 'open', bookingLink: '', createdAt: ago(30) }));
  const first = ['Avery', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Taylor', 'Casey', 'Jamie', 'Quinn', 'Drew', 'Alex', 'Reese', 'Rowan', 'Hayden', 'Parker', 'Emerson', 'Skyler', 'Kendall', 'Logan', 'Cameron', 'Blake', 'Sage', 'Elliot', 'Finley', 'Harper', 'Jules', 'Kai', 'Lane'];
  const last = ['Alvarez', 'Brooks', 'Chowdhury', 'Dubois', 'Edwards', 'Fischer', 'Garcia', 'Huang', 'Ibrahim', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreno', 'Nakamura', 'Osei', 'Patel', 'Quintero', 'Rossi', 'Schmidt', 'Tanaka', 'Usman', 'Vargas', 'Walsh', 'Xu', 'Yilmaz', 'Zhou', 'Banerjee', 'Costa'];
  const titles = [['Hardware Test Engineer', 'Celestica'], ['Validation Engineer', 'Jabil'], ['Systems Engineer', 'Supermicro'], ['Field Technician', 'Dell'], ['Rack Technician', 'Flex'], ['Program Manager', 'Foxconn'], ['Supply Chain Analyst', 'HPE'], ['Test Technician', 'Wiwynn']];
  const sources = ['Workday – Careers site', 'LinkedIn', 'Referral', 'Indeed', 'Agency'];
  const plan = ['new', 'new', 'new', 'new', 'new', 'screen', 'screen', 'screen', 'screen', 'screen', 'screen', 'hm_review', 'hm_review', 'hm_review', 'hm_review', 'hm_interview', 'hm_interview', 'hm_interview', 'panel', 'panel', 'offer', 'hired', 'rejected', 'rejected', 'rejected', 'new', 'screen', 'hm_review'];
  const order = stageList().map(s => s.id);
  const cands = plan.map((stage, i) => {
    const req = reqs[i % 3]; const tt = titles[(i * 3) % titles.length]; const fn = first[i], ln = last[i]; const entered = ago(stage === 'new' ? i % 3 : 1 + (i * 7) % 9);
    const c = { id: uid('c_'), key: `demo:${i}`, origin: 'workday', name: `${fn} ${ln}`, firstName: fn, lastName: ln, email: `${fn}.${ln}@example.com`.toLowerCase(), phone: `(555) 01${String(i).padStart(2, '0')}-${1000 + i * 37}`, reqId: req.id, jobTitle: req.title,
      currentTitle: tt[0], currentCompany: tt[1], location: ['San Jose, CA', 'Austin, TX', 'Houston, TX', 'Remote – US', 'Secaucus, NJ'][i % 5], source: sources[i % 5], appliedAt: ago(14 + i % 10),
      workdayStep: { new: 'Review', screen: 'Screen', hm_review: 'Screen', hm_interview: 'Interview', panel: 'Interview', offer: 'Offer', hired: 'Ready for Hire', rejected: 'Declined' }[stage], workdayId: 'C' + (200300 + i),
      stage, stageEnteredAt: entered, createdAt: ago(14 + i % 10), reached: {}, activity: [], notes: [], scorecards: [], tags: i % 7 === 0 ? ['referral'] : [] };
    const si = order.indexOf(stage === 'rejected' ? 'screen' : stage); order.slice(0, si + 1).forEach((s, k) => { c.reached[s] = ago(14 - k * 2); });
    if (stage === 'rejected') { c.reached.rejected = entered; c.rejectReason = ['Comp expectations', 'Candidate withdrew', 'Not a fit: experience'][i % 3]; }
    log(c, 'import', 'Imported from Workday (demo data)');
    if (stage === 'screen') { if (i % 3 !== 0) c.inviteSentAt = ago(i % 5); if (i % 3 === 2) c.bookedAt = new Date(t0 + (1 + i % 3) * DAY).toISOString(); }
    if (['hm_review', 'hm_interview', 'panel', 'offer', 'hired'].includes(stage) || (stage === 'screen' && i === 26)) {
      c.inviteSentAt = ago(10); c.bookedAt = ago(7);
      c.scorecards.push({ id: uid('sc_'), at: ago(6), rating: 3 + (i % 2), recommendation: i % 2 ? 'strong_yes' : 'yes', raw: '', fields: { 'Summary': `${tt[0]} at ${tt[1]} with ${4 + i % 6} years in server hardware. Clear communicator, owned bring-up for two platform launches.`, 'Experience match': 'Strong on validation test plans and rack-level debug; lighter on liquid cooling.', 'Why they are looking': 'Wants larger-scale AI infrastructure work.', 'Comp expectations': `$${120 + i * 3}k–$${135 + i * 3}k base`, 'Location / work authorization': 'Local, no sponsorship needed', 'Notice period / availability': '2 weeks', 'Concerns': i % 3 ? 'None major' : 'Has a competing offer and will decide within 2 weeks' } });
    }
    if (stage === 'hm_review') { if (i % 2) c.sentToHmAt = ago(2); if (i === 13) { c.hmDecision = { decision: 'advance', comment: 'Strong validation background. Let\'s do a 45-min tech screen.', at: ago(0), hmId: req.hmId }; } }
    return c;
  });
  S.hms = [...S.hms.filter(h => !hms.some(x => x.id === h.id)), ...hms]; S.reqs = [...S.reqs.filter(r => !reqs.some(x => x.id === r.id)), ...reqs];
  S.candidates = [...S.candidates.filter(c => !String(c.key || '').startsWith('demo:')), ...cands];
  if (!S.settings.recruiterName) S.settings.recruiterName = 'Your Name'; if (!S.settings.company) S.settings.company = 'Your Company';
  save(); UI.view = 'pipeline'; render(); toast('Demo data loaded. Delete it any time from Settings.');
}
