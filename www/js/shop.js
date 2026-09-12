"use strict";
/*
  Dice half-sets: 6 dice of one color. A game always uses exactly 2 colors (6+6=12) —
  red+blue are free and owned by everyone; buying a 3rd (etc.) color just adds another
  option into that pair, via Coins.equipColor() (see coins.js for the swap rule).

  Premium (12 dice, used as one inseparable set) and Platinum (12 dice, animated) are
  real upcoming tiers with no art yet — shown as coming-soon panels using the prices
  already agreed (Coins.FULL_SET_TIERS) so the catalog doesn't need to change shape
  when that art arrives, just get real entries.
*/
const Shop = (function(){
  // TESTING: all non-free prices dropped to 25 coins (dice + backgrounds normally
  // 75) so a 500-coin guest can buy several items in one pass. Restore the real prices
  // once purchase testing is done.
  const COLOR_CATALOG = [
    { id: 'red', name: 'Red', cost: 0 },
    { id: 'blue', name: 'Blue', cost: 0 },
    { id: 'green', name: 'Green', cost: 25 },
    { id: 'purple', name: 'Purple', cost: 25 },
    { id: 'black', name: 'Black', cost: 25 },
    { id: 'lblue', name: 'Light Blue', cost: 25 },
    { id: 'orange', name: 'Orange', cost: 25 },
    { id: 'pink', name: 'Pink', cost: 25 }
  ];

  const BACKGROUND_CATALOG = [
    { id: 'wood', name: 'Wood Grain', cost: 0 },
    { id: 'galaxy', name: 'Night Galaxy', cost: 25 },
    { id: 'sky', name: 'Puffy Clouds', cost: 25 },
    { id: 'castle', name: 'Castle Garden', cost: 25 },
    { id: 'cliffs', name: 'Cliffs of Scotland', cost: 25 }
  ];

  function applyEquippedBackground(){
    document.body.className = 'bg-' + Coins.getEquippedBackground();
  }

  // A state button either shows one word (Use/Equipped) or, when there's a price to
  // show (only the not-yet-owned "Buy" state), that word plus the cost stacked under it.
  function stateButton(cls, label, priceLabel){
    const btn = el('button', 'sr-btn ' + cls); btn.type = 'button';
    if(priceLabel){
      const l = el('span', 'sr-btn-label'); l.textContent = label;
      const p = el('span', 'sr-btn-price'); p.textContent = priceLabel;
      btn.appendChild(l); btn.appendChild(p);
    } else {
      btn.textContent = label;
    }
    return btn;
  }

  function renderBackgrounds(){
    const list = $('shopBgList'); list.innerHTML = '';
    BACKGROUND_CATALOG.forEach((b) => {
      const row = el('div', 'shop-row');
      const top = el('div', 'sr-top');
      const sw = el('div', 'sr-swatch');
      if(b.id === 'wood'){ sw.style.background = 'linear-gradient(180deg,#c69a63,#b5834b)'; }
      else { const img = el('img'); img.src = 'media/backgrounds/' + b.id + '.jpg'; img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; sw.appendChild(img); }
      const info = el('div', 'sr-info');
      const nm = el('div', 'sr-name'); nm.textContent = b.name;
      info.appendChild(nm);
      top.appendChild(sw); top.appendChild(info);

      const isOwned = Coins.ownsBackground(b.id);
      const isEquipped = Coins.getEquippedBackground() === b.id;
      const btn = isEquipped ? stateButton('equipped', 'Equipped')
        : isOwned ? stateButton('equip', 'Use')
        : stateButton('buy', 'Buy', '🪙 ' + b.cost);
      btn.disabled = isEquipped;
      btn.onclick = () => {
        if(isOwned){ Coins.equipBackground(b.id); applyEquippedBackground(); renderBackgrounds(); return; }
        if(!Coins.canAfford(b.cost)){ toast('Not enough coins'); return; }
        Coins.spend(b.cost);
        renderCoinBalance();
        flyCoinBubble($('shopCoinBalance'), btn, '🪙 ' + b.cost, () => {
          Coins.grantBackground(b.id);
          toast(b.name + ' unlocked!');
          renderBackgrounds();
        });
      };
      row.appendChild(top); row.appendChild(btn);
      list.appendChild(row);
    });
  }

  function renderColors(){
    const owned = Coins.getOwnedColors();
    const equipped = Coins.getEquippedColors();
    const list = $('shopDiceList'); list.innerHTML = '';
    const warn = $('shopDiceWarning');
    if(warn) warn.classList.toggle('show', !Coins.hasValidLoadout());
    COLOR_CATALOG.forEach((c) => {
      const row = el('div', 'shop-row');
      const top = el('div', 'sr-top');
      const sw = el('div', 'sr-swatch');
      const img = el('img'); img.src = (DICE_IMG[c.id] || [])[3]; img.style.width = '100%'; img.style.height = '100%';
      sw.appendChild(img);
      const info = el('div', 'sr-info');
      const nm = el('div', 'sr-name'); nm.textContent = c.name + ' (half-set · 6 dice)';
      info.appendChild(nm);
      top.appendChild(sw); top.appendChild(info);

      const isOwned = owned.includes(c.id);
      const isEquipped = equipped.includes(c.id);
      const btn = isEquipped ? stateButton('equipped', 'Equipped')
        : isOwned ? stateButton('equip', 'Use')
        : stateButton('buy', 'Buy', '🪙 ' + c.cost);
      btn.onclick = () => {
        if(isEquipped){ Coins.unequipColor(c.id); renderColors(); return; }
        if(isOwned){ Coins.equipColor(c.id); renderColors(); renderCoinBalance(); return; }
        if(!Coins.canAfford(c.cost)){ toast('Not enough coins'); return; }
        Coins.spend(c.cost);
        renderCoinBalance();
        flyCoinBubble($('shopCoinBalance'), btn, '🪙 ' + c.cost, () => {
          Coins.grantColor(c.id);
          toast(c.name + ' half-set unlocked!');
          renderColors();
        });
      };
      row.appendChild(top); row.appendChild(btn);
      list.appendChild(row);
    });
  }

  function renderCoinBalance(){ $('shopCoinBalance').textContent = '🪙 ' + Coins.getBalance(); }

  function openCoinPacks(){
    const s = $('sheet'); s.innerHTML = ''; s.appendChild(grip());
    const h = el('h2'); h.textContent = 'Buy Coins'; s.appendChild(h);
    Coins.COIN_PACKS.forEach((pack) => {
      const row = el('button', 'btn-cream'); row.style.position = 'relative'; row.type = 'button';
      row.textContent = pack.coins + ' coins — ' + pack.price;
      if(pack.bestDeal){
        const badge = el('div', 'best-deal-badge'); badge.textContent = 'BEST DEAL';
        row.appendChild(badge);
      }
      row.onclick = () => IAP.purchaseCoins(pack, () => { renderCoinBalance(); renderColors(); MainMenu.refresh(); });
      s.appendChild(row);
    });
    const cb = el('button', 'btn-link'); cb.textContent = 'Close'; cb.onclick = closeOv;
    s.appendChild(cb);
    openOv();
  }

  function enter(){ show('shop'); renderCoinBalance(); renderColors(); renderBackgrounds(); }

  // Open/closed state for the profile sheet's accordion sections, kept across
  // re-renders (equip actions close+reopen the sheet) but reset on page load —
  // an in-memory module var is enough, same pattern as AvatarScreen's selectedPreset.
  const profileState = { current: true, dice: false, avatars: false, backgrounds: false };

  function diceSwatchImg(colorId){
    const img = el('img'); img.src = (DICE_IMG[colorId] || [])[3]; img.style.width = '100%'; img.style.height = '100%';
    return img;
  }

  function renderCurrentDiceSection(body){
    const equipped = Coins.getEquippedColors();
    const list = el('div', 'names');
    COLOR_CATALOG.filter((c) => equipped.includes(c.id)).forEach((c) => {
      const row = el('div', 'shop-row');
      const sw = el('div', 'sr-swatch'); sw.appendChild(diceSwatchImg(c.id));
      const info = el('div', 'sr-info');
      const nm = el('div', 'sr-name'); nm.textContent = c.name; info.appendChild(nm);
      const btn = el('button', 'sr-btn equipped'); btn.type = 'button'; btn.textContent = 'Equipped';
      btn.onclick = () => { Coins.unequipColor(c.id); closeOv(); openProfile(); };
      row.appendChild(sw); row.appendChild(info); row.appendChild(btn);
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  function renderMyDiceSection(body){
    const owned = Coins.getOwnedColors();
    const equipped = Coins.getEquippedColors();
    const list = el('div', 'names');
    COLOR_CATALOG.filter((c) => owned.includes(c.id)).forEach((c) => {
      const row = el('div', 'shop-row');
      const sw = el('div', 'sr-swatch'); sw.appendChild(diceSwatchImg(c.id));
      const info = el('div', 'sr-info');
      const nm = el('div', 'sr-name'); nm.textContent = c.name; info.appendChild(nm);
      const isEquipped = equipped.includes(c.id);
      const btn = el('button', 'sr-btn ' + (isEquipped ? 'equipped' : 'equip'));
      btn.type = 'button'; btn.textContent = isEquipped ? 'Equipped' : 'Use';
      btn.onclick = () => {
        if(isEquipped) Coins.unequipColor(c.id); else Coins.equipColor(c.id);
        closeOv(); openProfile();
      };
      row.appendChild(sw); row.appendChild(info); row.appendChild(btn);
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  function renderMyAvatarsSection(body){
    const u = Auth.user;
    const avatar = (u && u.avatar) || {};
    const presetIndex = typeof avatar.presetIndex === 'number' ? avatar.presetIndex : null;
    const wrap = el('div', 'avatar-presets');
    AVATAR_PRESETS.forEach((src, i) => {
      const btn = el('button', 'avatar-preset' + (presetIndex === i ? ' on' : ''));
      btn.type = 'button';
      const img = el('img'); img.src = src; img.alt = 'Avatar option ' + (i + 1); img.draggable = false;
      btn.appendChild(img);
      btn.onclick = () => {
        Auth.patchUser({ avatar: Object.assign({}, avatar, { presetIndex: i, image: src }) });
        MainMenu.refresh(); closeOv(); openProfile();
      };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    const divider = el('div', 'divider'); const dtxt = el('span'); dtxt.textContent = 'or use your initials'; divider.appendChild(dtxt);
    body.appendChild(divider);
    const swatches = el('div', 'swatches');
    AVCOL.forEach((c) => {
      const sw = el('button', 'swatch' + (presetIndex === null && avatar.color === c ? ' on' : ''));
      sw.type = 'button'; sw.style.background = c;
      sw.onclick = () => {
        const next = Object.assign({}, avatar, { color: c });
        delete next.presetIndex; delete next.image;
        Auth.patchUser({ avatar: next });
        MainMenu.refresh(); closeOv(); openProfile();
      };
      swatches.appendChild(sw);
    });
    body.appendChild(swatches);
    const editLink = el('button', 'btn-link avatar-edit-link'); editLink.type = 'button'; editLink.textContent = 'Edit Name & Avatar';
    editLink.onclick = () => { closeOv(); show('avatar'); AvatarScreen.refresh(); };
    body.appendChild(editLink);
  }

  function renderMyBackgroundsSection(body){
    const equippedBg = Coins.getEquippedBackground();
    const list = el('div', 'names');
    BACKGROUND_CATALOG.filter((b) => Coins.ownsBackground(b.id)).forEach((b) => {
      const row = el('div', 'shop-row');
      const sw = el('div', 'sr-swatch');
      if(b.id === 'wood'){ sw.style.background = 'linear-gradient(180deg,#c69a63,#b5834b)'; }
      else { const img = el('img'); img.src = 'media/backgrounds/' + b.id + '.jpg'; img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; sw.appendChild(img); }
      const info = el('div', 'sr-info');
      const nm = el('div', 'sr-name'); nm.textContent = b.name; info.appendChild(nm);
      const isEquipped = equippedBg === b.id;
      const btn = el('button', 'sr-btn ' + (isEquipped ? 'equipped' : 'equip'));
      btn.type = 'button'; btn.textContent = isEquipped ? 'Equipped' : 'Use'; btn.disabled = isEquipped;
      btn.onclick = () => { Coins.equipBackground(b.id); applyEquippedBackground(); closeOv(); openProfile(); };
      row.appendChild(sw); row.appendChild(info); row.appendChild(btn);
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  // Renders one collapsible subhead. State (open/closed) lives in profileState so it
  // survives the closeOv()+openProfile() round-trip that equip actions trigger.
  function accordionSection(container, stateKey, title, renderBody){
    const wrap = el('div', 'acc-section' + (profileState[stateKey] ? ' open' : ''));
    const head = el('button', 'acc-head'); head.type = 'button';
    const ttl = el('span', 'plabel'); ttl.textContent = title;
    const chev = el('span', 'acc-chevron'); chev.textContent = '›';
    head.appendChild(ttl); head.appendChild(chev);
    const body = el('div', 'acc-body');
    renderBody(body);
    head.onclick = () => { profileState[stateKey] = !profileState[stateKey]; wrap.classList.toggle('open'); };
    wrap.appendChild(head); wrap.appendChild(body);
    container.appendChild(wrap);
  }

  // Tapping the avatar anywhere (main menu, mode select) opens this: name, coins,
  // account stats, and four collapsible sections covering current/owned dice,
  // avatars, and backgrounds — all editable inline, without leaving for the full
  // Shop screen. Buying still happens in the Shop; this sheet is owned-items only.
  function openProfile(){
    const u = Auth.user;
    const s = $('sheet'); s.innerHTML = ''; s.appendChild(grip());

    const head = el('div', 'profile-head');
    const nm = el('span', 'profile-name'); nm.textContent = (u && u.avatar && u.avatar.name) || 'Profile';
    const coins = el('span', 'profile-coins'); coins.textContent = '🪙 ' + Coins.getBalance();
    head.appendChild(nm); head.appendChild(coins);
    s.appendChild(head);

    const stats = Stats.get();
    if(stats){
      const statList = el('div', 'names profile-stats');
      [
        ['Games played', stats.gamesPlayed],
        ['Wins', stats.wins],
        ['Top score', stats.topScore],
        ['Color Runs', stats.colorRuns]
      ].forEach(([label, val]) => {
        const row = el('div', 'sb-standing');
        row.innerHTML = '<span class="nm">' + label + '</span><span class="sc">' + val + '</span>';
        statList.appendChild(row);
      });
      s.appendChild(statList);
    } else {
      const note = el('div', 'sub profile-stats'); note.textContent = 'Sign in with an account to track stats.';
      s.appendChild(note);
    }

    // Persisted (see setSoundVolume() in game.js) so it's already set correctly the
    // moment any game starts, rather than resetting to full volume every session.
    const soundRow = el('div', 'sound-row');
    soundRow.innerHTML = '<div class="plabel">Sound</div>' +
      '<input type="range" class="sound-slider" min="0" max="100" step="1" value="' + Math.round((soundVolume / SOUND_VOLUME_MAX) * 100) + '">' +
      '<div class="sound-ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>';
    const slider = soundRow.querySelector('.sound-slider');
    slider.oninput = () => { setSoundVolume(Number(slider.value)); playSfx('s3'); };
    s.appendChild(soundRow);

    if(!Coins.hasValidLoadout()){
      const warn = el('div', 'shop-warning show');
      warn.textContent = '⚠️ You must have two dice colors selected, or a Premium/Platinum set equipped.';
      s.appendChild(warn);
    }

    accordionSection(s, 'current', 'Current Dice', renderCurrentDiceSection);
    accordionSection(s, 'dice', 'My Dice', renderMyDiceSection);
    accordionSection(s, 'avatars', 'My Avatars', renderMyAvatarsSection);
    accordionSection(s, 'backgrounds', 'My Backgrounds', renderMyBackgroundsSection);

    const btnRow = el('div', 'profile-btn-row');
    const shopLink = el('button', 'btn-cream'); shopLink.type = 'button'; shopLink.textContent = 'Go to Shop';
    shopLink.onclick = () => { closeOv(); enter(); };
    const cb = el('button', 'btn-link'); cb.type = 'button'; cb.textContent = 'Close'; cb.onclick = closeOv;
    btnRow.appendChild(shopLink); btnRow.appendChild(cb);
    s.appendChild(btnRow);

    openOv();
  }

  function init(){
    applyEquippedBackground();
    $('shopBackBtn').onclick = () => { show('mainmenu'); MainMenu.refresh(); };
    $('shopBuyCoinsBtn').onclick = openCoinPacks;
    $('mmAvatar').onclick = openProfile;
    $('msAvatar').onclick = openProfile;
  }

  return { init, enter, openCoinPacks, openProfile, renderColors: () => { renderColors(); renderCoinBalance(); } };
})();
