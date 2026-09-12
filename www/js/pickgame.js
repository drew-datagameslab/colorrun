"use strict";
/*
  User vs CPU's buy-in picker: player count + buy-in tier chosen here, paid here (with
  the coin-fly-to-button animation), then straight into #play — no #setup detour. Kept
  as its own module since ModeSelect.startMultiplayer() is meant to reuse this same
  screen/logic once real online rooms exist (see the comment there).
*/
const PickGame = (function(){
  const COUNTS = [4, 6, 8];
  const STANDARD_BUY_IN = 10;
  const DOUBLE_BUY_IN = 20;

  function refresh(){
    renderAccountHeader('pg');
    renderGrid($('pickStandardGrid'), STANDARD_BUY_IN, false);
    renderGrid($('pickDoubleGrid'), DOUBLE_BUY_IN, true);
  }

  function renderGrid(container, buyIn, double){
    container.innerHTML = '';
    COUNTS.forEach((count) => {
      const btn = el('button', 'pick-btn'); btn.type = 'button';
      const pc = el('div', 'pb-count'); pc.textContent = count + ' Player';
      const cost = el('div', 'pb-cost'); cost.textContent = '🪙 ' + buyIn;
      btn.appendChild(pc); btn.appendChild(cost);
      btn.onclick = () => startPicked(count, buyIn, double, btn);
      container.appendChild(btn);
    });
  }

  function startPicked(count, buyIn, double, btnEl){
    if(!Coins.hasValidLoadout()){ toast('Pick two dice colors (or a Premium/Platinum set) in the Shop before playing'); return; }
    if(!Coins.canAfford(buyIn)){ toast('Not enough coins — need ' + buyIn + ' to play'); return; }
    Coins.spend(buyIn);
    $('pgCoinBalance').textContent = '🪙 ' + Coins.getBalance();
    flyCoinBubble($('pgCoinBalance'), btnEl, '🪙 ' + buyIn, () => launchGame(count, double));
  }

  function launchGame(count, double){
    const u = Auth.user;
    if(!(u && u.avatar && u.avatar.name && slots[0])) return;
    setupMode = 'cpu';
    doubleAction = double;
    prepaidBuyIn = true;
    threshTier = 'standard'; customThresh = null; applyThresh();
    setupCount = count;
    $('pCount').textContent = setupCount;
    slots[0].type = 'human';
    slots[0].name = u.avatar.name;
    slots[0].image = u.avatar.image || null;
    slots[0].isOwner = u.provider !== 'guest';
    slots[0].isDeviceUser = true;
    for(let i = 1; i < setupCount; i++){
      slots[i].type = 'cpu';
      slots[i].name = pickBot();
    }
    renderNames();
    startGame();
  }

  function enter(){ show('pickgame'); refresh(); }

  function init(){
    $('pgBackBtn').onclick = () => { show('modeselect'); ModeSelect.refresh(); };
    $('pgAvatar').onclick = () => Shop.openProfile();
  }

  return { init, enter, refresh };
})();
