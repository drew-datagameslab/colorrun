"use strict";
const ModeSelect = (function(){
  function refresh(){
    renderAccountHeader('ms');
    const statsBtn = $('modeStatsBtn');
    if(statsBtn) statsBtn.style.display = Stats.isEligible() ? '' : 'none';
  }

  async function startSinglePlay(){
    await Ads.showInterstitial();
    PickGame.enter();
  }

  // Will route to the same Pick Your Game-style screen/buy-in flow once real online
  // rooms exist — no backend yet, so still just the placeholder.
  function startMultiplayer(){
    toast('Multiplayer Play is coming soon');
  }

  // Pass-and-play with up to 8 humans on one device — free, no buy-in and no coin
  // payout (isDeviceUser stays false so game.js's economy checks skip this player).
  function startChallenge(){
    const u = Auth.user;
    setupMode = 'humans';
    if(u && u.avatar && u.avatar.name && slots[0]){
      setupCount = 4;
      $('pCount').textContent = setupCount;
      slots[0].type = 'human';
      slots[0].name = u.avatar.name;
      slots[0].image = u.avatar.image || null;
      slots[0].isOwner = u.provider !== 'guest';
      slots[0].isDeviceUser = false;
      for(let i = 1; i < setupCount; i++){
        slots[i].type = 'human';
        slots[i].name = '';
      }
      renderNames();
    }
    show('setup');
  }

  function openStats(){
    const stats = Stats.get();
    if(!stats) return;
    const s = $('sheet'); s.innerHTML = ''; s.appendChild(grip());
    const h = el('h2'); h.textContent = 'My Stats'; s.appendChild(h);
    const sub = el('div', 'sub'); sub.textContent = 'Tracked for your account only — Guest play isn’t saved.'; s.appendChild(sub);
    const list = el('div', 'names');
    [
      ['Games played', stats.gamesPlayed],
      ['Wins', stats.wins],
      ['Top score', stats.topScore],
      ['Average score', stats.average],
      ['Color Runs', stats.colorRuns]
    ].forEach(([label, val]) => {
      const row = el('div', 'sb-standing');
      row.innerHTML = '<span class="nm">' + label + '</span><span class="sc">' + val + '</span>';
      list.appendChild(row);
    });
    s.appendChild(list);
    const cb = el('button', 'btn-link'); cb.textContent = 'Close'; cb.onclick = closeOv;
    s.appendChild(cb);
    openOv();
  }

  function init(){
    $('modeSingle').onclick = startSinglePlay;
    $('modeMulti').onclick = startMultiplayer;
    $('modeChallenge').onclick = startChallenge;
    $('modeScoreboard').onclick = () => Scoreboard.enter();
    $('modeAdFreeBtn').onclick = () => IAP.openPaywall();
    $('modeStatsBtn').onclick = openStats;
    $('msSignOutBtn').onclick = () => { if(confirm('Sign out?')) Auth.signOut(); };
    $('msBackBtn').onclick = () => { show('mainmenu'); MainMenu.refresh(); };
  }

  return { init, refresh };
})();
