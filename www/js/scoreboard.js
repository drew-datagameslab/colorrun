"use strict";
/*
  Scoreboard Mode — digital companion for the printed Color Run scoresheet, for a home
  game of up to 20 players (any mix of humans and CPU fill-ins). Players physically roll
  the real dice; for each turn the device holder taps in the sets they collected (3+ of
  the same color+value — see the dice keypad below) and the app scores it with the same
  rules as User vs CPU's scoreDice()/bonusFor() (game.js), then banks it onto that
  player's running total immediately. Elimination reuses the same threshold rule as
  Single Play (threshVals()/applyThresh() from game.js): the round that crosses the
  threshold plays out, then starting the next round the lowest total is knocked out each
  round (two per round if the game started with more than six players) until one player
  remains.

  Turn order follows input order (Player 1, Player 2, ...), but isn't strict — the
  device holder can tap any player who hasn't gone yet this round to enter their roll
  out of turn (e.g. player 2 stepped away), and the app resumes normal order from there.
  Anyone the order passes over stays flagged "missing" — highlighted on their row and
  named in the round bar — until they're tapped and take their turn; the round can't
  advance while anyone is missing. See completeTurn()/missingIdxs() below for the exact
  rule.

  Unlocking: a code from the physical box (see redeem()). In guest/dev mode (no
  Firebase configured) the code CR-TEST-TEST always works so this mode is testable
  without a backend or real printed codes.
*/
const Scoreboard = (function(){
  const HISTORY_KEY = 'cr_sb_history';
  const ACTIVE_KEY = 'cr_sb_active';
  const DEV_CODE = 'CR-TEST-TEST';
  const MAX_PLAYERS = 20;
  // Fixed to the two colors printed in the physical box — unlike virtual play, a home
  // game's dice colors aren't a shop/equip preference, so this never reads Coins.
  const COLORS = ['blue', 'red'];

  let sbSetupCount = 4;
  let sbSlots = Array.from({ length: MAX_PLAYERS }, () => ({ name: '', type: 'human' }));
  let sbThreshTier = 'standard', sbCustomThresh = null, sbSetupThresh = 250;

  // Active session: {id,date,threshold,round,phase,elimPerRound,players:[{name,type,total,active,place}],
  //                   pending:[playerIdx...], currentIdx, maxPos}
  let SBG = null;
  // Current turn's manual dice entry — transient, not persisted (a resumed session
  // always starts its current player's entry from scratch).
  let SBTurn = { dice: [] };
  let sbUndoStack = [];
  let sbDieIdc = 1;

  // ---------- storage ----------
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }catch(e){ return []; } }
  function saveHistory(list){ try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }catch(e){} }
  function saveActive(){ try{ localStorage.setItem(ACTIVE_KEY, JSON.stringify(SBG)); }catch(e){} }
  function loadActive(){
    try{
      const raw = localStorage.getItem(ACTIVE_KEY); if(!raw) return null;
      const a = JSON.parse(raw);
      // A session saved by an older shape of this feature (before per-player type/
      // pending tracking existed) can't be resumed — drop it rather than crash.
      if(!a || !Array.isArray(a.players) || !a.players.length || typeof a.players[0].type === 'undefined'){
        localStorage.removeItem(ACTIVE_KEY); return null;
      }
      return a;
    }catch(e){ return null; }
  }
  function clearActive(){ try{ localStorage.removeItem(ACTIVE_KEY); }catch(e){} }

  // ---------- entry point from mode select ----------
  function enter(){
    const u = Auth.user;
    if(u && u.scoreboardUnlocked){ show('scoreboard-home'); refreshHome(); }
    else { $('scoreCodeInput').value = ''; show('scoreboard-code'); }
  }

  function redeem(){
    const code = $('scoreCodeInput').value.trim().toUpperCase();
    if(!code){ toast('Enter your code'); return; }
    if(FIREBASE_ENABLED){
      toast('Code redemption is wired for when your Firebase project is configured.');
      return;
    }
    if(code === DEV_CODE){
      Auth.patchUser({ scoreboardUnlocked: true });
      toast('Scoreboard Mode unlocked!');
      show('scoreboard-home'); refreshHome();
    } else {
      toast('That code was not recognized');
    }
  }

  // ---------- home ----------
  function refreshHome(){
    const list = $('sbSessionList'); list.innerHTML = '';
    const active = loadActive();
    if(active){
      const row = el('div', 'sb-session-item');
      row.innerHTML = '<div><div class="ssi-winner">Game in progress — Round ' + active.round + '</div>' +
        '<div class="ssi-date">' + active.players.length + ' players</div></div>';
      const btn = el('button', 'btn-cream'); btn.textContent = 'Resume'; btn.style.width = 'auto'; btn.style.padding = '10px 16px';
      btn.onclick = () => {
        SBG = active; SBTurn = { dice: [] }; sbUndoStack = [];
        show('scoreboard-session'); renderSession(); maybeAutoPlayCpu();
      };
      row.appendChild(btn);
      list.appendChild(row);
    }
    const hist = loadHistory().slice().reverse();
    if(hist.length === 0 && !active){
      const empty = el('div', 'desc'); empty.textContent = 'No games yet — start one below.'; list.appendChild(empty);
    }
    hist.forEach((s) => {
      const row = el('div', 'sb-session-item');
      row.innerHTML = '<div><div class="ssi-winner">🏆 ' + escapeHtml(s.winner.name) + ' — ' + s.winner.total + ' pts</div>' +
        '<div class="ssi-date">' + new Date(s.date).toLocaleDateString() + ' · ' + s.players.length + ' players</div></div>';
      list.appendChild(row);
    });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

  // ---------- new game setup ----------
  function resetSetup(){
    sbSetupCount = 4;
    sbSlots = Array.from({ length: MAX_PLAYERS }, () => ({ name: '', type: 'human' }));
    sbThreshTier = 'standard'; sbCustomThresh = null;
    $('sbPCount').textContent = sbSetupCount;
    applySbThresh();
    renderSbNames();
  }
  function pickSbBot(excludeIdx){
    const used = new Set();
    for(let i = 0; i < sbSetupCount; i++){ if(i !== excludeIdx && sbSlots[i].type === 'cpu' && sbSlots[i].name) used.add(sbSlots[i].name); }
    for(const n of BOTS) if(!used.has(n)) return n;
    return 'CPU ' + (10 + Math.floor(Math.random() * 89));
  }
  function renderSbNames(){
    const list = $('sbNameList'); list.innerHTML = '';
    for(let i = 0; i < sbSetupCount; i++){
      const s = sbSlots[i];
      const row = el('div', 'name-row');
      const chip = el('div', 'chip'); chip.style.background = AVCOL[i % AVCOL.length]; chip.textContent = i + 1;
      const inp = el('input'); inp.type = 'text'; inp.placeholder = 'Player ' + (i + 1); inp.maxLength = 14; inp.value = s.name;
      if(s.type === 'cpu'){ inp.readOnly = true; inp.classList.add('cpu-input'); }
      inp.oninput = () => { if(sbSlots[i].type === 'human') sbSlots[i].name = inp.value; };
      const tog = el('div', 'type-toggle' + (s.type === 'cpu' ? ' cpu' : '')); tog.textContent = s.type === 'cpu' ? '🤖 CPU' : '🧑 Human';
      tog.onclick = () => {
        sbSlots[i].type = sbSlots[i].type === 'cpu' ? 'human' : 'cpu';
        if(sbSlots[i].type === 'cpu' && !sbSlots[i].name) sbSlots[i].name = pickSbBot(i);
        else if(sbSlots[i].type === 'human') sbSlots[i].name = '';
        renderSbNames();
      };
      row.appendChild(chip); row.appendChild(inp); row.appendChild(tog);
      list.appendChild(row);
    }
  }
  function applySbThresh(){
    const v = threshVals();
    $('sbThSpeedLbl').textContent = v.speed + ' pts';
    $('sbThStdLbl').textContent = v.standard + ' pts';
    if(sbThreshTier === 'speed') sbSetupThresh = v.speed;
    else if(sbThreshTier === 'standard') sbSetupThresh = v.standard;
    else sbSetupThresh = sbCustomThresh || v.standard;
    $('sbThreshSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tier === sbThreshTier));
  }

  function startSession(){
    const players = [];
    for(let i = 0; i < sbSetupCount; i++){
      const s = sbSlots[i];
      const name = s.type === 'cpu' ? (s.name || pickSbBot(i)) : (s.name.trim() || ('Player ' + (i + 1)));
      players.push({ name, type: s.type, total: 0, active: true, place: null });
    }
    SBG = {
      id: 'sb_' + Date.now(),
      date: Date.now(),
      threshold: sbSetupThresh,
      round: 1,
      phase: 'regular',
      elimPerRound: players.length > 6 ? 2 : 1,
      players, pending: [], currentIdx: null, maxPos: -1
    };
    show('scoreboard-session');
    beginSbRound();
  }

  // ---------- turn order ----------
  // Active players' indices into SBG.players, in original input order — this is the
  // round's turn order; eliminated players simply drop out of it.
  function roundActiveIdxs(){ return SBG.players.map((p, i) => i).filter((i) => SBG.players[i].active); }

  function beginSbRound(){
    SBG.pending = roundActiveIdxs();
    SBG.maxPos = -1;
    SBG.currentIdx = SBG.pending.length ? SBG.pending[0] : null;
    SBTurn = { dice: [] }; sbUndoStack = [];
    saveActive();
    renderSession();
    maybeAutoPlayCpu();
  }

  // A pending player the order has already passed (someone later in this round's turn
  // order has completed a turn) without them rolling yet.
  function missingIdxs(){
    const order = roundActiveIdxs();
    return SBG.pending.filter((i) => order.indexOf(i) < SBG.maxPos);
  }

  function selectSbPlayer(idx){
    if(!SBG.pending.includes(idx)) return;
    if(SBG.players[idx].type === 'cpu') return;
    if(idx === SBG.currentIdx) return;
    SBG.currentIdx = idx;
    SBTurn = { dice: [] }; sbUndoStack = [];
    saveActive();
    renderSession();
  }

  // Banks whoever's currentIdx just finished, then resumes normal order: the next
  // pending player later than the one who just went (never wrapping back to someone
  // earlier who was skipped — they stay "missing" until manually tapped).
  function completeTurn(idx){
    SBG.pending = SBG.pending.filter((i) => i !== idx);
    const order = roundActiveIdxs();
    const p = order.indexOf(idx);
    if(p > SBG.maxPos) SBG.maxPos = p;
    SBTurn = { dice: [] }; sbUndoStack = [];
    let next = null;
    for(let k = p + 1; k < order.length; k++){ if(SBG.pending.includes(order[k])){ next = order[k]; break; } }
    SBG.currentIdx = next;
    saveActive();
    renderSession();
    maybeAutoPlayCpu();
  }

  // CPU fill-ins auto-play the instant it's their turn: a single simulated 12-dice roll
  // (6 of each box color), scored the same way a human's entry would be — no re-roll
  // strategy, just a fair snapshot, since CPUs here are seat-fillers, not opponents.
  //
  // A CPU can never be manually tapped to recover from "missing" (selectSbPlayer()
  // refuses CPU indices — there's no one at the table to hand the device to), so if the
  // normal forward search in completeTurn() ever lands on nobody (currentIdx null) while
  // a CPU is still pending, resolve that CPU here instead of stranding it — only a human
  // can be left waiting on a manual tap.
  function maybeAutoPlayCpu(){
    let idx = SBG.currentIdx;
    if(idx == null){
      const order = roundActiveIdxs();
      const cpuIdx = order.find((i) => SBG.pending.includes(i) && SBG.players[i].type === 'cpu');
      if(cpuIdx == null) return;
      SBG.currentIdx = idx = cpuIdx;
      renderSession();
    }
    if(SBG.players[idx].type !== 'cpu') return;
    renderSession();
    setTimeout(() => {
      if(SBG.currentIdx !== idx) return;
      const dice = []; let idc = 0;
      COLORS.forEach((color) => { for(let i = 0; i < 6; i++) dice.push({ id: idc++, color, value: 1 + Math.floor(Math.random() * 6) }); });
      const res = scoreDice(dice);
      SBG.players[idx].total += res.total;
      if(res.total) playSfx('add');
      completeTurn(idx);
    }, 700);
  }

  // ---------- dice entry (current turn) ----------
  function pipDieEl(color, value){
    const d = el('div', 'die pipdie ' + color);
    const face = el('div', 'pipface');
    (PIP[value] || []).forEach((idx) => {
      const p = el('span', 'pip');
      p.style.gridRow = Math.floor((idx - 1) / 3) + 1;
      p.style.gridColumn = ((idx - 1) % 3) + 1;
      face.appendChild(p);
    });
    d.appendChild(face);
    return d;
  }

  function sbAddDie(color, value){
    if(SBG.currentIdx == null || SBG.players[SBG.currentIdx].type === 'cpu') return;
    if(SBTurn.dice.filter((d) => d.color === color).length >= 6){ toast('All 6 ' + color + ' dice are already in play'); return; }
    const d = { id: sbDieIdc++, color, value };
    SBTurn.dice.push(d);
    sbUndoStack.push(d.id);
    renderSbEntry();
  }
  function sbRemoveDie(id){
    SBTurn.dice = SBTurn.dice.filter((d) => d.id !== id);
    sbUndoStack = sbUndoStack.filter((x) => x !== id);
    renderSbEntry();
  }
  function sbUndo(){
    const id = sbUndoStack.pop();
    if(id == null){ toast('Nothing to undo'); return; }
    SBTurn.dice = SBTurn.dice.filter((d) => d.id !== id);
    renderSbEntry();
  }
  function sbScoreTurn(){
    const idx = SBG.currentIdx; if(idx == null || SBG.players[idx].type === 'cpu') return;
    const res = scoreDice(SBTurn.dice);
    if(SBTurn.dice.length === 0 && !confirm('Score 0 points for ' + SBG.players[idx].name + '?')) return;
    SBG.players[idx].total += res.total;
    if(res.total) playSfx('add');
    completeTurn(idx);
  }

  // ---------- rendering ----------
  function renderSession(){
    const missing = missingIdxs();
    if(missing.length){
      const names = missing.map((i) => SBG.players[i].name);
      $('sbRoundLbl').textContent = names.join(' & ') + ' must roll to complete the round';
      $('sbRoundLbl').classList.add('sb-warn');
    } else {
      $('sbRoundLbl').textContent = (SBG.phase === 'elimination' ? 'Elimination · Round ' : 'Round ') + SBG.round;
      $('sbRoundLbl').classList.remove('sb-warn');
    }
    renderPlayerList(missing);
    renderSbEntry();
    const nrBtn = $('sbNextRoundBtn');
    nrBtn.disabled = SBG.pending.length > 0;
  }

  function renderPlayerList(missing){
    const wrap = $('sbPlayerList'); wrap.innerHTML = '';
    SBG.players.forEach((p, idx) => {
      const row = el('div', 'sb-standing' +
        (!p.active ? ' out' : '') +
        (idx === SBG.currentIdx ? ' cur' : '') +
        (missing.includes(idx) ? ' missing' : ''));
      row.innerHTML = '<span class="nm">' + (p.type === 'cpu' ? '🤖 ' : '') + escapeHtml(p.name) + (!p.active ? ' · OUT' : '') + '</span>' +
        '<span class="sc">' + p.total + '</span>';
      if(p.active && p.type !== 'cpu' && SBG.pending.includes(idx) && idx !== SBG.currentIdx){
        row.classList.add('tappable');
        row.onclick = () => selectSbPlayer(idx);
      }
      wrap.appendChild(row);
    });
  }

  function renderSbKeypad(enabled){
    const wrap = $('sbKeypad'); wrap.innerHTML = '';
    COLORS.forEach((color) => {
      const countColor = SBTurn.dice.filter((d) => d.color === color).length;
      for(let v = 1; v <= 6; v++){
        const cnt = SBTurn.dice.filter((d) => d.color === color && d.value === v).length;
        const full = countColor >= 6;
        const key = el('div', 'sb-key' + (!enabled ? ' disabled' : full ? ' full' : ''));
        key.appendChild(pipDieEl(color, v));
        if(cnt > 0){ const b = el('span', 'sb-key-count'); b.textContent = '×' + cnt; key.appendChild(b); }
        if(enabled && !full) key.onclick = () => sbAddDie(color, v);
        wrap.appendChild(key);
      }
    });
  }

  function renderSbEntry(){
    const idx = SBG.currentIdx;
    const who = $('sbEntryWho');
    const grid = $('sbSavedGrid'); grid.innerHTML = '';
    const scoreBtn = $('sbScoreBtn'), undoBtn = $('sbUndoBtn');

    if(idx == null){
      who.textContent = SBG.pending.length ? 'Tap a player below' : 'Round complete';
      scoreBtn.disabled = true; undoBtn.disabled = true;
      renderSbKeypad(false);
      return;
    }
    const p = SBG.players[idx];
    const cpuTurn = p.type === 'cpu';
    who.textContent = (cpuTurn ? '🤖 ' : '') + p.name;

    const res = scoreDice(SBTurn.dice);
    const sets = res.sets;
    const nRows = Math.max(1, sets.length);
    for(let r = 0; r < nRows; r++){
      const s = sets[r];
      const row = el('div', 'srow');
      let cols = 6;
      if(s){
        const dice = SBTurn.dice.filter((d) => d.value === s.value)
          .slice().sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color));
        cols = Math.max(6, dice.length);
        let i = 0;
        while(i < dice.length){
          let j = i; while(j < dice.length && dice[j].color === dice[i].color) j++;
          const group = dice.slice(i, j);
          if(group.length >= 3){
            const box = el('div', 'bonus-box'); box.style.gridColumn = 'span ' + group.length;
            box.appendChild(el('div', 'bonus-frame'));
            group.forEach((d) => { const de = pipDieEl(d.color, d.value); if(!cpuTurn) de.onclick = () => sbRemoveDie(d.id); box.appendChild(de); });
            row.appendChild(box);
          } else {
            group.forEach((d) => { const de = pipDieEl(d.color, d.value); if(!cpuTurn) de.onclick = () => sbRemoveDie(d.id); row.appendChild(de); });
          }
          i = j;
        }
        for(let k = 0; k < Math.max(0, cols - dice.length); k++) row.appendChild(el('div', 'slot'));
      } else {
        for(let k = 0; k < cols; k++) row.appendChild(el('div', 'slot'));
      }
      row.style.setProperty('--cols', cols);
      grid.appendChild(row);
    }

    scoreBtn.disabled = cpuTurn;
    scoreBtn.innerHTML = 'Score it!' + (res.total ? ('<span class="btn-sub"> - ' + res.total + '</span>') : '');
    undoBtn.disabled = cpuTurn || sbUndoStack.length === 0;
    renderSbKeypad(!cpuTurn);
  }

  // ---------- round resolution ----------
  function nextRound(){
    if(SBG.pending.length){ toast('Every player must complete this round first'); return; }

    const active = SBG.players.filter((p) => p.active);

    if(SBG.phase === 'elimination'){
      const sorted = active.slice().sort((a, b) => a.total - b.total);
      let toEliminate = sorted.slice(0, SBG.elimPerRound);
      if(toEliminate.length){
        // Pull in anyone else tied with the worst score in the cut, since a partial tie can't be broken digitally.
        const boundary = toEliminate[toEliminate.length - 1].total;
        toEliminate = sorted.filter((p) => p.total <= boundary);
      }
      const cap = active.length - 1; // never eliminate the last player standing
      if(toEliminate.length > cap) toEliminate = sorted.slice(0, cap);
      if(toEliminate.length > SBG.elimPerRound) toast(toEliminate.length + '-way tie for last — all are eliminated');
      toEliminate.forEach((p) => { p.active = false; p.place = active.length; });
    } else if(active.some((p) => p.total >= SBG.threshold)){
      SBG.phase = 'elimination';
    }

    const stillActive = SBG.players.filter((p) => p.active);
    if(stillActive.length <= 1){
      finishSession(stillActive[0] || SBG.players.slice().sort((a, b) => b.total - a.total)[0]);
      return;
    }

    SBG.round += 1;
    beginSbRound();
  }

  function finishSession(winner){
    const history = loadHistory();
    history.push({
      id: SBG.id, date: SBG.date, threshold: SBG.threshold,
      players: SBG.players.map((p) => ({ name: p.name, total: p.total })),
      winner: { name: winner.name, total: winner.total }
    });
    saveHistory(history);
    clearActive();
    $('sbWinName').textContent = winner.name;
    $('sbWinScore').textContent = winner.total + ' points';
    show('scoreboard-winner');
    playSfx('fanfare');
    SBG = null;
  }

  function endGameEarly(){
    if(!confirm('End this game? Progress will be lost.')) return;
    clearActive();
    SBG = null;
    show('scoreboard-home');
    refreshHome();
  }

  // ---------- wiring ----------
  function init(){
    $('scoreCodeSubmit').onclick = redeem;
    $('scoreCodeBack').onclick = () => show('modeselect');
    $('sbBackBtn').onclick = () => show('modeselect');
    $('sbNewGameBtn').onclick = () => { resetSetup(); show('scoreboard-setup'); };

    $('sbPMinus').onclick = () => { if(sbSetupCount > 2){ sbSetupCount--; $('sbPCount').textContent = sbSetupCount; renderSbNames(); } };
    $('sbPPlus').onclick = () => { if(sbSetupCount < MAX_PLAYERS){ sbSetupCount++; $('sbPCount').textContent = sbSetupCount; renderSbNames(); } };
    $('sbThreshSeg').querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        const tier = b.dataset.tier;
        if(tier === 'custom'){
          const v = prompt('Elimination starts at how many points?', sbSetupThresh);
          const n = parseInt(v, 10);
          if(!n || n < 20){ toast('Enter 20 or more'); return; }
          sbCustomThresh = n; sbThreshTier = 'custom'; $('sbThreshCustomLbl').textContent = n + ' pts';
        } else sbThreshTier = tier;
        applySbThresh();
      };
    });
    $('sbSetupBackBtn').onclick = () => show('scoreboard-home');
    $('sbStartBtn').onclick = startSession;

    $('sbNextRoundBtn').onclick = nextRound;
    $('sbScoreBtn').onclick = sbScoreTurn;
    $('sbUndoBtn').onclick = sbUndo;
    $('sbInfoBtn').onclick = openRules;
    $('sbEndGameBtn').onclick = endGameEarly;
    $('sbWinDoneBtn').onclick = () => { show('scoreboard-home'); refreshHome(); };
  }

  return { init, enter, refreshHome };
})();
