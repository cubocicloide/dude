// ---------------------------------------------------------------------------
// The single self-contained web page, inlined so tsup ships it with zero asset
// pipeline. The browser script uses DOM APIs + textContent only (never
// innerHTML for anything derived from command output or dude.json) and plain
// single-quoted string concatenation (no template literals) so nothing needs
// escaping against this outer template string beyond the odd '\\n'.
//
// The token is injected server-side and required on every /api/* call.
// ---------------------------------------------------------------------------

const STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: #0d1117; color: #c9d1d9; height: 100vh; overflow: hidden; }
  #app { height: 100vh; display: flex; flex-direction: column; }
  a { color: #58a6ff; }
  button { font: inherit; cursor: pointer; border-radius: 6px; }
  .btn { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 7px 14px; }
  .btn:hover { background: #30363d; }
  .btn.primary { background: #238636; border-color: #2ea043; color: #fff; font-weight: 600; }
  .btn.primary:hover { background: #2ea043; }
  .btn.primary:disabled { opacity: .5; cursor: default; }
  .btn.ghost { background: none; border-color: transparent; color: #8b949e; }
  .btn.ghost:hover { color: #c9d1d9; }
  .btn.danger { border-color: #6e2d2d; color: #f0a3a0; }
  .btn.danger:hover { background: #da3633; border-color: #da3633; color: #fff; }
  .btn.sm { padding: 3px 8px; font-size: 12px; }

  .topbar { display: flex; align-items: center; gap: 12px; padding: 10px 18px;
            border-bottom: 1px solid #21262d; background: #161b22; flex: none; }
  .topbar .logo { font-weight: 700; font-size: 17px; color: #58a6ff; letter-spacing: .5px; cursor: pointer; }
  .topbar .spacer { flex: 1; }
  .topbar .running { font-size: 12px; color: #d29922; }
  .topbar .running.idle { color: #6e7681; }

  .shell { flex: 1; display: flex; min-height: 0; }
  .rail { width: 250px; flex: none; border-right: 1px solid #21262d; background: #0f141a;
          display: flex; flex-direction: column; }
  .rail .head { padding: 12px 16px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #6e7681; }
  .rail .list { flex: 1; overflow-y: auto; }
  .rail .foot { border-top: 1px solid #21262d; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .prow { display: flex; align-items: center; gap: 9px; padding: 8px 16px; cursor: pointer; border-left: 3px solid transparent; }
  .prow:hover { background: #161b22; }
  .prow.active { background: #1f6feb18; border-left-color: #58a6ff; }
  .prow .dot { font-size: 10px; line-height: 1; }
  .prow .dot.running { color: #3fb950; }
  .prow .dot.stopped { color: #6e7681; }
  .prow .dot.missing { color: #f85149; }
  .prow .meta { min-width: 0; }
  .prow .nm { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prow .st { font-size: 11px; color: #58a6ff; font-family: ui-monospace, Menlo, monospace; }
  .prow .st.missing { color: #f85149; }

  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 40px; }
  .welcome h1 { margin: 0; font-size: 22px; }
  .welcome p { color: #8b949e; margin: 0 0 18px; }
  .doors { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
  .door { width: 240px; background: #161b22; border: 1px solid #21262d; border-radius: 10px; padding: 22px; cursor: pointer; }
  .door:hover { border-color: #388bfd; transform: translateY(-2px); transition: .15s; }
  .door .t { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
  .door .d { color: #8b949e; font-size: 13px; }

  .phead { display: flex; align-items: baseline; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #21262d; }
  .phead .nm { font-size: 18px; font-weight: 700; }
  .phead .st { font-size: 12px; color: #58a6ff; font-family: ui-monospace, Menlo, monospace; }
  .phead .pt { font-size: 11px; color: #6e7681; margin-left: auto; word-break: break-all; }

  .work { flex: 1; display: flex; min-height: 0; }
  .palette { width: 230px; flex: none; overflow-y: auto; border-right: 1px solid #21262d; padding: 6px 0; }
  .palette .section { padding: 12px 16px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #6e7681; }
  .palette .envpick { padding: 4px 16px 10px; }
  .palette .envpick label { font-size: 11px; color: #8b949e; display: block; margin-bottom: 3px; }
  .palette .envpick select { width: 100%; background: #010409; border: 1px solid #30363d; color: #c9d1d9; border-radius: 6px; padding: 5px 7px; }
  .palette button.cmd { display: block; width: 100%; text-align: left; border: 0; background: none; color: #c9d1d9; padding: 6px 16px; }
  .palette button.cmd:hover { background: #161b22; }
  .palette button.cmd.active { background: #1f6feb22; color: #58a6ff; box-shadow: inset 3px 0 0 #58a6ff; }
  .palette button.cmd small { display: block; color: #6e7681; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .pane { flex: 1; display: flex; flex-direction: column; min-width: 0; padding: 18px 20px; gap: 14px; overflow: hidden; }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid #21262d; }
  .tabs button { border: 0; background: none; color: #8b949e; padding: 6px 12px; border-bottom: 2px solid transparent; }
  .tabs button.active { color: #c9d1d9; border-bottom-color: #58a6ff; }
  .cmd-title { font-size: 18px; font-weight: 700; }
  .cmd-invoke { font-family: ui-monospace, Menlo, monospace; color: #58a6ff; font-size: 13px; }
  .cmd-desc { color: #8b949e; margin-top: 2px; }
  form.args { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field.bool { flex-direction: row; align-items: center; gap: 8px; }
  .field.wide { grid-column: 1 / -1; }
  .field label { font-size: 12px; color: #c9d1d9; }
  .field label .req { color: #f85149; }
  .field .hint { font-size: 11px; color: #6e7681; }
  .field input[type=text], .field select {
    background: #010409; border: 1px solid #30363d; color: #c9d1d9; border-radius: 6px; padding: 7px 9px; font: inherit; width: 100%; }
  .field input.bad { border-color: #f85149; }
  .actions { display: flex; gap: 10px; align-items: center; }
  .status { color: #8b949e; font-size: 12px; }
  .pill { font-size: 12px; padding: 2px 8px; border-radius: 20px; }
  .pill.run { background: #1f6feb22; color: #58a6ff; }
  .pill.ok { background: #23863622; color: #3fb950; }
  .pill.fail { background: #da363322; color: #f85149; }
  .pill.warn { background: #9e6a0322; color: #e3b341; }
  pre.out { flex: 1; margin: 0; overflow: auto; background: #010409; border: 1px solid #21262d; border-radius: 8px;
            padding: 12px; font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
  pre.out .meta { color: #6e7681; }
  .card { background: #12181f; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
  .card code { background: #010409; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Menlo, monospace; }
  .card.warn { background: #341a00; border-color: #9e6a03; color: #e3b341; }
  .hrow { display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-bottom: 1px solid #161b22; font-size: 13px; }
  .hrow .ha { flex: 1; font-family: ui-monospace, Menlo, monospace; color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hrow .ht { color: #6e7681; font-size: 12px; }

  .overlay { position: fixed; inset: 0; background: #0009; display: flex; align-items: center; justify-content: center; z-index: 20; }
  .modal { background: #161b22; border: 1px solid #30363d; border-radius: 12px; width: min(560px, 92vw); padding: 22px; }
  .modal h2 { margin: 0 0 16px; font-size: 17px; }
  .modal .actions { justify-content: flex-end; margin-top: 18px; }
  .modal .status { margin-right: auto; }
`

const CLIENT = `
(function () {
  var boot = window.__DUDE__ || {};
  var TOKEN = boot.token, HOME = boot.home || '';
  var app = document.getElementById('app');
  var rail, main, runningEl;

  var state = {
    projects: [], selected: null, catalog: null, view: 'home',
    runs: [], envs: {}, tab: 'console',
    stream: null,            // { runId, es }
    activeCmd: null
  };

  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function enc(s) { return encodeURIComponent(s); }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'x-dude-token': TOKEN }, opts.headers || {});
    if (opts.body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
    return fetch(path, opts).then(function (r) { return r.json(); });
  }

  // ── shell ──────────────────────────────────────────────────────────────────
  function buildShell() {
    clear(app);
    var bar = el('div', 'topbar');
    var logo = el('span', 'logo', 'dude'); logo.onclick = function () { state.view = 'home'; state.selected = null; render(); };
    runningEl = el('span', 'running idle', '');
    bar.appendChild(logo); bar.appendChild(el('span', 'spacer')); bar.appendChild(runningEl);
    app.appendChild(bar);
    var shell = el('div', 'shell');
    rail = el('div', 'rail'); main = el('div', 'main');
    shell.appendChild(rail); shell.appendChild(main); app.appendChild(shell);
  }

  function projStatus(p) {
    if (!p.exists) return 'missing';
    var running = state.runs.some(function (r) { return r.status === 'running' && r.cwd === p.path; });
    return running ? 'running' : 'stopped';
  }

  function renderRail() {
    clear(rail);
    rail.appendChild(el('div', 'head', 'Projects'));
    var list = el('div', 'list'); rail.appendChild(list);
    if (!state.projects.length) list.appendChild(el('div', 'head', 'none yet'));
    state.projects.forEach(function (p) {
      var st = projStatus(p);
      var row = el('div', 'prow' + (state.selected && state.selected.path === p.path ? ' active' : ''));
      row.appendChild(el('span', 'dot ' + st, st === 'running' ? '●' : st === 'missing' ? '⛔' : '○'));
      var meta = el('div', 'meta');
      meta.appendChild(el('div', 'nm', p.name));
      meta.appendChild(el('div', 'st' + (p.exists ? '' : ' missing'), p.exists ? (p.stack || '—') : 'missing on disk'));
      row.appendChild(meta);
      row.onclick = function () { selectProject(p); };
      list.appendChild(row);
    });
    var foot = el('div', 'foot');
    var nb = el('button', 'btn primary', '+  New project'); nb.onclick = function () { state.view = 'create'; state.selected = null; render(); };
    var ab = el('button', 'btn', 'Add existing'); ab.onclick = showAddExisting;
    foot.appendChild(nb); foot.appendChild(ab); rail.appendChild(foot);
  }

  function render() { renderRail(); renderMain(); }

  function renderMain() {
    clear(main);
    if (state.view === 'create') return renderCreate();
    if (state.selected) return renderProject();
    return renderWelcome();
  }

  function renderWelcome() {
    var w = el('div', 'welcome');
    if (!state.projects.length) {
      w.appendChild(el('h1', null, 'No projects yet'));
      w.appendChild(el('p', null, 'dude manages every project on this machine — terminal-free.'));
    } else {
      w.appendChild(el('h1', null, 'Pick a project'));
      w.appendChild(el('p', null, 'Choose one on the left, or start something new.'));
    }
    var doors = el('div', 'doors');
    var d1 = el('div', 'door'); d1.appendChild(el('div', 't', '⊕  Scaffold new'));
    d1.appendChild(el('div', 'd', 'Pick a stack, fill the form, go.'));
    d1.onclick = function () { state.view = 'create'; render(); };
    var d2 = el('div', 'door'); d2.appendChild(el('div', 't', '⊞  Add existing'));
    d2.appendChild(el('div', 'd', 'Point at a folder with a dude.json.'));
    d2.onclick = showAddExisting;
    doors.appendChild(d1); doors.appendChild(d2); w.appendChild(doors);
    main.appendChild(w);
  }

  // ── project workspace ────────────────────────────────────────────────────────
  function selectProject(p) {
    closeStream();
    state.selected = p; state.view = 'project'; state.catalog = null; state.activeCmd = null; state.tab = 'console';
    render();
    if (!p.exists) return;
    api('/api/catalog?project=' + enc(p.path)).then(function (cat) {
      state.catalog = cat;
      if (!state.envs[p.path]) loadEnvs(p.path);
      renderMain();
    });
  }

  function loadEnvs(pp) {
    api('/api/iac/envs?project=' + enc(pp)).then(function (d) {
      state.envs[pp] = { list: d.envs || [], sel: (d.envs || [])[0] || '' };
      if (state.selected && state.selected.path === pp) renderMain();
    });
  }

  function renderProject() {
    var p = state.selected;
    var head = el('div', 'phead');
    head.appendChild(el('span', 'nm', p.name));
    head.appendChild(el('span', 'st', p.stack || '—'));
    head.appendChild(el('span', 'pt', p.path));
    main.appendChild(head);

    if (!p.exists) {
      var mc = el('div', 'card warn');
      mc.appendChild(el('div', null, 'dude.json not found at this path — the folder may have moved or been deleted.'));
      var rm = el('button', 'btn danger sm', 'Remove from list'); rm.style.marginTop = '10px';
      rm.onclick = function () { api('/api/projects/remove', { method: 'POST', body: { path: p.path } }).then(function () { state.selected = null; state.view = 'home'; loadProjects().then(render); }); };
      mc.appendChild(rm);
      var wrap0 = el('div', 'pane'); wrap0.appendChild(mc); main.appendChild(wrap0); return;
    }

    var work = el('div', 'work');
    var palette = el('div', 'palette');
    var pane = el('div', 'pane');
    work.appendChild(palette); work.appendChild(pane); main.appendChild(work);

    if (!state.catalog) { pane.appendChild(el('div', 'status', 'Loading commands…')); return; }

    var ss = state.catalog.stackStatus;
    if (ss === 'needs-install' || ss === 'needs-build') { renderProvision(pane, ss); return; }

    renderPalette(palette, pane);
  }

  function renderProvision(pane, ss) {
    var c = el('div', 'card warn');
    if (ss === 'needs-install') {
      c.appendChild(el('div', null, 'This project\\'s toolchain isn\\'t installed yet.'));
      var hint = el('div'); hint.style.margin = '8px 0';
      hint.appendChild(document.createTextNode('Run ')); hint.appendChild(el('code', null, 'pnpm install')); hint.appendChild(document.createTextNode(' once in the project folder.'));
      c.appendChild(hint);
      var run = el('button', 'btn primary', 'Run pnpm install');
      var out = el('pre', 'out'); out.style.display = 'none'; out.style.marginTop = '12px';
      run.onclick = function () {
        run.disabled = true; out.style.display = '';
        api('/api/projects/provision', { method: 'POST', body: { path: state.selected.path } }).then(function (r) {
          if (r.error) { run.disabled = false; appendMeta(out, r.error); return; }
          openStream(r.runId, function (t) { appendLine(out, t); }, function (d) {
            run.disabled = false; appendMeta(out, '— exited with code ' + d.code);
            if (d.code === 0) selectProject(state.selected);
          });
        });
      };
      c.appendChild(run); c.appendChild(out);
    } else {
      c.appendChild(el('div', null, 'Stack not built yet (in-repo source checkout).'));
      var h2 = el('div'); h2.style.marginTop = '8px';
      h2.appendChild(document.createTextNode('Run ')); h2.appendChild(el('code', null, 'make build')); h2.appendChild(document.createTextNode(' in the monorepo, then reopen.'));
      c.appendChild(h2);
      var retry = el('button', 'btn', 'Retry'); retry.style.marginTop = '12px';
      retry.onclick = function () { selectProject(state.selected); };
      c.appendChild(retry);
    }
    pane.appendChild(c);
  }

  var CORE_HIDE = { init: 1, upgrade: 1, version: 1, help: 1, info: 1, report: 1, server: 1 };

  function renderPalette(palette, pane) {
    var cat = state.catalog;
    var groups = [];
    var flat = (cat.commands || []).filter(function (c) { return !CORE_HIDE[c.name]; }).map(function (c) { return { invoke: [c.name], cmd: c }; });
    if (flat.length) groups.push({ title: 'Commands', items: flat });
    (cat.groups || []).forEach(function (g) {
      groups.push({ title: g.name, iac: g.name === 'iac', items: (g.subcommands || []).map(function (s) { return { invoke: [g.name, s.name], cmd: s }; }) });
    });
    var proj = (cat.projectCommands || []).map(function (c) { return { invoke: [c.name], cmd: c }; });
    if (proj.length) groups.push({ title: 'Project (.dude/commands)', items: proj });

    if (!groups.length) { pane.appendChild(el('div', 'status', 'No commands for this project.')); return; }

    groups.forEach(function (g) {
      palette.appendChild(el('div', 'section', g.title));
      if (g.iac) palette.appendChild(envPicker());
      g.items.forEach(function (it) {
        var b = el('button', 'cmd');
        b.appendChild(el('span', null, it.invoke.join(' ')));
        if (it.cmd.description) b.appendChild(el('small', null, it.cmd.description));
        b.onclick = function () {
          Array.prototype.forEach.call(palette.querySelectorAll('button.cmd'), function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          state.activeCmd = it; state.tab = 'console'; renderPaneFor(it, pane);
        };
        palette.appendChild(b);
      });
    });
    var first = palette.querySelector('button.cmd'); if (first) first.click();
  }

  function envPicker() {
    var box = el('div', 'envpick');
    box.appendChild(el('label', null, 'Environment'));
    var sel = el('select');
    var e = state.envs[state.selected.path] || { list: [], sel: '' };
    if (!e.list.length) { var o = el('option', null, '(none — run iac bootstrap)'); o.value = ''; sel.appendChild(o); }
    e.list.forEach(function (name) { var o = el('option', null, name); o.value = name; if (name === e.sel) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { e.sel = sel.value; state.envs[state.selected.path] = e; };
    box.appendChild(sel);
    return box;
  }

  // ── command pane (console / history tabs) ────────────────────────────────────
  function renderPaneFor(it, pane) {
    clear(pane); closeStream();
    var tabs = el('div', 'tabs');
    var tc = el('button', state.tab === 'console' ? 'active' : '', 'Console');
    var th = el('button', state.tab === 'history' ? 'active' : '', 'History');
    tc.onclick = function () { state.tab = 'console'; renderPaneFor(it, pane); };
    th.onclick = function () { state.tab = 'history'; renderPaneFor(it, pane); };
    tabs.appendChild(tc); tabs.appendChild(th); pane.appendChild(tabs);
    var body = el('div'); body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;gap:14px;';
    pane.appendChild(body);
    if (state.tab === 'history') return renderHistory(body);
    renderConsole(it, body);
  }

  function renderConsole(it, body) {
    var cmd = it.cmd, flags = cmd.flags || {};
    body.appendChild(el('div', 'cmd-title', it.invoke.join(' ')));
    body.appendChild(el('div', 'cmd-invoke', 'dude ' + it.invoke.join(' ')));
    if (cmd.description) body.appendChild(el('div', 'cmd-desc', cmd.description));

    if (flags.interactive) {
      var card = el('div', 'card');
      card.appendChild(el('div', null, 'This command is interactive (a live terminal session) — run it in your terminal:'));
      var line = el('div'); line.style.marginTop = '8px';
      line.appendChild(el('code', null, 'cd ' + state.selected.path + ' && dude ' + it.invoke.join(' ')));
      card.appendChild(line); body.appendChild(card);
      return;
    }

    var inputs = {};
    var isIac = it.invoke[0] === 'iac';
    var args = (cmd.args || []).filter(function (a) { return !(isIac && a.name === 'env'); });
    if (args.length) {
      var form = el('form', 'args'); form.onsubmit = function (e) { e.preventDefault(); };
      args.forEach(function (a) {
        var field = el('div', 'field' + (a.type === 'boolean' ? ' bool' : ''));
        var input;
        if (a.type === 'boolean') {
          input = el('input'); input.type = 'checkbox'; if (a.default === true) input.checked = true;
          field.appendChild(input); field.appendChild(el('label', null, a.name));
        } else {
          var label = el('label');
          label.appendChild(document.createTextNode(a.name + (a.type === 'positional' ? ' (positional)' : '')));
          if (a.required) label.appendChild(el('span', 'req', ' *'));
          field.appendChild(label);
          var def = (a.default != null && a.default !== false) ? String(a.default) : '';
          if (a.options && a.options.length) {
            input = el('select');
            if (!a.required) { var b0 = el('option', null, '— none —'); b0.value = ''; input.appendChild(b0); }
            a.options.forEach(function (opt) { var o = el('option', null, opt); o.value = opt; input.appendChild(o); });
            if (def) input.value = def;
          } else {
            input = el('input'); input.type = 'text';
            if (def) input.value = def; else input.placeholder = a.required ? 'required' : 'optional';
          }
          field.appendChild(input);
        }
        if (a.description) field.appendChild(el('span', 'hint', a.description));
        inputs[a.name] = { el: input, meta: a };
        form.appendChild(field);
      });
      body.appendChild(form);
    }

    var actions = el('div', 'actions');
    var runBtn = el('button', 'btn primary', 'Run');
    var stopBtn = el('button', 'btn', 'Stop'); stopBtn.style.display = 'none';
    var pill = el('span', 'status', '');
    actions.appendChild(runBtn); actions.appendChild(stopBtn); actions.appendChild(pill);
    body.appendChild(actions);
    var out = el('pre', 'out'); body.appendChild(out);

    function setPill(cls, txt) { pill.className = cls ? 'pill ' + cls : 'status'; pill.textContent = txt; }
    function running(on) { runBtn.disabled = on; stopBtn.style.display = on ? '' : 'none'; }

    runBtn.onclick = function () {
      var pos = [], fl = [];
      Object.keys(inputs).forEach(function (n) {
        var rec = inputs[n], a = rec.meta;
        if (a.type === 'boolean') { if (rec.el.checked) fl.push('--' + n); }
        else { var v = rec.el.value.trim(); if (v) { if (a.type === 'positional') pos.push(v); else { fl.push('--' + n); fl.push(v); } } }
      });
      var argv = it.invoke.concat(pos, fl);
      var confirm = null;
      var env = '';
      if (isIac) {
        var e = state.envs[state.selected.path] || { sel: '' }; env = e.sel;
        if (env) { argv = argv.concat(['--env', env]); }
      }
      if (flags.destructive) {
        if (isIac) {
          if (!env) { setPill('warn', 'select an environment first'); return; }
          var typed = window.prompt('Destructive: dude ' + argv.join(' ') + '\\nType the env name "' + env + '" to confirm:');
          if (typed !== env) { setPill('warn', 'confirmation cancelled'); return; }
          confirm = env;
          if (hasYes(cmd)) argv = argv.concat(['--yes']);
        } else {
          if (!window.confirm('Run: dude ' + argv.join(' ') + '\\nThis may be destructive.')) return;
          if (hasYes(cmd)) argv = argv.concat(['--yes']);
        }
      }
      clear(out); appendMeta(out, '$ dude ' + argv.join(' ')); running(true);
      setPill(flags.follows ? 'run' : 'run', flags.follows ? '● streaming — still running' : 'running…');
      var body2 = { cwd: state.selected.path, argv: argv }; if (confirm != null) body2.confirm = confirm;
      api('/api/runs', { method: 'POST', body: body2 }).then(function (r) {
        if (r.error) { running(false); setPill('fail', r.error); return; }
        openStream(r.runId, function (t) { appendLine(out, t); }, function (d) {
          running(false);
          if (d.status === 'killed') setPill('warn', '⚠ stopped');
          else if (d.code === 0) setPill('ok', '✔ exit 0');
          else setPill('fail', '✘ exit ' + d.code);
          appendMeta(out, '— ' + (d.status === 'killed' ? 'stopped' : 'exited with code ' + d.code));
          refreshRuns();
        });
        refreshRuns();
      });
      stopBtn.onclick = function () { if (state.stream) api('/api/runs/' + enc(state.stream.runId) + '/kill', { method: 'POST' }); };
    };
  }

  function renderHistory(body) {
    var p = state.selected;
    var rows = state.runs.filter(function (r) { return r.cwd === p.path; }).sort(function (a, b) { return b.startedAt - a.startedAt; });
    if (!rows.length) { body.appendChild(el('div', 'status', 'No runs yet for this project.')); return; }
    var list = el('div'); list.style.overflow = 'auto';
    rows.forEach(function (r) {
      var row = el('div', 'hrow');
      var mark = r.status === 'running' ? '●' : r.status === 'killed' ? '⚠' : (r.exitCode === 0 ? '✔' : '✘');
      row.appendChild(el('span', null, mark));
      row.appendChild(el('span', 'ha', 'dude ' + r.argv.join(' ')));
      var when = r.status === 'running' ? 'running' : (r.exitCode === 0 ? 'exit 0' : 'exit ' + r.exitCode);
      row.appendChild(el('span', 'ht', when));
      var view = el('button', 'btn sm', 'view'); view.onclick = function () { viewRun(r); };
      row.appendChild(view);
      list.appendChild(row);
    });
    body.appendChild(list);
    var out = el('pre', 'out'); out.id = 'histout'; body.appendChild(out);
    function viewRun(r) {
      closeStream(); clear(out); appendMeta(out, '$ dude ' + r.argv.join(' '));
      openStream(r.id, function (t) { appendLine(out, t); }, function (d) { appendMeta(out, '— ' + (d.status === 'killed' ? 'stopped' : 'exit ' + d.code)); });
    }
  }

  function hasYes(cmd) { return (cmd.args || []).some(function (a) { return a.name === 'yes' && a.type === 'boolean'; }); }

  // ── streaming ────────────────────────────────────────────────────────────────
  function openStream(runId, onLine, onDone) {
    closeStream();
    var es = new EventSource('/api/runs/' + enc(runId) + '/stream?token=' + enc(TOKEN));
    state.stream = { runId: runId, es: es };
    es.addEventListener('out', function (ev) { onLine(JSON.parse(ev.data)); });
    es.addEventListener('done', function (ev) { var d = JSON.parse(ev.data); es.close(); if (state.stream && state.stream.es === es) state.stream = null; onDone(d); });
    es.onerror = function () { /* transient; browser auto-reconnects with Last-Event-ID */ };
  }
  function closeStream() { if (state.stream) { state.stream.es.close(); state.stream = null; } }

  function appendLine(out, text) { out.appendChild(document.createTextNode(text)); out.appendChild(document.createTextNode('\\n')); out.scrollTop = out.scrollHeight; }
  function appendMeta(out, text) { out.appendChild(el('span', 'meta', text + '\\n')); out.scrollTop = out.scrollHeight; }

  // ── create wizard ────────────────────────────────────────────────────────────
  function renderCreate() {
    var pane = el('div', 'pane');
    pane.appendChild(el('div', 'cmd-title', 'Scaffold a new project'));
    pane.appendChild(el('div', 'cmd-desc', 'Pick a stack; the form is generated from what the stack declares.'));
    var form = el('form', 'args'); form.onsubmit = function (e) { e.preventDefault(); }; pane.appendChild(form);

    var stackField = el('div', 'field'); stackField.appendChild(el('label', null, 'Stack'));
    var stackSel = el('select'); stackField.appendChild(stackSel); form.appendChild(stackField);
    var dirField = el('div', 'field'); dirField.appendChild(el('label', null, 'Target directory'));
    var dirInput = el('input'); dirInput.type = 'text'; dirField.appendChild(dirInput);
    dirField.appendChild(el('span', 'hint', 'Absolute path; the project folder is created here.'));
    form.appendChild(dirField);
    var dirTouched = false; dirInput.oninput = function () { dirTouched = true; };
    var varsHost = el('div', 'field wide'); var varsGrid = el('div', 'args'); varsHost.appendChild(varsGrid); form.appendChild(varsHost);

    var actions = el('div', 'actions');
    var status = el('span', 'status', '');
    var cancel = el('button', 'btn', 'Cancel'); cancel.onclick = function () { state.view = 'home'; render(); };
    var create = el('button', 'btn primary', 'Create project');
    actions.appendChild(create); actions.appendChild(cancel); actions.appendChild(status);
    pane.appendChild(actions);
    var out = el('pre', 'out'); out.style.display = 'none'; pane.appendChild(out);
    main.appendChild(pane);

    var varInputs = [];
    function suggestDir() {
      if (dirTouched) return;
      var nf = varInputs.filter(function (v) { return v.meta.name === 'projectName'; })[0];
      var nm = nf ? nf.el.value : 'my-app';
      dirInput.value = (HOME || '') + '/dude-projects/' + (nm || 'my-app');
    }
    function loadVars(stack) {
      clear(varsGrid); varInputs = [];
      api('/api/stack-variables?stack=' + enc(stack)).then(function (vars) {
        if (vars.error) { varsGrid.appendChild(el('span', 'hint', vars.error)); return; }
        (vars || []).forEach(function (v) { varInputs.push(buildVar(varsGrid, v, suggestDir)); });
        suggestDir();
      });
    }
    api('/api/stacks').then(function (d) {
      HOME = d.home || HOME;
      (d.stacks || []).forEach(function (s) { var o = el('option', null, s); o.value = s; stackSel.appendChild(o); });
      stackSel.onchange = function () { loadVars(stackSel.value); };
      if (stackSel.value) loadVars(stackSel.value);
    });

    create.onclick = function () {
      var stack = stackSel.value, dir = dirInput.value.trim();
      if (!stack || !dir) { status.textContent = 'stack and directory are required'; return; }
      var argv = ['init', '--stack', stack, '--yes'];
      varInputs.forEach(function (v) {
        var a = v.meta;
        if (a.type === 'boolean') { if (v.el.checked) argv.push('--' + a.name); }
        else { var val = v.el.value.trim(); if (val) { argv.push('--' + a.name); argv.push(val); } }
      });
      argv.push(dir);
      create.disabled = true; status.textContent = 'scaffolding…'; out.style.display = ''; clear(out);
      appendMeta(out, '$ dude ' + argv.join(' '));
      api('/api/runs', { method: 'POST', body: { cwd: HOME, argv: argv } }).then(function (r) {
        if (r.error) { create.disabled = false; status.textContent = r.error; return; }
        openStream(r.runId, function (t) { appendLine(out, t); }, function (d) {
          create.disabled = false;
          if (d.code === 0) {
            status.textContent = 'created';
            api('/api/projects/add', { method: 'POST', body: { path: dir } }).then(function () {
              loadProjects().then(function () {
                var base = dir.split('/').pop();
                var np = state.projects.filter(function (p) { return p.path === dir; })[0]
                       || state.projects.filter(function (p) { return p.path.split('/').pop() === base; })[0];
                state.view = 'project';
                if (np) selectProject(np); else render();
              });
            });
          } else { status.textContent = 'init failed (exit ' + d.code + ')'; }
        });
      });
    };
  }

  function buildVar(grid, v, onChange) {
    var field = el('div', 'field' + (v.type === 'boolean' ? ' bool' : ''));
    var input;
    if (v.type === 'boolean') {
      input = el('input'); input.type = 'checkbox'; if (v.default === true) input.checked = true;
      field.appendChild(input); field.appendChild(el('label', null, v.prompt || v.name));
    } else if (v.type === 'select') {
      field.appendChild(el('label', null, v.prompt || v.name));
      input = el('select'); (v.choices || []).forEach(function (c) { var o = el('option', null, c); o.value = c; input.appendChild(o); });
      if (v.default != null) input.value = String(v.default); field.appendChild(input);
    } else {
      field.appendChild(el('label', null, v.prompt || v.name));
      input = el('input'); input.type = 'text'; if (v.default != null) input.value = String(v.default);
      if (v.name === 'projectName' && onChange) input.oninput = onChange;
      field.appendChild(input);
      if (v.pattern) field.appendChild(el('span', 'hint', 'must match ' + v.pattern));
    }
    grid.appendChild(field);
    return { el: input, meta: v };
  }

  // ── add existing (modal) ─────────────────────────────────────────────────────
  function showAddExisting() {
    var overlay = el('div', 'overlay'); overlay.onclick = function (e) { if (e.target === overlay) document.body.removeChild(overlay); };
    var modal = el('div', 'modal'); overlay.appendChild(modal);
    modal.appendChild(el('h2', null, 'Add an existing project'));
    var field = el('div', 'field'); field.appendChild(el('label', null, 'Absolute path to a folder containing dude.json'));
    var input = el('input'); input.type = 'text'; input.placeholder = HOME + '/path/to/project'; field.appendChild(input);
    modal.appendChild(field);
    var actions = el('div', 'actions');
    var status = el('span', 'status', '');
    var cancel = el('button', 'btn', 'Cancel'); cancel.onclick = function () { document.body.removeChild(overlay); };
    var add = el('button', 'btn primary', 'Add');
    actions.appendChild(status); actions.appendChild(cancel); actions.appendChild(add); modal.appendChild(actions);
    add.onclick = function () {
      var pth = input.value.trim(); if (!pth) return; status.textContent = 'adding…';
      api('/api/projects/add', { method: 'POST', body: { path: pth } }).then(function (r) {
        if (r.error) { status.textContent = r.error; input.classList.add('bad'); return; }
        document.body.removeChild(overlay);
        loadProjects().then(function () { var np = state.projects.filter(function (p) { return p.path.indexOf(pth.split('/').pop()) !== -1; })[0]; render(); if (np) selectProject(np); });
      });
    };
    document.body.appendChild(overlay); input.focus();
  }

  // ── data ──────────────────────────────────────────────────────────────────────
  function loadProjects() { return api('/api/projects').then(function (d) { state.projects = d.projects || []; HOME = d.home || HOME; }); }
  function refreshRuns() {
    return api('/api/runs').then(function (d) {
      state.runs = d.runs || [];
      var n = state.runs.filter(function (r) { return r.status === 'running'; }).length;
      if (runningEl) { runningEl.textContent = n ? (n + ' running') : ''; runningEl.className = 'running' + (n ? '' : ' idle'); }
      renderRail();
    });
  }

  buildShell();
  loadProjects().then(function () { render(); refreshRuns(); });
  setInterval(refreshRuns, 3000);
})();
`

export function renderPage(token: string): string {
  const boot = JSON.stringify({ token })
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n' +
    '<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '<title>dude</title>\n<style>' +
    STYLES +
    '</style>\n</head>\n<body>\n<div id="app"></div>\n<script>window.__DUDE__ = ' +
    boot +
    ';</script>\n<script>' +
    CLIENT +
    '</script>\n</body>\n</html>\n'
  )
}
