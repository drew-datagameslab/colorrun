"use strict";
const AvatarScreen = (function(){
  let selectedColor = AVCOL[0];
  let selectedPreset = null; // index into AVATAR_PRESETS, or null for the initials-based avatar

  function renderPresets(){
    const wrap = $('avatarPresets'); wrap.innerHTML = '';
    AVATAR_PRESETS.forEach((src, i) => {
      const btn = el('button', 'avatar-preset' + (selectedPreset === i ? ' on' : ''));
      btn.type = 'button';
      const img = el('img'); img.src = src; img.alt = 'Avatar option ' + (i + 1); img.draggable = false;
      btn.appendChild(img);
      btn.onclick = () => { selectedPreset = i; renderPresets(); updatePreview(); };
      wrap.appendChild(btn);
    });
  }

  function renderSwatches(){
    const wrap = $('avatarSwatches'); wrap.innerHTML = '';
    AVCOL.forEach((c) => {
      const sw = el('button', 'swatch' + (selectedPreset === null && c === selectedColor ? ' on' : ''));
      sw.type = 'button';
      sw.style.background = c;
      sw.onclick = () => { selectedColor = c; selectedPreset = null; renderPresets(); renderSwatches(); updatePreview(); };
      wrap.appendChild(sw);
    });
  }

  function updatePreview(){
    const name = $('avatarNameInput').value.trim() || (Auth.user ? Auth.user.name : '') || 'Player';
    const p = $('avatarPreview');
    if(selectedPreset !== null){
      p.textContent = '';
      p.style.background = 'transparent';
      p.style.backgroundImage = 'url(' + AVATAR_PRESETS[selectedPreset] + ')';
      p.style.backgroundSize = 'cover';
      p.style.backgroundPosition = 'center';
    } else {
      p.style.backgroundImage = 'none';
      p.textContent = initials(name);
      p.style.background = selectedColor;
    }
  }

  function refresh(){
    const u = Auth.user;
    selectedPreset = null;
    if(u && u.avatar){
      selectedColor = u.avatar.color || AVCOL[0];
      if(typeof u.avatar.presetIndex === 'number') selectedPreset = u.avatar.presetIndex;
    }
    $('avatarNameInput').value = (u && u.avatar && u.avatar.name) || (u ? u.name : '') || '';
    renderPresets();
    renderSwatches();
    updatePreview();
  }

  function save(){
    const name = $('avatarNameInput').value.trim();
    if(!name){ toast('Enter a display name'); return; }
    const avatar = { color: selectedColor, name };
    if(selectedPreset !== null){ avatar.presetIndex = selectedPreset; avatar.image = AVATAR_PRESETS[selectedPreset]; }
    Auth.patchUser({ avatar });
    show('mainmenu');
    MainMenu.refresh();
  }

  function init(){
    $('avatarNameInput').oninput = updatePreview;
    $('avatarSaveBtn').onclick = save;
  }

  return { init, refresh };
})();
