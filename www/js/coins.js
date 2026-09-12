"use strict";
/*
  Coin economy — signup bonus, a once-a-day award, and buy-in/payout for standard
  games (Single Play today; Multiplayer/Challenge will use the same functions once
  their backend exists). Unlike Stats, this applies to guests too (just a smaller
  signup bonus and a fixed-timezone daily award instead of the device's own zone).

  Stored per-uid in localStorage today (see PREFIX below) — same "mirror to Firestore
  under users/{uid}.coins once FIREBASE_ENABLED" note as stats.js/scoreboard.js.
*/
const Coins = (function(){
  const PREFIX = 'cr_coins_';
  const SIGNUP_BONUS_GUEST = 500;
  const SIGNUP_BONUS_ACCOUNT = 300;
  // Bump this whenever SIGNUP_BONUS_GUEST changes and existing guest sessions should be
  // forced back to sign-in to pick up the new bonus on their next "Continue as Guest"
  // (a fresh uid, so a fresh coins record) — see Auth.init()'s guestSessionIsStale check.
  const GUEST_BONUS_VERSION = 2;
  const DAILY_AWARD = 50;
  const BUY_IN_STANDARD = 10;

  // Standard game (Single Play / Multiplayer / Challenge) payouts by player count.
  // Index 0 = 1st place, etc. A place beyond the array's length wins nothing.
  const STANDARD_PAYOUTS = {
    2: [15],
    3: [20],
    4: [20, 10],
    5: [25, 10, 5],
    6: [30, 15, 5],
    7: [35, 20, 5],
    8: [40, 20, 10]
  };

  // Tournament economy isn't wired to real gameplay yet — bracket play needs the same
  // online-rooms backend Multiplayer/Challenge are waiting on. Kept here so the
  // numbers are defined in one place for when that's built.
  const BUY_IN_TOURNAMENT = 20;
  const TOURNAMENT_STRUCTURE = {
    2: { totalPlayers: 16, rooms: 2, roomSize: 8, advancePerRoom: 4, finalSize: 8, buyIn: BUY_IN_TOURNAMENT, payouts: [160, 70, 40, 30] },
    3: { totalPlayers: 32, rooms: 4, roomSize: 8, advancePerRoom: 4,
         round2: { players: 16, rooms: 2, roomSize: 8, advancePerRoom: 4 },
         finalSize: 8, buyIn: BUY_IN_TOURNAMENT, payouts: [240, 100, 88, 60, 40, 30, 25, 20] }
  };

  // Half-sets are 6 dice of one color; a game is always played with exactly 2 colors
  // (6+6=12), so DEFAULT_COLORS is what every account starts with for free. Buying a
  // 3rd+ color just adds another option to swap into the equipped pair, it doesn't
  // change how many are equipped at once.
  // Order matters for equipColor()'s swap rule below: index 0 is what gets bumped out
  // first when a new color is equipped, so blue survives a first purchase and red
  // rotates out — matching "choose green and blue once you buy green" from red+blue.
  const DEFAULT_COLORS = ['blue', 'red'];

  function key(uid){ return PREFIX + uid; }

  // Fills in fields that didn't exist on a record created before this shape (e.g. last
  // pass's ownedDiceSkins/equippedDiceSkin, now replaced by the real color half-set
  // system) so old and new records both work without a separate migration step.
  const DEFAULT_BACKGROUND = 'wood';

  function normalize(rec){
    if(!rec.ownedColors) rec.ownedColors = DEFAULT_COLORS.slice();
    // Only backfill a genuinely missing/malformed field here — fewer than 2 equipped is
    // a real, intentional state now that unequipColor() exists (see hasValidLoadout()),
    // not something to silently correct back to the default pair.
    if(!Array.isArray(rec.equippedColors)) rec.equippedColors = DEFAULT_COLORS.slice();
    if(!rec.ownedFullSets) rec.ownedFullSets = []; // Premium/Platinum 12-dice sets — none exist yet
    if(rec.equippedFullSet === undefined) rec.equippedFullSet = null;
    if(!rec.ownedBackgrounds) rec.ownedBackgrounds = [DEFAULT_BACKGROUND];
    if(!rec.equippedBackground) rec.equippedBackground = DEFAULT_BACKGROUND;
    delete rec.ownedDiceSkins; delete rec.equippedDiceSkin;
    return rec;
  }

  function load(uid){
    try{ const raw = localStorage.getItem(key(uid)); return raw ? normalize(JSON.parse(raw)) : null; }catch(e){ return null; }
  }
  function save(uid, rec){ try{ localStorage.setItem(key(uid), JSON.stringify(rec)); }catch(e){} }

  function uidNow(){ return Auth.user ? Auth.user.uid : null; }
  function isGuestNow(){ return !Auth.user || Auth.user.provider === 'guest'; }

  // "Today" as a date string in the relevant zone, so the daily award rolls over at
  // local midnight for real accounts (the browser's own Date is already in the
  // device's zone) and at Pacific midnight specifically for guests, regardless of
  // their device's actual zone.
  function dateKey(guest){
    if(guest){
      try{ return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
      catch(e){ /* fall through to local date below if the zone lookup ever fails */ }
    }
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Call once per sign-in (Auth.afterSignIn already runs for both new and returning
  // accounts) — creates the record with the signup bonus the first time this uid is
  // ever seen, then checks/grants the daily award every time after that.
  function ensureAccountAndDaily(){
    const uid = uidNow(); if(!uid) return;
    const guest = isGuestNow();
    let rec = load(uid);
    if(!rec){
      rec = normalize({ balance: guest ? SIGNUP_BONUS_GUEST : SIGNUP_BONUS_ACCOUNT, lastDailyKey: dateKey(guest) });
      if(guest) rec.guestBonusVersion = GUEST_BONUS_VERSION;
      save(uid, rec);
      toast('Welcome! +' + rec.balance + ' coins');
      return;
    }
    const today = dateKey(guest);
    if(rec.lastDailyKey !== today){
      rec.balance += DAILY_AWARD;
      rec.lastDailyKey = today;
      save(uid, rec);
      toast('Daily bonus: +' + DAILY_AWARD + ' coins');
    }
  }

  // True if this guest uid's coins record predates the current GUEST_BONUS_VERSION —
  // Auth.init() uses this to force that one session back to sign-in so their next
  // "Continue as Guest" click (a fresh random uid) creates a fresh record with the
  // current SIGNUP_BONUS_GUEST instead of resuming the stale one.
  function guestSessionIsStale(uid){
    const rec = load(uid);
    return !!(rec && rec.guestBonusVersion !== GUEST_BONUS_VERSION);
  }

  function getBalance(){ const uid = uidNow(); if(!uid) return 0; const rec = load(uid); return rec ? rec.balance : 0; }
  function canAfford(n){ return getBalance() >= n; }

  function spend(n){
    const uid = uidNow(); if(!uid) return false;
    const rec = load(uid); if(!rec || rec.balance < n) return false;
    rec.balance -= n; save(uid, rec); return true;
  }
  function add(n){
    const uid = uidNow(); if(!uid) return;
    const rec = load(uid); if(!rec) return;
    rec.balance += n; save(uid, rec);
  }

  function payoutFor(playerCount, place){
    const table = STANDARD_PAYOUTS[playerCount]; if(!table) return 0;
    return table[place - 1] || 0;
  }

  // ---- shop: dice color half-sets (6 dice each; a game always equips exactly 2) ----
  function ownsColor(color){
    if(DEFAULT_COLORS.includes(color)) return true;
    const uid = uidNow(); if(!uid) return false;
    const rec = load(uid); return !!(rec && rec.ownedColors.includes(color));
  }
  function getOwnedColors(){
    const uid = uidNow(); if(!uid) return DEFAULT_COLORS.slice();
    const rec = load(uid); return rec ? rec.ownedColors.slice() : DEFAULT_COLORS.slice();
  }
  function getEquippedColors(){
    const uid = uidNow(); if(!uid) return DEFAULT_COLORS.slice();
    const rec = load(uid); return rec ? rec.equippedColors.slice() : DEFAULT_COLORS.slice();
  }
  // A user may only ever have 2 half-sets equipped at once (6+6=12 dice). Equipping
  // when fewer than 2 are on just adds the color; trying to equip a 3rd is refused
  // with a warning instead of silently swapping one out — the player has to
  // unequipColor() one themselves first. Tapping an already-equipped color is a no-op.
  function equipColor(color){
    const uid = uidNow(); if(!uid) return;
    const rec = load(uid); if(!rec || !rec.ownedColors.includes(color)) return;
    if(rec.equippedColors.includes(color)) return;
    if(rec.equippedColors.length >= 2){
      toast('You can only equip 2 dice colors — remove one first');
      return;
    }
    rec.equippedColors = rec.equippedColors.concat(color);
    save(uid, rec);
  }
  function unequipColor(color){
    const uid = uidNow(); if(!uid) return;
    const rec = load(uid); if(!rec) return;
    rec.equippedColors = rec.equippedColors.filter((c) => c !== color);
    save(uid, rec);
  }
  // Marks a color owned without touching the balance — the Shop already deducts the
  // cost via spend() and flies a coin bubble to the button before calling this, so
  // "you paid" and "you now own it" are two visibly separate moments.
  function grantColor(color){
    const uid = uidNow(); if(!uid) return;
    const rec = load(uid); if(!rec) return;
    if(!rec.ownedColors.includes(color)) rec.ownedColors.push(color);
    save(uid, rec);
  }
  // A game needs exactly 2 equipped half-set colors, or one full (Premium/Platinum)
  // set equipped instead — equippedFullSet exists in the record shape (see normalize())
  // for when those tiers get real catalog entries, so this check is already correct
  // for them even though nothing can equip one yet.
  function hasValidLoadout(){
    const uid = uidNow(); if(!uid) return true;
    const rec = load(uid); if(!rec) return true;
    return rec.equippedColors.length === 2 || !!rec.equippedFullSet;
  }

  // ---- shop: backgrounds (single equipped at a time — replaces the wood grain) ----
  function ownsBackground(id){
    if(id === DEFAULT_BACKGROUND) return true;
    const uid = uidNow(); if(!uid) return false;
    const rec = load(uid); return !!(rec && rec.ownedBackgrounds.includes(id));
  }
  function grantBackground(id){
    const uid = uidNow(); if(!uid) return;
    const rec = load(uid); if(!rec) return;
    if(!rec.ownedBackgrounds.includes(id)) rec.ownedBackgrounds.push(id);
    save(uid, rec);
  }
  function equipBackground(id){
    const uid = uidNow(); if(!uid) return;
    const rec = load(uid); if(!rec || !rec.ownedBackgrounds.includes(id)) return;
    rec.equippedBackground = id; save(uid, rec);
  }
  function getEquippedBackground(){
    const uid = uidNow(); if(!uid) return DEFAULT_BACKGROUND;
    const rec = load(uid); return (rec && rec.equippedBackground) || DEFAULT_BACKGROUND;
  }

  // Premium (12 dice, used as one inseparable set) and Platinum (12 dice, animated)
  // sets aren't populated yet — no art exists for them — but the ownership/equip shape
  // is here so shop.js has a real catalog to render into the moment they do.
  const FULL_SET_TIERS = { premium: { cost: 150, dice: 12 }, platinum: { cost: 300, dice: 12, animated: true } };

  // ---- purchasable coin packs (real-money; see iap.js for the purchase flow) ----
  const COIN_PACKS = [
    { coins: 100, price: '$0.99' },
    { coins: 200, price: '$1.89' },
    { coins: 500, price: '$4.49' },
    { coins: 1000, price: '$7.99' },
    { coins: 2000, price: '$14.99', bestDeal: true }
  ];

  return {
    BUY_IN_STANDARD, STANDARD_PAYOUTS, BUY_IN_TOURNAMENT, TOURNAMENT_STRUCTURE,
    DEFAULT_COLORS, DEFAULT_BACKGROUND, FULL_SET_TIERS, COIN_PACKS,
    ensureAccountAndDaily, guestSessionIsStale, getBalance, canAfford, spend, add, payoutFor,
    ownsColor, grantColor, getOwnedColors, getEquippedColors, equipColor, unequipColor, hasValidLoadout,
    ownsBackground, grantBackground, equipBackground, getEquippedBackground
  };
})();
