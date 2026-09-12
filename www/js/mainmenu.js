"use strict";
const MainMenu = (function(){
  function refresh(){
    const u = Auth.user;
    if(!u) return;
    $('mmUserName').textContent = (u.avatar && u.avatar.name) || u.name || 'Player';
    $('mmCoinBalance').textContent = '🪙 ' + Coins.getBalance();
    const av = $('mmAvatar');
    if(u.avatar && u.avatar.image){
      av.textContent = '';
      av.style.background = 'transparent';
      av.style.backgroundImage = 'url(' + u.avatar.image + ')';
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
    } else {
      av.style.backgroundImage = 'none';
      av.textContent = initials((u.avatar && u.avatar.name) || u.name || 'P1');
      av.style.background = (u.avatar && u.avatar.color) || AVCOL[0];
    }
  }

  function init(){
    $('mmGameIcon').src = DICE_IMG.blue[3]; // the blue spade die face
    $('mmShopBtn').onclick = () => { Shop.enter(); };
    $('mmGameBtn').onclick = () => { show('modeselect'); ModeSelect.refresh(); };
    $('mmTournamentBtn').onclick = () => toast('Tournaments are coming soon');
    $('mmSignOutBtn').onclick = () => { if(confirm('Sign out?')) Auth.signOut(); };
  }

  return { init, refresh };
})();
