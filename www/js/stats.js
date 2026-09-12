"use strict";
/*
  Per-account stats: games played, wins, top score, average score, and Color Runs
  (landing a 6-of-a-kind same-color bonus — see triggerSix() in game.js). Guest
  accounts are intentionally excluded — isEligible() gates every read/write here.

  Stored per-uid in localStorage today; once FIREBASE_ENABLED is true this is the spot
  to mirror the same writes to users/{uid}.stats in Firestore instead (same shape).
*/
const Stats = (function(){
  const PREFIX='cr_stats_';
  const EMPTY=()=>({ gamesPlayed:0, wins:0, topScore:0, totalScore:0, colorRuns:0 });

  function isEligible(){
    const u=Auth.user;
    return !!(u && u.provider!=='guest');
  }

  function load(){
    if(!isEligible()) return null;
    try{ const raw=localStorage.getItem(PREFIX+Auth.user.uid); return raw?JSON.parse(raw):EMPTY(); }
    catch(e){ return EMPTY(); }
  }

  function save(s){
    if(!isEligible()) return;
    try{ localStorage.setItem(PREFIX+Auth.user.uid, JSON.stringify(s)); }catch(e){}
  }

  function recordColorRun(){
    if(!isEligible()) return;
    const s=load(); s.colorRuns+=1; save(s);
  }

  function recordGameEnd(score, won){
    if(!isEligible()) return;
    const s=load();
    s.gamesPlayed+=1;
    s.totalScore+=score;
    s.topScore=Math.max(s.topScore, score);
    if(won) s.wins+=1;
    save(s);
  }

  function get(){
    const s=load();
    if(!s) return null;
    return Object.assign({}, s, { average: s.gamesPlayed ? Math.round(s.totalScore/s.gamesPlayed) : 0 });
  }

  return { isEligible, recordColorRun, recordGameEnd, get };
})();
