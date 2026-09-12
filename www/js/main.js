"use strict";
(function(){
  // Dock/undock the ad banner as screens change, without touching game.js's own logic.
  // `show` is a top-level function declaration in game.js, so re-pointing window.show
  // here redirects every existing call site (inside game.js too) to this wrapped version.
  const baseShow = window.show;
  window.show = function(id){
    baseShow(id);
    if(id === 'play') Ads.showBanner();
    else Ads.hideBanner();
    // These two screens don't have their own ModeSelect/MainMenu-style refresh() called
    // from every place that can show them (Challenge, Play Again, goWinner, ...) — doing
    // it here once guarantees the header's name/coins/avatar are always current instead
    // of relying on every call site to remember.
    if(id === 'setup') renderAccountHeader('setup');
    if(id === 'winner') renderAccountHeader('winHdr');
  };

  document.getElementById('signinLogo').src = CR_LOGO;
  document.getElementById('signinDgLogo').src = DG_LOGO;
  document.getElementById('avatarLogoTop').src = CR_LOGO;
  document.getElementById('avatarLogoBottom').src = DG_LOGO;
  document.getElementById('mmLogoCR').src = CR_LOGO;
  document.getElementById('mmDgLogo').src = DG_LOGO;
  document.getElementById('mmCopyright').textContent = '© ' + new Date().getFullYear() + ' Data Games Lab LLC';
  document.getElementById('pickGameLogo').src = CR_LOGO;
  document.getElementById('msLogoCR').src = CR_LOGO;

  document.getElementById('infoBtn').onclick = openRules;
  document.getElementById('setupBackBtn').onclick = () => { show('modeselect'); ModeSelect.refresh(); };
  document.getElementById('setupAvatar').onclick = () => Shop.openProfile();
  document.getElementById('winMenuBackBtn').onclick = () => { show('mainmenu'); MainMenu.refresh(); };
  document.getElementById('winMainMenuBtn').onclick = () => { show('mainmenu'); MainMenu.refresh(); };
  document.getElementById('winHdrAvatar').onclick = () => Shop.openProfile();
  // Reaches Profile (dice/backgrounds/volume) mid-game, deliberately independent of
  // whose turn it is or whether a CPU is mid-roll — see the hamburger menuBtn for the
  // separate, turn-related "New game / standings" actions.
  document.getElementById('hAvatar').onclick = () => Shop.openProfile();

  Auth.init();
  AvatarScreen.init();
  MainMenu.init();
  Shop.init();
  ModeSelect.init();
  PickGame.init();
  Scoreboard.init();
})();
