"use strict";
  document.getElementById('setupLogo').src=CR_LOGO;
  document.getElementById('playLogoCR').src=CR_LOGO;
  document.getElementById('playLogoDG').src=DG_LOGO;
  document.getElementById('winLogo').src=CR_LOGO;
  // ---- audio (chimes + add-to-total) ----
  // Max volume is capped at .7 (1.0 didn't read as meaningfully louder than .75 to the
  // ear) and the slider maps linearly onto [0, .7] — 50% really is .35, not .5 — so it
  // persists once in the user's Profile (see Shop.openProfile()) rather than resetting
  // to full every time the app loads.
  const SOUND_VOLUME_MAX=0.7, SOUND_VOLUME_KEY='cr_sound_volume';
  let soundVolume=SOUND_VOLUME_MAX;
  try{ const saved=localStorage.getItem(SOUND_VOLUME_KEY); if(saved!==null) soundVolume=Math.min(SOUND_VOLUME_MAX, Math.max(0, parseFloat(saved))); }catch(e){}
  function setSoundVolume(pct){ // pct: 0-100
    soundVolume=Math.min(SOUND_VOLUME_MAX, Math.max(0, (pct/100)*SOUND_VOLUME_MAX));
    try{ localStorage.setItem(SOUND_VOLUME_KEY, String(soundVolume)); }catch(e){}
  }
  const SFX={};
  (function initAudio(){ if(typeof Audio==='undefined') return;
    try{ ['s3','s4','s5','s6','add','fanfare'].forEach(k=>{ if(MEDIA[k]){ SFX[k]=new Audio(MEDIA[k]); SFX[k].preload='auto'; } }); }catch(e){}
  })();
  function playSfx(key){ if(soundVolume<=0) return; const base=SFX[key]; if(!base) return;
    try{ const a=base.cloneNode(true); a.volume=soundVolume; const p=a.play(); if(p&&p.catch) p.catch(()=>{}); }catch(e){}
  }
  let audioUnlocked=false;
  function unlockAudio(){ if(audioUnlocked) return; audioUnlocked=true;
    Object.values(SFX).forEach(a=>{ try{ a.muted=true; const p=a.play(); if(p&&p.then) p.then(()=>{a.pause();a.currentTime=0;a.muted=false;}).catch(()=>{a.muted=false;}); else a.muted=false; }catch(e){} });
  }
  document.addEventListener('pointerdown', unlockAudio, {once:true});

  const $=id=>document.getElementById(id);
  const el=(t,c)=>{const e=document.createElement(t); if(c)e.className=c; return e;};
  const rndFace=()=>1+Math.floor(Math.random()*6);
  const PIP={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
  const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AVCOL=['#e5352f','#1f7fd6','#e58a1f','#8e44c9','#159e8a','#d61f7a','#3a7d1f','#4a5568'];
  // CPU opponents always roll the free Red/Blue half-sets, regardless of what the
  // device owner has equipped — dice color is a personal display preference, not
  // something a bot "owns". Themed online rooms (future multiplayer) may override this.
  const CPU_DICE_COLORS=['red','blue'];

  function bonusFor(n){return n>=6?100:n===5?40:n===4?25:n===3?10:0;}
  function scoreDice(dice){
    const byVal={}; for(const d of dice){(byVal[d.value]=byVal[d.value]||[]).push(d);}
    let total=0; const sets=[];
    for(const v in byVal){ const g=byVal[v]; if(g.length<3)continue;
      const base=g.length*5;
      // Bonus is per-color, 3+ of the same color AND face — counted generically so it
      // applies to any equipped half-set color, not just the original red/blue pair.
      const byColor={}; for(const d of g){ byColor[d.color]=(byColor[d.color]||0)+1; }
      let cb=0; for(const c in byColor){ cb+=bonusFor(byColor[c]); }
      total+=base+cb; sets.push({value:+v,count:g.length,base,cb,byColor});
    }
    sets.sort((a,b)=>a.value-b.value);
    return {total,sets};
  }
  function dieEl(color,value,rolling){
    const d=el('div','die '+color+(rolling?' rolling':''));
    const img=el('img'); img.src=(DICE_IMG[color]||[])[value-1]||''; img.alt=color+' '+value; img.draggable=false;
    d.appendChild(img);
    return d;
  }
  function initials(name){
    const parts=String(name).replace(/&/g,' ').split(/\s+/).filter(Boolean);
    if(parts.length>=2) return (parts[0][0]+parts[1][0]).toUpperCase();
    return String(name).slice(0,2).toUpperCase();
  }
  // Shared header populator for the screens that show the account's own name/coins/
  // avatar (Main Menu, Shop, Mode Select, Pick Your Game, Setup, Winner all use the
  // same #<prefix>UserName/#<prefix>CoinBalance/#<prefix>Avatar id pattern) — keeps
  // that logic in one place instead of copy-pasted per screen module.
  function renderAccountHeader(prefix){
    const u=Auth.user; if(!u) return;
    const nameEl=$(prefix+'UserName'); if(nameEl) nameEl.textContent=(u.avatar&&u.avatar.name)||u.name||'Player';
    const balEl=$(prefix+'CoinBalance'); if(balEl) balEl.textContent='🪙 '+Coins.getBalance();
    const av=$(prefix+'Avatar');
    if(av){
      if(u.avatar&&u.avatar.image){
        av.textContent=''; av.style.background='transparent';
        av.style.backgroundImage='url('+u.avatar.image+')';
        av.style.backgroundSize='cover'; av.style.backgroundPosition='center';
      } else {
        av.style.backgroundImage='none';
        av.textContent=initials((u.avatar&&u.avatar.name)||u.name||'P1');
        av.style.background=(u.avatar&&u.avatar.color)||AVCOL[0];
      }
    }
  }
  function pad4(n){ const s=String(n); return s.length>=4?s:('0000'+s).slice(-4); }
  function ordinal(n){ const s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
  let toastTimer; function toast(m){const t=$('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1500);}
  function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); $(id).classList.add('active');}

  // state
  const G={ persons:[], units:[], threshold:250, phase:'regular', round:1, queue:[], qIdx:0 };
  let T=null;
  function unitOf(pid){ const p=G.persons.find(x=>x.id===pid); return G.units.find(u=>u.id===p.unitId); }
  function activeUnits(){ return G.units.filter(u=>u.active); }
  function curPid(){ return G.queue[G.qIdx]; }
  function curPerson(){ return G.persons.find(p=>p.id===curPid()); }
  function curUnit(){ return unitOf(curPid()); }

  // setup
  const BOTS=['Ada','Turing','Nova','Pixel','Chip','Byte','Vector','Domino','Quantum','Circuit'];
  let setupCount=4, setupThresh=250;
  let threshTier='standard', customThresh=null;
  let slots=Array.from({length:8},()=>({type:'human',name:''}));
  // Which roles the setup screen locks players into: 'cpu' for User vs CPU Players
  // (slot 0 is always the device's own human, every other slot is always CPU — no
  // other humans allowed in this mode) or 'humans' for Challenge (every slot is a
  // human passing the device around, no CPUs). Set by ModeSelect before show('setup').
  let setupMode='cpu';
  // Set by PickGame right before calling startGame() when the buy-in was already paid
  // (and animated) on the Pick Your Game screen, so startGame() doesn't charge it again;
  // doubleAction marks a Double Action pick so goWinner() pays out at 2x. Both reset
  // themselves the moment startGame() reads them.
  let prepaidBuyIn=false, doubleAction=false;
  // Once the device user is eliminated from a User vs CPU game with rounds still left
  // to play, spectatorChoiceMade gates the "Show Final Score / Let Players Finish"
  // prompt to a single ask for the rest of that game; spectatorFastForward (set only by
  // the first choice) cranks cpuDelay() way down and skips the Color Run celebration so
  // the remaining CPU-only rounds resolve in a couple of seconds instead of playing out
  // turn by turn. Both reset in startGame() and on abandoning a game via "New game".
  let spectatorChoiceMade=false, spectatorFastForward=false;

  function usedBots(){ const s=new Set(); for(let i=0;i<setupCount;i++) if(slots[i].type==='cpu'&&slots[i].name) s.add(slots[i].name); return s; }
  function pickBot(){ const used=usedBots(); for(const n of BOTS) if(!used.has(n)) return n; return 'CPU '+(10+Math.floor(Math.random()*89)); }
  // Re-applies setupMode's rules to every currently-visible slot before each render —
  // covers both a freshly-revealed slot (tapping "+") and a slot left over from a
  // previous mode's session, so neither can slip in as the wrong type.
  function enforceSetupMode(){
    for(let i=0;i<setupCount;i++){
      if(setupMode==='cpu'){
        if(i===0){ slots[i].type='human'; }
        else if(slots[i].type!=='cpu'){ slots[i].type='cpu'; slots[i].name=pickBot(); }
      } else if(setupMode==='humans' && slots[i].type!=='human'){
        slots[i].type='human'; slots[i].name='';
      }
    }
  }
  function renderNames(){
    enforceSetupMode();
    const list=$('nameList'); list.innerHTML='';
    for(let i=0;i<setupCount;i++){
      const s=slots[i];
      const row=el('div','name-row');
      const chip=el('div','chip'); chip.style.background=AVCOL[i%AVCOL.length]; chip.textContent=(i+1);
      const inp=el('input'); inp.type='text'; inp.placeholder='Player '+(i+1); inp.maxLength=14; inp.value=s.name;
      if(s.type==='cpu'){ inp.readOnly=true; inp.classList.add('cpu-input'); }
      inp.oninput=()=>{ if(slots[i].type==='human') slots[i].name=inp.value; };
      const tog=el('div','type-toggle'+(s.type==='cpu'?' cpu':'')); tog.textContent=s.type==='cpu'?'🤖 CPU':'🧑 You';
      row.appendChild(chip); row.appendChild(inp); row.appendChild(tog);
      list.appendChild(row);
    }
    validate();
  }
  function threshVals(){ return {speed:150, standard:250}; }
  function applyThresh(){
    const v=threshVals();
    $('thSpeedLbl').textContent=v.speed+' pts';
    $('thStdLbl').textContent=v.standard+' pts';
    if(threshTier==='speed') setupThresh=v.speed;
    else if(threshTier==='standard') setupThresh=v.standard;
    else setupThresh=customThresh||v.standard;
    $('threshSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.tier===threshTier));
  }
  function validate(){ $('startBtn').disabled=false; $('startBtn').textContent='Start Game'; }
  $('pMinus').onclick=()=>{ if(setupCount>2){ setupCount--; renderNames(); $('pCount').textContent=setupCount; } };
  $('pPlus').onclick=()=>{ if(setupCount<8){ setupCount++; renderNames(); $('pCount').textContent=setupCount; } };
  $('threshSeg').querySelectorAll('button').forEach(b=>{ b.onclick=()=>{
    const tier=b.dataset.tier;
    if(tier==='custom'){ const v=prompt('Elimination starts at how many points?', setupThresh); const n=parseInt(v,10);
      if(!n||n<20){toast('Enter 20 or more'); return;} customThresh=n; threshTier='custom'; $('threshCustomLbl').textContent=n+' pts'; }
    else threshTier=tier;
    applyThresh();
  };});
  $('startBtn').onclick=startGame;
  $('rulesBtnSetup').onclick=openRules;
  applyThresh(); renderNames();

  function startGame(){
    // Every game deals from the same globally-equipped dice colors (beginTurn() below),
    // regardless of who's paying, so this check applies even to free modes like
    // Challenge — a broken/incomplete dice loadout would break the game for everyone
    // at the table, not just the device's own player.
    if(!Coins.hasValidLoadout()){ toast('Pick two dice colors (or a Premium/Platinum set) in the Shop before playing'); return; }
    // Buy-in for the device's own player — CPUs aren't economic participants, and free
    // modes (Challenge) never mark slot 0 as the device user. Blocks starting a new
    // game (including "New game" from the in-play menu) rather than letting a game
    // start that can't be paid for.
    if(slots[0] && slots[0].isDeviceUser && !prepaidBuyIn){
      if(!Coins.canAfford(Coins.BUY_IN_STANDARD)){ toast('Not enough coins — need '+Coins.BUY_IN_STANDARD+' to play'); return; }
      Coins.spend(Coins.BUY_IN_STANDARD);
    }
    prepaidBuyIn=false;
    spectatorChoiceMade=false; spectatorFastForward=false;
    if(typeof self!=='undefined') self.__CR_SPEED=1;
    G.persons=[]; G.units=[]; G.threshold=setupThresh; G.phase='regular'; G.round=1;
    const info=[];
    for(let i=0;i<setupCount;i++){ const s=slots[i];
      info.push({ name:(s.name.trim()||(s.type==='cpu'?('CPU '+(i+1)):('Player '+(i+1)))), cpu:s.type==='cpu', image:s.image||null, isOwner:!!s.isOwner, isDeviceUser:!!s.isDeviceUser }); }
    for(let i=0;i<setupCount;i++){ const a=info[i], uid='u'+i;
      const p={id:'p'+i,name:a.name,unitId:uid,isCPU:a.cpu}; G.persons.push(p);
      G.units.push({id:uid,name:a.name,memberIds:[p.id],score:0,active:true,history:{},color:AVCOL[i%AVCOL.length],isCPU:a.cpu,image:a.image,isOwner:a.isOwner,isDeviceUser:a.isDeviceUser});
    }
    startRound();
  }

  function startRound(){ G.queue=G.persons.filter(p=>unitOf(p.id).active).map(p=>p.id); G.qIdx=0; beginTurn(); }
  function phaseText(){ return G.phase==='elimination' ? ('Round '+G.round+' - Elimination') : ('Round '+G.round); }

  function beginTurn(){
    // A Color Run celebration from the previous turn takes priority over advancing —
    // retry once it (and anything queued behind it) has fully played out, rather than
    // cutting it short the way an unconditional clearSix() used to.
    if(sixActive){ sixDoneCallbacks.push(beginTurn); return; }
    const person=curPerson();
    // The device owner's equipped half-sets pick their own dice color; CPU opponents
    // always use the free Red/Blue pair (see CPU_DICE_COLORS above) regardless of what
    // the owner has equipped.
    const [colorA,colorB]=person.isCPU ? CPU_DICE_COLORS : Coins.getEquippedColors();
    T={dice:[], rollsUsed:0, cpu:!!person.isCPU, announced:{}}; let idc=0;
    for(let i=0;i<6;i++) T.dice.push({id:idc++,color:colorA,value:rndFace(),zone:'active',selected:false});
    for(let i=0;i<6;i++) T.dice.push({id:idc++,color:colorB, value:rndFace(),zone:'active',selected:false});
    clearRollFx();
    // The header is this device's own player, not whoever's turn it is — turns are
    // shown via the .card.active highlight in the cards row instead. Room for level/
    // animation additions here later.
    const owner=G.units[0];
    $('hName').textContent=owner.name;
    $('hCoinBalance').textContent='🪙 '+Coins.getBalance();
    const rb=$('roundBanner');
    rb.textContent=phaseText();
    rb.classList.toggle('elim', G.phase==='elimination');
    const av=$('hAvatar');
    if(owner.image){ av.textContent=''; av.style.background='transparent'; av.style.backgroundImage='url('+owner.image+')'; av.style.backgroundSize='cover'; av.style.backgroundPosition='center'; }
    else { av.style.backgroundImage='none'; av.textContent=initials(owner.name); av.style.background=owner.color; }
    show('play'); $('play').querySelector('.playscroll').scrollTop=0; renderPlay();
    if(T.cpu){ const myTurn=T; setTimeout(()=>cpuTurn(myTurn), cpuDelay(800)); }
  }
  // ----- Computer opponent -----
  function cpuDelay(ms){ return Math.round(ms*((typeof self!=='undefined'&&self.__CR_SPEED)||1)); }
  function cpuSaveSets(){
    const sc={}; saved().forEach(d=>sc[d.value]=(sc[d.value]||0)+1);
    const ab={}; active().forEach(d=>(ab[d.value]=ab[d.value]||[]).push(d));
    for(const v in ab){ if((sc[v]||0)+ab[v].length>=3) ab[v].forEach(d=>{d.zone='saved';d.selected=false;}); }
    checkBonusChimes();
  }
  // Every hop of a CPU's turn carries the exact T object its turn started with
  // (myTurn) and bails the moment the live T is a different object — covers a fresh
  // game starting, "New game", or any other reset landing mid-CPU-turn. The old plain
  // `T.cpu` check couldn't tell "still my turn" from "a newer CPU turn that happens to
  // also be a CPU's" — a real way for a stale timer to mutate or advance a turn that
  // wasn't its own anymore, which is the most likely cause of the occasional freeze
  // reported when the screen is touched while a CPU is rolling.
  function cpuTurn(myTurn){ if(T!==myTurn) return; doRoll(); setTimeout(()=>cpuAfterRoll(myTurn), cpuDelay(850)); }
  function cpuAfterRoll(myTurn){
    if(T!==myTurn) return;
    cpuSaveSets(); renderPlay();
    // Saved dice are locked in, so re-rolling the rest is always safe upside — use all 3 rolls, then bank.
    if(T.rollsUsed<3 && active().length>0) setTimeout(()=>{ if(T!==myTurn) return; doRoll(); setTimeout(()=>cpuAfterRoll(myTurn), cpuDelay(850)); }, cpuDelay(650));
    else setTimeout(()=>{ if(T!==myTurn) return; scoreIt(); }, cpuDelay(800));
  }

  const saved=()=>T.dice.filter(d=>d.zone==='saved');
  const active=()=>T.dice.filter(d=>d.zone==='active');
  const savedCountVal=v=>saved().filter(d=>d.value===v).length;

  // ---- bonus chimes + six-of-a-kind celebration ----
  // sixActive covers the whole celebration (the current play plus anything queued behind
  // it); sixQueued counts extra Color Runs landed while one is already playing (e.g. two
  // separate 6-of-a-kinds — one per color — saved in the same roll) so each gets its own
  // full playthrough, back to back, instead of the second clobbering the first. Anything
  // that would advance the turn (beginTurn/goWinner) waits on sixDoneCallbacks instead of
  // cutting the celebration short — CPU turns otherwise race through in well under the
  // video's ~3s runtime.
  let sixActive=false, sixQueued=0, sixTimer=null, sixVideo=null, sixRaf=null, sixDoneCallbacks=[];
  function boardEl(){ const g=$('savedGrid'); return g?g.closest('.board'):null; }
  // Hard stop for the rare case the player abandons the game mid-celebration (New Game) —
  // the normal completion path is sixAnimDone() below, which respects the queue instead
  // of wiping it.
  function forceStopSix(){
    clearTimeout(sixTimer); cancelAnimationFrame(sixRaf);
    if(sixVideo){ sixVideo.pause(); sixVideo.removeAttribute('src'); sixVideo.load(); sixVideo.remove(); sixVideo=null; }
    const b=boardEl(); if(b){ const o=b.querySelector('.six-overlay'); if(o) o.remove(); }
    sixActive=false; sixQueued=0; sixDoneCallbacks=[];
  }
  // Runs once any in-progress Color Run animation (plus everything queued behind it) has
  // fully played out — used by beginTurn()/goWinner() to defer instead of interrupting.
  function afterSixThen(cb){ if(sixActive) sixDoneCallbacks.push(cb); else cb(); }
  function triggerSix(){
    // Fast-forwarding to the final score (see spectatorFastForward) shouldn't still
    // pause for a ~3s celebration on every CPU-rolled Color Run along the way.
    if(spectatorFastForward) return;
    if(sixActive){ sixQueued++; return; }
    sixActive=true;
    playSixOnce();
  }
  // The source video is bright red/white/blue text on pure black (verified against the
  // actual file — true 0,0,0, not just near-black), so re-drawing each frame onto a
  // canvas with alpha=max(r,g,b) turns the black background fully transparent and keeps
  // the letters' own anti-aliased edges soft, with real per-pixel alpha compositing
  // instead of relying on mix-blend-mode (which depends on an unbroken, non-isolated
  // stacking context all the way down to the page behind it, and wasn't reliably
  // clearing the black background in practice). The video itself stays unmuted and
  // off-screen (not display:none, which some webviews pause) — canvas is just its
  // visual stand-in, audio plays natively off the hidden <video>.
  function playSixOnce(){
    const board=boardEl(); if(!board){ sixAnimDone(); return; }
    const ov=el('div','six-overlay');
    const canvas=document.createElement('canvas'); canvas.className='six-video';
    ov.appendChild(canvas); board.appendChild(ov);

    const vid=document.createElement('video');
    vid.src='media/color-run.mp4'; vid.playsInline=true; vid.muted=false; vid.volume=soundVolume;
    vid.style.cssText='position:fixed; opacity:0; width:1px; height:1px; pointer-events:none';
    document.body.appendChild(vid);
    sixVideo=vid;

    const ctx=canvas.getContext('2d', {willReadFrequently:true});
    let sized=false;
    function draw(){
      if(!sixVideo || sixVideo.paused || sixVideo.ended) return;
      if(sixVideo.videoWidth){
        if(!sized){
          const scale=Math.min(1, 640/sixVideo.videoWidth);
          canvas.width=Math.round(sixVideo.videoWidth*scale);
          canvas.height=Math.round(sixVideo.videoHeight*scale);
          sized=true;
        }
        ctx.drawImage(sixVideo, 0, 0, canvas.width, canvas.height);
        const frame=ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d=frame.data;
        for(let i=0;i<d.length;i+=4){ d[i+3]=Math.max(d[i], d[i+1], d[i+2]); }
        ctx.putImageData(frame, 0, 0);
      }
      sixRaf=requestAnimationFrame(draw);
    }
    const finish=()=>{
      clearTimeout(sixTimer); cancelAnimationFrame(sixRaf);
      if(sixVideo){ sixVideo.pause(); sixVideo.removeAttribute('src'); sixVideo.load(); sixVideo.remove(); sixVideo=null; }
      const b=boardEl(); if(b){ const o=b.querySelector('.six-overlay'); if(o) o.remove(); }
      sixAnimDone();
    };
    // finishSoon() is the recovery path for a video that is never going to play at all
    // (autoplay blocked with no recent-enough user gesture, a load error, an unsupported
    // codec in that specific WebView) — rather than sitting on the full backstop timer
    // below with nothing visible happening, which is exactly what looked like a freeze
    // when this was reported on an iPad: the round transition now waits on this
    // celebration (see beginTurn()'s sixActive check), so a video that silently never
    // starts used to stall every player's next turn for the full 4.5s for no visible
    // reason. Confetti alone still gets a brief moment before moving on.
    let settled=false;
    const finishSoon=()=>{ if(settled) return; settled=true; clearTimeout(sixTimer); sixTimer=setTimeout(finish, 900); };
    vid.addEventListener('playing', ()=>{ settled=true; sixRaf=requestAnimationFrame(draw); }, {once:true});
    vid.addEventListener('ended', finish, {once:true});
    vid.addEventListener('error', finishSoon, {once:true});
    if(soundVolume<=0) vid.muted=true;
    vid.play().catch(()=>{ vid.muted=true; return vid.play(); }).catch(finishSoon);
    triggerConfetti();
    // Safety net for a video that plays but whose 'ended' event never fires for some
    // other reason — kept close to the clip's real ~3.1s runtime rather than padded far
    // beyond it, so a stuck-but-silent case still recovers quickly.
    sixTimer=setTimeout(finish, 3800);
  }
  function sixAnimDone(){
    if(sixQueued>0){ sixQueued--; playSixOnce(); return; }
    sixActive=false;
    const cbs=sixDoneCallbacks; sixDoneCallbacks=[];
    cbs.forEach(cb=>cb());
  }
  // A lighter, more traditional confetti burst (small falling rects) for the Color Run
  // moment itself, distinct from chipRain()'s poker-chip celebration on the winner
  // screen — position:fixed so it rains over the whole screen, above the board.
  function triggerConfetti(){
    if(reduceMotion) return;
    const colors=['#e5352f','#1f7fd6','#e58a1f','#8e44c9','#159e8a','#d61f7a','#f2b71e'];
    for(let i=0;i<40;i++){
      const piece=el('div','confetti-piece');
      piece.style.background=colors[Math.floor(Math.random()*colors.length)];
      piece.style.width=(6+Math.random()*6)+'px'; piece.style.height=(10+Math.random()*8)+'px';
      piece.style.left=Math.random()*100+'vw';
      document.body.appendChild(piece);
      const dur=1800+Math.random()*900, delay=Math.random()*400, startRot=Math.random()*360;
      piece.animate([
        {transform:'translateY(-40px) rotate('+startRot+'deg)', opacity:1},
        {transform:'translateY(106vh) rotate('+(startRot+360+Math.random()*360)+'deg)', opacity:.9}
      ],{duration:dur, delay:delay, easing:'cubic-bezier(.4,.15,.6,1)'});
      setTimeout(()=>piece.remove(), dur+delay+80);
    }
  }
  function checkBonusChimes(){
    if(!T) return;
    const byVC={}; saved().forEach(d=>{ const k=d.value+'-'+d.color; byVC[k]=(byVC[k]||0)+1; });
    for(const k in byVC){
      const cnt=byVC[k]; if(cnt<3) continue;
      const tier=Math.min(6,cnt);
      if(tier>(T.announced[k]||0)){
        T.announced[k]=tier;
        playSfx(tier===3?'s3':tier===4?'s4':tier===5?'s5':'s6');
        if(tier===6){ triggerSix(); const cu=curUnit(); if(cu&&cu.isOwner) Stats.recordColorRun(); }
      }
    }
  }

  function autoCommit(){
    const sc={}; saved().forEach(d=>sc[d.value]=(sc[d.value]||0)+1);
    const sel={}; T.dice.forEach(d=>{ if(d.zone==='active'&&d.selected)(sel[d.value]=sel[d.value]||[]).push(d); });
    for(const v in sel){ if((sc[v]||0)+sel[v].length>=3){ sel[v].forEach(d=>{d.zone='saved'; d.selected=false;}); } }
  }
  // Tapping any one active die selects every other active die showing the same symbol
  // too, so one tap gathers the whole matching group instead of tapping each die of a
  // kind individually — autoCommit() then saves them together the moment there are 3+
  // (counting anything already saved of that value).
  function tapActive(id){
    if(T.cpu||T.rollsUsed===0) return;
    const d=T.dice.find(x=>x.id===id);
    const willSelect=!d.selected;
    T.dice.forEach(x=>{ if(x.zone==='active'&&x.value===d.value) x.selected=willSelect; });
    autoCommit(); checkBonusChimes(); renderPlay();
  }
  function tapSaved(id){
    if(T.cpu) return;
    const d=T.dice.find(x=>x.id===id); const v=d.value; d.zone='active'; d.selected=false;
    const rest=T.dice.filter(x=>x.zone==='saved'&&x.value===v);
    if(rest.length<3) rest.forEach(x=>{x.zone='active'; x.selected=false;});
    renderPlay();
  }
  function doRoll(){
    if(T.rollsUsed>=3) return;
    T.dice.forEach(d=>{ if(d.zone==='active') d.selected=false; });
    const act=active();
    if(T.rollsUsed>0 && act.length===0){ toast('All dice saved — Score it!'); return; }
    act.forEach(d=>d.value=rndFace()); T.rollsUsed++; renderPlay(true);
    animateRollFaces();
  }
  let rollFxTimers=[];
  function clearRollFx(){ rollFxTimers.forEach(clearTimeout); rollFxTimers=[]; }
  function animateRollFaces(){
    if(reduceMotion || (typeof self!=='undefined'&&self.__CR_NOFX)) return;
    clearRollFx();
    const imgs=[...document.querySelectorAll('#rollGrid .die.rolling img')];
    if(!imgs.length) return;
    const ticks=4, step=95;
    imgs.forEach((imgEl)=>{
      const color=(imgEl.alt||'blue ').split(' ')[0]; const finalSrc=imgEl.src;
      for(let t=0;t<ticks;t++){
        rollFxTimers.push(setTimeout(()=>{ if(imgEl.isConnected){ const arr=DICE_IMG[color]||[]; imgEl.src=arr[Math.floor(Math.random()*6)]||finalSrc; } }, t*step));
      }
      rollFxTimers.push(setTimeout(()=>{ if(imgEl.isConnected) imgEl.src=finalSrc; }, ticks*step));
    });
  }
  function scoreIt(){
    if(T.rollsUsed===0) return;
    bankTurn();
  }
  function bankTurn(){
    const sc={}; saved().forEach(d=>sc[d.value]=(sc[d.value]||0)+1);
    const ab={}; active().forEach(d=>(ab[d.value]=ab[d.value]||[]).push(d));
    for(const v in ab){ if((sc[v]||0)+ab[v].length>=3) ab[v].forEach(d=>{d.zone='saved'; d.selected=false;}); }
    checkBonusChimes();
    const res=scoreDice(saved()); const unit=curUnit();
    const values=res.sets.map(s=>s.base+s.cb).filter(v=>v>0);
    renderPlay();
    const finish=()=>{
      unit.history[G.round]=(unit.history[G.round]||0)+res.total;
      G.qIdx++;
      if(G.qIdx<G.queue.length) beginTurn(); else resolveRound();
    };
    flyScores(values, unit, finish);
  }
  function flyScores(values, unit, done){
    const box=$('pointsBox');
    const lines=[...box.querySelectorAll('.pp-line')].filter(l=>/^\d+$/.test(l.textContent)&&l.textContent!=='0');
    const card=$('cards').querySelector('.card.active')||$('cards').querySelector('.card');
    const target=card&&card.querySelector('.ctot');
    const instant = reduceMotion || (typeof self!=='undefined'&&self.__CR_NOFX) || !target || values.length===0
                    || typeof target.getBoundingClientRect!=='function';
    if(instant){ values.forEach(v=>{unit.score+=v;}); renderCards(); if(values.length) playSfx('add'); done(); return; }
    const tr=target.getBoundingClientRect();
    const tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
    let remaining=values.length;
    values.forEach((v,i)=>{
      const srcEl=lines[i]||box; const sr=srcEl.getBoundingClientRect();
      const sx=sr.left+sr.width/2, sy=sr.top+sr.height/2;
      const fly=el('div','fly-num'); fly.textContent='+'+v;
      fly.style.left=sx+'px'; fly.style.top=sy+'px'; document.body.appendChild(fly);
      const dx=tx-sx, dy=ty-sy;
      try{ fly.animate([
        {transform:'translate(-50%,-50%) scale(1)', opacity:1, offset:0},
        {transform:'translate(calc(-50% + '+(dx*0.5)+'px), calc(-50% + '+(dy*0.5)+'px)) scale(1.08)', opacity:1, offset:.55},
        {transform:'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px)) scale(.35)', opacity:0, offset:1}
      ], {duration:640, delay:i*140, easing:'cubic-bezier(.45,0,.55,1)'}); }catch(e){}
      setTimeout(()=>{ fly.remove(); unit.score+=v; renderCards(); playSfx('add'); if(--remaining<=0) done(); }, 640+i*140);
    });
  }

  // The device user watches from here once they're eliminated but the CPUs still have
  // rounds to play (activeUnits().length>1 — once it drops to 1, doElimination() goes
  // straight to goWinner() with nothing left to fast-forward through). Only asks once
  // per game: spectatorChoiceMade sticks whichever way they answered.
  function updateSpectatorPrompt(){
    const ov=$('spectatorOverlay'); if(!ov) return;
    const offerChoice = setupMode==='cpu' && G.phase!=='over' && G.units[0] && !G.units[0].active && activeUnits().length>1 && !spectatorChoiceMade;
    const showOverlay = offerChoice || spectatorFastForward;
    ov.style.display = showOverlay ? 'flex' : 'none';
    $('spectatorChoice').style.display = offerChoice ? 'flex' : 'none';
    $('spectatorFF').style.display = spectatorFastForward ? 'flex' : 'none';
    const ra=$('rollArea'); if(ra) ra.classList.toggle('spectator-active', showOverlay);
  }
  function renderPlay(animate){
    updateSpectatorPrompt();
    renderCards();
    const sc=scoreDice(saved());
    const grid=$('savedGrid'); grid.innerHTML='';
    const pbox=$('pointsBox'); pbox.innerHTML='';
    const sets=sc.sets;
    // Renders one .srow (+ one .pp-line) per set, except a set of 8+ dice — which can
    // only happen with both equipped colors present, since one color half-set caps at
    // 6 — splits across 2 lines exactly at the color-group boundary, so same-colored
    // dice always stay together and neither line ever needs more than 6 columns. The
    // combined score is shown once, on the first line; the second line's points slot is
    // left blank rather than repeating the number.
    function buildLine(groups){
      const dice=groups.flat();
      const cols=Math.max(6, dice.length);
      const row=el('div','srow');
      groups.forEach(group=>{
        if(group.length>=3){
          const box=el('div','bonus-box'); box.style.gridColumn='span '+group.length;
          box.appendChild(el('div','bonus-frame'));
          group.forEach(d=>{ const de=dieEl(d.color,d.value); de.onclick=()=>tapSaved(d.id); box.appendChild(de); });
          row.appendChild(box);
        } else {
          group.forEach(d=>{ const de=dieEl(d.color,d.value); de.onclick=()=>tapSaved(d.id); row.appendChild(de); });
        }
      });
      for(let k=0;k<Math.max(0,cols-dice.length);k++) row.appendChild(el('div','slot'));
      row.style.setProperty('--cols', cols);
      return row;
    }
    if(sets.length===0){
      // Starts at a single placeholder row when nothing's saved yet, rather than
      // reserving space for rounds that haven't happened yet.
      const row=el('div','srow'); for(let k=0;k<6;k++) row.appendChild(el('div','slot'));
      row.style.setProperty('--cols', 6); grid.appendChild(row);
      const pl=el('div','pp-line empty'); pl.textContent='0'; pbox.appendChild(pl);
    } else {
      sets.forEach(s=>{
        const dice=saved().filter(d=>d.value===s.value); // blue ids before red -> color groups contiguous
        const groups=[]; let i=0;
        while(i<dice.length){ let j=i; while(j<dice.length && dice[j].color===dice[i].color) j++; groups.push(dice.slice(i,j)); i=j; }
        // dice.length>=8 is only reachable with 2 color groups present (one color alone
        // tops out at 6), so this always splits cleanly into exactly 2 lines.
        const lines = dice.length>=8 ? groups.map(g=>[g]) : [groups];
        lines.forEach((groupsInLine, li)=>{
          grid.appendChild(buildLine(groupsInLine));
          const pl=el('div','pp-line'+(li===0?'':' empty'));
          pl.textContent = li===0 ? (s.base+s.cb) : '';
          pbox.appendChild(pl);
        });
      });
    }
    // Set on the root (not just pbox) so the roll area's dice — a sibling branch of
    // the DOM, not a descendant of the saved-dice board — can match this same size.
    const dieRef=grid.querySelector('.slot, .die');
    if(dieRef) document.documentElement.style.setProperty('--die-size', dieRef.getBoundingClientRect().height+'px');

    const rg=$('rollGrid'); rg.innerHTML=''; const hint=$('rollHint');
    if(T.rollsUsed===0){
      hint.style.display='flex';
      $('rollHintBig').textContent=T.cpu?('🤖 '+curPerson().name):'Tap ROLL to start';
      $('rollHintSm').textContent=T.cpu?'Computer is rolling…':(curPerson().name+"'s turn · roll all 12 dice");
      active().forEach(d=>{ const w=el('div','roll-die-wrap'); w.style.opacity='.85'; w.appendChild(dieEl(d.color,d.value)); rg.appendChild(w); });
    } else {
      hint.style.display='none';
      const act=active(); const selByVal={};
      act.forEach(d=>{ if(d.selected)(selByVal[d.value]=selByVal[d.value]||[]).push(d); });
      act.forEach((d,i)=>{
        const w=el('div','roll-die-wrap');
        if(d.selected){
          const willForm=(savedCountVal(d.value)+(selByVal[d.value]?selByVal[d.value].length:0))>=3;
          w.classList.add(willForm?'sel':'pending');
        }
        const de=dieEl(d.color,d.value, animate&&!reduceMotion); de.onclick=()=>tapActive(d.id);
        if(animate&&!reduceMotion) de.style.animationDelay=(i*38)+'ms';
        w.appendChild(de); rg.appendChild(w);
      });
      if(act.length===0){ hint.style.display='flex'; $('rollHintBig').textContent='All dice saved!'; $('rollHintSm').textContent='Tap SCORE IT! to bank '+sc.total+' pts'; }
    }
    const rollArea=$('rollArea');
    if(rollArea) rollArea.classList.toggle('compact', active().length<=6);

    const rollBtn=$('rollBtn'), scoreBtn=$('scoreBtn');
    const canRoll=T.rollsUsed<3 && active().length>0;
    rollBtn.disabled=!canRoll;
    // "Rolls - N left" (even at 0) instead of a separate "No rolls left" string —
    // one consistent one-line label instead of a longer phrase that used to wrap.
    rollBtn.innerHTML = T.rollsUsed===0?'Roll' : ('Rolls<span class="btn-sub"> - '+Math.max(0,3-T.rollsUsed)+' left</span>');
    // Stays inactive until the turn is actually done: all 3 rolls used, or nothing
    // left to roll because every die is already saved.
    scoreBtn.disabled = T.rollsUsed<3 && active().length>0;
    scoreBtn.innerHTML = T.rollsUsed===0?'Score it!' : ('Score it!<span class="btn-sub"> - '+sc.total+'</span>');
    const tip=$('keepTip');
    tip.textContent = T.rollsUsed===0?'' : (saved().length===0?'Tap matching dice (3+ of a symbol) to save them':'Saved dice are safe. Tap a saved die to send it back.');
    if(T.cpu){ rollBtn.disabled=true; scoreBtn.disabled=true; tip.textContent='🤖 '+curPerson().name+' is playing…'; }
  }

  // A phone's card column only has room to show ~5 rounds of history before it needs
  // to scroll; a tablet-class viewport (wide AND tall — an iPad in portrait, say) has
  // enough spare vertical room in the cards row to show more at once. Kept in sync
  // with the max-height bump on .card .chist in app.css.
  function roundsShown(){
    return (window.matchMedia && window.matchMedia('(min-width:600px) and (min-height:700px)').matches) ? 8 : 5;
  }
  function renderCards(){
    const wrap=$('cards'); wrap.innerHTML=''; const cu=curUnit();
    // Trailing window of the last N rounds (ending at the current round, even if it's
    // still in progress) instead of always starting at round 1 — keeps the scoreboard
    // showing what's actually relevant once a game runs past N rounds.
    const N=roundsShown(), maxRow=Math.max(N,G.round), startRow=Math.max(1, maxRow-N+1);
    const idx=u=>G.units.indexOf(u);
    // active players first (original order); eliminated pushed to the right, best finishing place nearest
    const order=[...G.units].sort((a,b)=>{
      if(a.active!==b.active) return a.active?-1:1;
      if(a.active) return idx(a)-idx(b);
      return (a.place||99)-(b.place||99);
    });
    const elimPhase = G.phase==='elimination' || G.phase==='over';
    order.forEach(u=>{
      const card=el('div','card'+(u.active?'':' out')+(u.active&&cu&&u.id===cu.id?' active':'')+(elimPhase&&u.active?' elim':''));
      const av=el('div','cav');
      if(u.image){ av.style.backgroundImage='url('+u.image+')'; }
      else { av.style.background=u.color; av.textContent=initials(u.name); }
      const nm=el('div','cname'); nm.textContent=(u.isCPU?'🤖 ':'')+u.name;
      const tot=el('div','ctot'); tot.textContent=u.score;
      card.appendChild(av); card.appendChild(nm); card.appendChild(tot);
      if(!u.active){ const o=el('div','placetag'); o.textContent=u.place?(ordinal(u.place)+' place'):'Out'; card.appendChild(o); }
      const hist=el('div','chist');
      for(let r=startRow;r<=maxRow;r++){
        const hr=el('div','hrow'+(u.history[r]==null?' blank':''));
        const hn=el('span','hn'); hn.textContent=r;
        const hp=el('span','hp'); hp.textContent=u.history[r]!=null?u.history[r]:'—';
        hr.appendChild(hn); hr.appendChild(hp); hist.appendChild(hr);
      }
      card.appendChild(hist); wrap.appendChild(card);
    });
    pageCardsToActive();
    updateCardsScroll();
  }

  // Two-page behavior instead of centering the active card on every turn: stay
  // scrolled all the way left through however many players actually fit on screen
  // (4 on most phones, fewer on a narrow one), then jump to show the rest once the
  // active player is the first one that didn't fit (5th, or 4th if only 3 fit, etc).
  // Recomputed from the live card width each render, so it self-adjusts to any
  // screen size rather than hard-coding "4 vs 5".
  function pageCardsToActive(){
    const cards=Array.from(cardsEl.children);
    const activeIdx=cards.findIndex(c=>c.classList.contains('active'));
    if(activeIdx===-1||!cards.length) return;
    const cw=cardsEl.clientWidth, cardW=cards[0].getBoundingClientRect().width;
    const gap=parseFloat(getComputedStyle(cardsEl).columnGap)||0;
    const perPage=Math.max(1, Math.floor((cw+gap)/(cardW+gap)));
    const target=activeIdx>=perPage ? (cardsEl.scrollWidth-cw) : 0;
    cardsEl.scrollTo({left:target, behavior:'smooth'});
  }

  $('rollBtn').onclick=()=>{ if(T&&T.cpu) return; doRoll(); };
  $('scoreBtn').onclick=()=>{ if(T&&T.cpu) return; scoreIt(); };
  $('rollHint').onclick=()=>{ if(T&&(T.cpu||T.rollsUsed!==0)) return; doRoll(); };
  $('menuBtn').onclick=openMenu;
  $('showFinalScoreBtn').onclick=()=>{
    spectatorChoiceMade=true; spectatorFastForward=true;
    // Fast enough to blow through several remaining rounds in a few seconds, but not
    // so extreme (e.g. sub-30ms) that CPU turn timers start piling up on a slower
    // device — deliberately conservative given how timing-sensitive this turn chain
    // already is.
    if(typeof self!=='undefined') self.__CR_SPEED=0.12;
    updateSpectatorPrompt();
  };
  $('letPlayersFinishBtn').onclick=()=>{
    spectatorChoiceMade=true;
    updateSpectatorPrompt();
  };

  // ----- Scorecards slider (shown when cards overflow) -----
  const cardsEl=$('cards'), scrollEl=$('cardsScroll'), thumbEl=$('cardsThumb');
  function updateCardsScroll(){
    const sw=cardsEl.scrollWidth, cw=cardsEl.clientWidth;
    if(sw<=cw+2){ scrollEl.classList.remove('show'); return; }
    scrollEl.classList.add('show');
    const trackW=scrollEl.clientWidth||cw;
    const thumbW=Math.max(34, trackW*cw/sw);
    thumbEl.style.width=thumbW+'px';
    const maxScroll=sw-cw, maxThumb=trackW-thumbW;
    thumbEl.style.left=((maxScroll>0?cardsEl.scrollLeft/maxScroll:0)*maxThumb)+'px';
  }
  cardsEl.addEventListener('scroll', updateCardsScroll);
  window.addEventListener('resize', updateCardsScroll);
  // Re-render on rotate/resize so roundsShown()'s viewport check (phone vs tablet-class
  // window) takes effect immediately instead of only on the next turn's own render.
  window.addEventListener('resize', ()=>{ if(T) renderCards(); });
  let sdrag=false, sx=0, sscroll=0;
  thumbEl.addEventListener('pointerdown', e=>{ sdrag=true; sx=e.clientX; sscroll=cardsEl.scrollLeft; try{thumbEl.setPointerCapture(e.pointerId);}catch(_){}; e.preventDefault(); });
  thumbEl.addEventListener('pointermove', e=>{ if(!sdrag) return;
    const sw=cardsEl.scrollWidth, cw=cardsEl.clientWidth, trackW=scrollEl.clientWidth, thumbW=thumbEl.offsetWidth;
    const maxThumb=trackW-thumbW, maxScroll=sw-cw, ratio=maxThumb>0?maxScroll/maxThumb:0;
    cardsEl.scrollLeft=sscroll+(e.clientX-sx)*ratio; });
  const endDrag=()=>{ sdrag=false; };
  thumbEl.addEventListener('pointerup', endDrag); thumbEl.addEventListener('pointercancel', endDrag);
  scrollEl.addEventListener('pointerdown', e=>{ if(e.target===thumbEl) return;
    const rect=scrollEl.getBoundingClientRect(), x=e.clientX-rect.left;
    const sw=cardsEl.scrollWidth, cw=cardsEl.clientWidth, trackW=scrollEl.clientWidth, thumbW=thumbEl.offsetWidth;
    const t=(x-thumbW/2)/((trackW-thumbW)||1); cardsEl.scrollLeft=Math.max(0,Math.min(1,t))*(sw-cw); });

  function resolveRound(){
    if(G.phase==='regular'){
      if(activeUnits().some(u=>u.score>=G.threshold)){ G.phase='elimination'; announceElim(); return; }
      G.round++; startRound();
    } else { doElimination(); }
  }

  function grip(){ return el('div','grip'); }
  function openOv(){ $('overlay').classList.add('active'); }
  // The Profile sheet (opened from the header avatar) can spend coins mid-game — keep
  // the header's own balance in sync whenever the sheet closes back to an active turn,
  // the same way beginTurn() sets it at the start of each turn.
  function closeOv(){ $('overlay').classList.remove('active'); if(T && $('play').classList.contains('active')) $('hCoinBalance').textContent='🪙 '+Coins.getBalance(); }
  $('overlay').addEventListener('click',e=>{ if(e.target===$('overlay')) closeOv(); });

  function openMenu(){
    const s=$('sheet'); s.innerHTML=''; s.appendChild(grip());
    const h=el('h2'); h.textContent='Standings'; s.appendChild(h);
    const sub=el('div','sub'); sub.textContent=G.phase==='elimination'?'Lowest total is knocked out each round.':'First to '+G.threshold+' pts starts elimination.'; s.appendChild(sub);
    standingsList(s);
    const rb=el('button','btn-link'); rb.textContent='How to play'; rb.onclick=openRules; s.appendChild(rb);
    const fsBtn=el('button','btn-link');
    const isFs=()=>!!document.fullscreenElement;
    fsBtn.textContent=isFs()?'Exit full screen':'Full screen';
    fsBtn.onclick=()=>{
      if(isFs()){ document.exitFullscreen().catch(()=>{}); }
      else if(document.documentElement.requestFullscreen){ document.documentElement.requestFullscreen().catch(()=>toast('Full screen not supported here')); }
      else { toast('Full screen not supported here'); }
      setTimeout(()=>{ fsBtn.textContent=isFs()?'Exit full screen':'Full screen'; },200);
    };
    s.appendChild(fsBtn);
    const nb=el('button','btn-link'); nb.textContent='New game'; nb.onclick=()=>{ if(confirm('End this game and start over?')){ T=null; forceStopSix(); spectatorFastForward=false; if(typeof self!=='undefined') self.__CR_SPEED=1; closeOv(); show('setup'); } }; s.appendChild(nb);
    const cb=el('button','btn-link'); cb.textContent='Close'; cb.onclick=closeOv; s.appendChild(cb);
    openOv();
  }
  function standingsList(s){
    const ranked=[...G.units].sort((a,b)=>{
      if(a.active!==b.active) return a.active?-1:1;
      if(a.active) return b.score-a.score;
      return (a.place||99)-(b.place||99);
    });
    let rank=1;
    ranked.forEach(u=>{
      const it=el('div','si'+(u.active?'':' out')+(u.active&&rank===1?' lead':''));
      const rk=el('div','rk'); rk.textContent = u.active ? ('#'+rank) : ordinal(u.place||0);
      const nm=el('div','nm'); nm.textContent=(u.isCPU?'🤖 ':'')+u.name;
      if(!u.active){ const sm=el('small'); sm.textContent='Eliminated · '+ordinal(u.place||0)+' place'; nm.appendChild(sm); }
      const sc=el('div','sc'); sc.textContent=u.score;
      it.appendChild(rk); it.appendChild(nm); it.appendChild(sc); s.appendChild(it);
      if(u.active) rank++;
    });
  }

  function announceElim(){
    const s=$('sheet'); s.innerHTML=''; s.appendChild(grip());
    const h=el('h2'); h.textContent='⚔️ Elimination!'; s.appendChild(h);
    const n=activeUnits().length, per=n>6?'two lowest totals are':'lowest total is';
    const sub=el('div','sub'); sub.innerHTML='Someone reached '+G.threshold+' points. From here, every player'+
      ' plays a full round, then the '+per+' knocked out. Last one standing wins.';
    s.appendChild(sub);
    const b=el('button','btn-green'); b.textContent='Begin elimination round'; b.onclick=()=>{ closeOv(); G.round++; startRound(); }; s.appendChild(b);
    openOv();
  }

  function doElimination(){
    const units=activeUnits(); let count=units.length>6?2:1; if(count>=units.length) count=units.length-1;
    const {toElim,log}=resolveElimination(count);
    const K=activeUnits().length; // players still in, before removing these
    toElim.slice().sort((a,b)=>a.score-b.score).forEach((u,i)=>{ u.place=K-i; }); // worst score -> worst place
    toElim.forEach(u=>u.active=false);
    showElimResult(toElim,log);
  }
  function resolveElimination(count){
    const toElim=[], log=[]; let guard=0;
    while(toElim.length<count){
      if(++guard>500) break;
      const remaining=activeUnits().filter(u=>!toElim.includes(u));
      if(remaining.length<=1) break;
      const slots=count-toElim.length;
      const low=Math.min(...remaining.map(u=>u.score));
      const group=remaining.filter(u=>u.score===low);
      if(group.length<=slots){ group.forEach(u=>toElim.push(u)); }
      else { const {losers,rlog}=runRollOff(group,slots); rlog.reason='Tie at '+low+' pts'; log.push(rlog); losers.forEach(u=>toElim.push(u)); break; }
    }
    return {toElim,log};
  }
  function runRollOff(group,numLosers){
    const [ownerColorA,ownerColorB]=Coins.getEquippedColors();
    const rolls=group.map(u=>{
      const [colorA,colorB]=u.isCPU ? CPU_DICE_COLORS : [ownerColorA,ownerColorB];
      const dice=[];
      for(let i=0;i<6;i++)dice.push({color:colorA,value:rndFace()});
      for(let i=0;i<6;i++)dice.push({color:colorB,value:rndFace()});
      return {unit:u,dice,score:scoreDice(dice).total};
    });
    const rlog={rounds:[rolls]}; const losers=[]; let guard=0;
    while(losers.length<numLosers){
      if(++guard>500) break;
      const need=numLosers-losers.length;
      const pool=rolls.filter(r=>!losers.includes(r));
      const low=Math.min(...pool.map(r=>r.score));
      const tied=pool.filter(r=>r.score===low);
      if(tied.length<=need) tied.forEach(r=>losers.push(r));
      else { const sub=runRollOff(tied.map(t=>t.unit),need); rlog.rounds=rlog.rounds.concat(sub.rlog.rounds);
        sub.losers.forEach(u=>losers.push(rolls.find(r=>r.unit===u))); break; }
    }
    return {losers:losers.map(l=>l.unit), rlog};
  }
  function showElimResult(elim,log){
    const s=$('sheet'); s.innerHTML=''; s.appendChild(grip());
    const h=el('h2'); h.textContent='Knocked out'; s.appendChild(h);
    const sub=el('div','sub'); sub.textContent=elim.map(u=>u.name).join(' and ')+(elim.length>1?' are out.':' is out.'); s.appendChild(sub);
    if(log&&log.length){ log.forEach(ro=>{
      const note=el('div','sub'); note.style.color='#b8792a'; note.style.margin='0 0 10px'; note.textContent='🎲 Roll-off ('+(ro.reason||'tie')+')'; s.appendChild(note);
      ro.rounds.forEach(rr=>{ rr.slice().sort((a,b)=>a.score-b.score).forEach(r=>{
        const it=el('div','si'); const nm=el('div','nm'); nm.textContent=r.unit.name;
        const dr=el('div','ro-dice'); r.dice.forEach(d=>{
          const md=el('span','md '+d.color);
          const img=el('img'); img.src=(DICE_IMG[d.color]||[])[d.value-1]||''; img.alt=d.color+' die'; img.draggable=false;
          md.appendChild(img); dr.appendChild(md);
        }); nm.appendChild(dr);
        const sc=el('div','sc'); sc.textContent=r.score; it.appendChild(nm); it.appendChild(sc); s.appendChild(it);
      }); });
    }); }
    const still=activeUnits();
    const b=el('button','btn-green');
    const baseLabel=still.length<=1?'See the winner':'Next elimination round';
    const action=still.length<=1
      ? ()=>{ closeOv(); goWinner(still[0]); }
      : ()=>{ closeOv(); G.round++; startRound(); };
    b.textContent=baseLabel;
    b.onclick=()=>{ clearElimCountdown(); action(); };
    s.appendChild(b);
    openOv();
    if(spectatorFastForward){
      // "Show Final Score" was picked — don't sit on the normal 5s countdown for every
      // remaining elimination, just flash the result briefly and keep moving.
      setTimeout(()=>{ clearElimCountdown(); action(); }, cpuDelay(300));
    }
    // User vs CPU games auto-advance past this prompt after 5s so a long string of CPU
    // eliminations doesn't need a tap every time — Challenge (real humans passing the
    // device) and Scoreboard never set setupMode to 'cpu', so they're unaffected.
    else if(setupMode==='cpu') startElimCountdown(b, baseLabel, action);
  }
  let elimCountdownTimer=null;
  function clearElimCountdown(){ if(elimCountdownTimer){ clearInterval(elimCountdownTimer); elimCountdownTimer=null; } }
  function startElimCountdown(btn, baseLabel, action){
    clearElimCountdown();
    let secs=5;
    btn.textContent=baseLabel+' ('+secs+')';
    elimCountdownTimer=setInterval(()=>{
      // The sheet can also be dismissed by tapping the dark backdrop (closeOv() without
      // running action()) — stop ticking rather than firing the action against a
      // screen the player already left.
      if(!$('overlay').classList.contains('active')){ clearElimCountdown(); return; }
      secs--;
      if(secs<=0){ clearElimCountdown(); action(); return; }
      btn.textContent=baseLabel+' ('+secs+')';
    }, 1000);
  }

  // Mirrors flyScores()'s technique (a fixed-position clone animated via the Web
  // Animations API from a source element to a target's screen position) — generic so
  // it works for a coin flying either direction (payout up to a balance, or a purchase
  // down to a button); the caller decides what "landing" means via done(). Shared by
  // Shop (purchases), PickGame (buy-ins), and this file's own winner-payout flow.
  function flyCoinBubble(fromEl, toEl, label, done){
    const instant = reduceMotion || !fromEl || !toEl
      || typeof fromEl.getBoundingClientRect!=='function' || typeof toEl.getBoundingClientRect!=='function';
    if(instant){ if(done) done(); return; }
    const tr=toEl.getBoundingClientRect(); const tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
    const sr=fromEl.getBoundingClientRect(); const sx=sr.left+sr.width/2, sy=sr.top+sr.height/2;
    const fly=el('div','fly-coin'); fly.textContent=label;
    fly.style.left=sx+'px'; fly.style.top=sy+'px'; document.body.appendChild(fly);
    const dx=tx-sx, dy=ty-sy;
    try{ fly.animate([
      {transform:'translate(-50%,-50%) scale(1)', opacity:1, offset:0},
      {transform:'translate(calc(-50% + '+(dx*0.5)+'px), calc(-50% + '+(dy*0.5)+'px)) scale(1.08)', opacity:1, offset:.55},
      {transform:'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px)) scale(.35)', opacity:0, offset:1}
    ], {duration:640, easing:'cubic-bezier(.45,0,.55,1)'}); }catch(e){}
    setTimeout(()=>{ fly.remove(); if(done) done(); }, 640);
  }
  // Payout-specific wrapper: flies from a winner-screen row up to the header's own
  // coin balance. The coins are credited to storage immediately (synchronously, before
  // the animation even starts) rather than only on the animation's completion callback
  // — a payout that only lands once a 640ms timer fires can be silently lost if the
  // app is backgrounded/interrupted right as the winner screen appears (common on a
  // phone — a notification, a screen lock, a quick app switch), which was reported as
  // "I won coins but never saw them added." The header text still starts at the old
  // balance and only flips to the new one once the bubble lands, so the fly-up visual
  // is unchanged — only the underlying credit's timing became safe.
  function flyCoinToBalance(fromEl, amount, done){
    const target=$('winHdrCoinBalance');
    Coins.add(amount);
    flyCoinBubble(fromEl, target, '🪙 +'+amount, () => {
      target.textContent='🪙 '+Coins.getBalance();
      playSfx('add'); if(done) done();
    });
  }

  function goWinner(u){
    // Same deferral as beginTurn() — don't jump to the winner screen out from under a
    // still-playing Color Run celebration.
    if(sixActive){ sixDoneCallbacks.push(()=>goWinner(u)); return; }
    // The fast-forward speed boost (see spectatorFastForward) only ever needs to last
    // until a winner is decided — reset it here rather than leaving it applied into
    // whatever the player does next (Play Again, a fresh game, etc).
    spectatorFastForward=false;
    if(typeof self!=='undefined') self.__CR_SPEED=1;
    G.phase='over'; if(u) u.place=1;
    const owner=G.units.find(x=>x.isOwner);
    if(owner) Stats.recordGameEnd(owner.score, u===owner);
    $('winName').textContent=u?u.name:'—'; $('winScore').textContent=u?(u.score+' points'):'';

    // Coin payouts only exist in User vs CPU games (setupMode==='cpu') — Challenge is
    // free and Scoreboard Mode never touches coins at all, so the whole section stays
    // hidden for those. Every placement that earns a payout is listed, not just the
    // device user's — the bubble/fly-to-balance treatment is what's specific to them.
    const section=$('winCoinSection'), list=$('winCoinList');
    list.innerHTML='';
    if(setupMode==='cpu'){
      section.style.display='flex';
      const payoutMult=doubleAction?2:1; doubleAction=false;
      const standings=G.units.slice().sort((a,b)=>(a.place||99)-(b.place||99));
      let meRow=null, mePayout=0;
      standings.forEach(unitEntry=>{
        const payout=Coins.payoutFor(G.units.length, unitEntry.place)*payoutMult;
        if(payout<=0) return;
        const row=el('div','win-coin-row'+(unitEntry.isDeviceUser?' me':''));
        const place=el('span','wcr-place'); place.textContent=ordinal(unitEntry.place);
        const name=el('span','wcr-name'); name.textContent=unitEntry.name;
        const pay=el('span','wcr-payout'); pay.textContent='🪙 '+payout;
        row.appendChild(place); row.appendChild(name); row.appendChild(pay);
        list.appendChild(row);
        if(unitEntry.isDeviceUser){ meRow=row; mePayout=payout; }
      });
      show('winner'); chipRain(); playSfx('fanfare');
      if(meRow && mePayout>0) flyCoinToBalance(meRow.querySelector('.wcr-payout'), mePayout);
    } else {
      section.style.display='none';
      show('winner'); chipRain(); playSfx('fanfare');
    }
  }
  $('playAgainBtn').onclick=()=>{ show('modeselect'); ModeSelect.refresh(); };
  $('finalScoreBtn').onclick=()=>{ const s=$('sheet'); s.innerHTML=''; s.appendChild(grip());
    const h=el('h2'); h.textContent='Final standings'; s.appendChild(h); standingsList(s);
    const cb=el('button','btn-link'); cb.textContent='Close'; cb.onclick=closeOv; s.appendChild(cb); openOv(); };

  function chipRain(){
    if(reduceMotion) return;
    const colors=['red','blue'];
    // Tuned so every piece has landed (or nearly has) by ~3s: dur maxes at 2400 and
    // delay maxes at 500, so the very last piece finishes around 2900ms.
    for(let i=0;i<26;i++){
      const chip=el('img','chip-rain'); chip.src=CHIP_IMG[colors[i%2]]; chip.alt='';
      const size=30+Math.random()*20;
      chip.style.width=size+'px'; chip.style.height=size+'px'; chip.style.left=Math.random()*100+'vw';
      document.body.appendChild(chip);
      const dur=1700+Math.random()*700, delay=Math.random()*500, startRot=Math.random()*360;
      chip.animate([
        {transform:'translateY(-60px) rotate('+startRot+'deg)', opacity:1},
        {transform:'translateY(106vh) rotate('+(startRot+180+Math.random()*360)+'deg)', opacity:.95}
      ],{duration:dur, delay:delay, easing:'cubic-bezier(.4,.15,.6,1)'});
      setTimeout(()=>chip.remove(), dur+delay+80);
    }
  }

  function openRules(){
    const s=$('sheet'); s.innerHTML=''; s.appendChild(grip());
    const h=el('h2'); h.textContent='How to play'; s.appendChild(h);
    const b=el('div','rules'); b.innerHTML=`
      <h3>Goal</h3>
      <p>Score points by collecting matching sets of dice. When someone reaches the threshold, elimination begins and the lowest total is knocked out each round. Last one standing wins.</p>
      <h3>Your turn — 3 rolls</h3>
      <p>Tap <b>ROLL</b> to throw 12 dice (6 red, 6 blue). Tap matching dice to save a set of the same symbol — a set needs <b>3 or more</b>. Once three of a symbol are tapped they jump up to <b>Saved Dice</b>. Saved dice are safe; tap ROLL to re-roll the rest. You get three rolls, then tap <b>SCORE IT!</b> to bank.</p>
      <ul>
        <li>Colors don't matter for a basic set (two red spades + one blue spade = three spades).</li>
        <li>Once a set exists, more matching dice add straight to it.</li>
        <li>Tap a saved die to pull it back and gamble for a bigger set.</li>
      </ul>
      <h3>Scoring</h3>
      <p><b>5 points per die.</b> Plus a same-color bonus when 3+ dice share a shape <em>and</em> color:</p>
      <ul><li>Three of a color: <b>+10</b></li><li>Four of a color: <b>+25</b></li><li>Five of a color: <b>+40</b></li><li>Six of a color: <b>+100</b></li></ul>
      <p>Each color scores its own bonus, so three blue diamonds <em>and</em> three red diamonds earn both +10s. Each set's possible points show on the right.</p>
      <h3>Elimination</h3>
      <p>After the threshold is hit, everyone plays one more full round, then the lowest cumulative total is out. Ties for last are broken by a 12-dice roll-off. With more than six players in, two are knocked out per round.</p>`;
    s.appendChild(b);
    const cb=el('button','btn-link'); cb.textContent='Close'; cb.onclick=closeOv; s.appendChild(cb);
    openOv();
  }
