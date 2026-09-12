"use strict";
/*
  Real Google/Apple sign-in requires FIREBASE_ENABLED = true plus provider
  credentials configured in the Firebase console (see firebase-config.js). Until then,
  those buttons explain what's missing and point at "Continue as Guest" / email, which
  create a local-only account (localStorage) so the rest of the app — avatar, mode
  select, ads, paywall, Scoreboard Mode — is fully testable today.
*/
const Auth = (function(){
  const KEY = 'cr_user';
  let user = null;
  let creatingAccount = false;

  function load(){ try{ const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; } }
  function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(user)); }catch(e){} }

  function setUser(u){ user = u; persist(); }
  function patchUser(patch){ if(!user) return; Object.assign(user, patch); persist(); }

  function newLocalUser(fields){
    return Object.assign({
      uid: (fields.provider || 'guest') + '_' + Math.random().toString(36).slice(2, 10),
      provider: 'guest',
      name: 'Guest',
      email: null,
      avatar: null,          // {color, initials, name}
      scoreboardUnlocked: false
    }, fields);
  }

  function explainProviderUnavailable(kind){
    toast(kind + ' sign-in needs a Firebase project connected (see firebase-config.js). Try Guest for now.');
  }

  async function signInProvider(kind){
    if(FIREBASE_ENABLED){
      toast(kind + ' sign-in is wired for when your Firebase project is configured.');
      return;
    }
    explainProviderUnavailable(kind);
  }

  function signInEmail(email, password){
    if(FIREBASE_ENABLED){
      toast('Email sign-in is wired for when your Firebase project is configured.');
      return;
    }
    if(!email || password.length < 6){ toast('Enter a valid email and a 6+ character password'); return; }
    setUser(newLocalUser({ uid: 'email_' + btoa(unescape(encodeURIComponent(email))).replace(/=+$/, ''), provider: 'email', email, name: email.split('@')[0] }));
    afterSignIn();
  }

  function continueAsGuest(){
    setUser(newLocalUser({}));
    afterSignIn();
  }

  function signOut(){
    user = null;
    try{ localStorage.removeItem(KEY); }catch(e){}
    show('signin');
  }

  function afterSignIn(){
    Coins.ensureAccountAndDaily();
    if(user && user.avatar && user.avatar.name){
      show('mainmenu');
      MainMenu.refresh();
    } else {
      show('avatar');
      AvatarScreen.refresh();
    }
  }

  function toggleCreateMode(){
    creatingAccount = !creatingAccount;
    $('emailSubmitBtn').textContent = creatingAccount ? 'Create account' : 'Sign in';
    $('toggleAuthModeBtn').textContent = creatingAccount ? 'Already have an account? Sign in' : 'Need an account? Create one';
  }

  function init(){
    user = load();
    initFirebase();

    // A guest session created before the current SIGNUP_BONUS_GUEST/GUEST_BONUS_VERSION
    // is stuck on its old balance forever (guest uids are per-session random, so there's
    // no in-place migration) — drop it back to sign-in so "Continue as Guest" mints a
    // fresh uid and picks up the current bonus. Real accounts are never affected.
    if(user && user.provider === 'guest' && Coins.guestSessionIsStale(user.uid)){
      user = null;
      try{ localStorage.removeItem(KEY); }catch(e){}
    }

    $('gsiGoogle').onclick = () => signInProvider('Google');
    $('gsiApple').onclick = () => signInProvider('Apple');
    $('gsiGuest').onclick = continueAsGuest;
    $('toggleAuthModeBtn').onclick = toggleCreateMode;
    $('emailForm').onsubmit = (e) => {
      e.preventDefault();
      signInEmail($('emailInput').value.trim(), $('passInput').value);
    };

    if(user) afterSignIn();
  }

  return {
    init, signOut, afterSignIn, patchUser,
    get user(){ return user; }
  };
})();
