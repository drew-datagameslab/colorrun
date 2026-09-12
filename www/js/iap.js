"use strict";
/*
  Product identifiers must match what you create in App Store Connect (subscriptions)
  and Google Play Console (subscriptions), and must be mapped to a single "ad_free"
  entitlement in your RevenueCat project (app.revenuecat.com).
*/
const IAP_PRODUCTS = { monthly: 'colorrun_adfree_monthly', yearly: 'colorrun_adfree_yearly' };
// Consumable coin packs — product ids follow the coin amount (colorrun_coins_100, etc).
// Create these as consumables in App Store Connect / Play Console when going live.

const IAP = (function(){
  const KEY = 'cr_adfree';

  function isAdFree(){
    try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; }
  }
  function nativePurchases(){
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
      && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases);
  }
  function setAdFree(on){
    try{ localStorage.setItem(KEY, on ? '1' : '0'); }catch(e){}
    if(on) Ads.hideBanner();
  }

  async function purchase(plan){
    const productId = plan === 'yearly' ? IAP_PRODUCTS.yearly : IAP_PRODUCTS.monthly;
    if(nativePurchases()){
      try{
        await window.Capacitor.Plugins.Purchases.purchaseProduct({ productIdentifier: productId });
        setAdFree(true);
        toast('You are ad-free — thanks for the support!');
        return true;
      }catch(e){
        console.error('Purchase failed', e);
        toast('Purchase failed or was cancelled');
        return false;
      }
    }
    // Browser / pre-RevenueCat placeholder: simulate the purchase locally so the
    // paywall and ad-free state are fully testable before real billing is wired up.
    setAdFree(true);
    toast('(Test mode) Ad-free enabled on this device');
    return true;
  }

  async function restore(){
    if(nativePurchases()){
      try{
        const info = await window.Capacitor.Plugins.Purchases.restorePurchases();
        const active = info && info.customerInfo && info.customerInfo.entitlements
          && info.customerInfo.entitlements.active && info.customerInfo.entitlements.active['ad_free'];
        if(active){ setAdFree(true); toast('Purchases restored'); return true; }
        toast('No active purchase found for this account');
        return false;
      }catch(e){
        console.error('Restore failed', e);
        toast('Restore failed');
        return false;
      }
    }
    toast('Nothing to restore in test mode');
    return false;
  }

  function openPaywall(){
    const s = $('sheet'); s.innerHTML = '';
    s.appendChild(grip());
    const h = el('h2'); h.textContent = 'Go Ad-Free'; s.appendChild(h);
    const sub = el('div', 'sub');
    sub.textContent = 'Remove ads from Single Play and Multiplayer Play, on this device and account.';
    s.appendChild(sub);
    const m = el('button', 'btn-green'); m.textContent = '$2.99 / month';
    m.onclick = async () => { if(await purchase('monthly')) closeOv(); };
    const y = el('button', 'btn-cream'); y.textContent = '$12.00 / year';
    y.onclick = async () => { if(await purchase('yearly')) closeOv(); };
    const r = el('button', 'btn-link'); r.textContent = 'Restore purchases';
    r.onclick = restore;
    const c = el('button', 'btn-link'); c.textContent = 'Close';
    c.onclick = closeOv;
    s.appendChild(m); s.appendChild(y); s.appendChild(r); s.appendChild(c);
    openOv();
  }

  // Coin packs are consumable (not the ad_free entitlement above) — each successful
  // purchase just credits coins once, it doesn't set a persistent "owned" flag.
  async function purchaseCoins(pack, onDone){
    const productId = 'colorrun_coins_' + pack.coins;
    if(nativePurchases()){
      try{
        await window.Capacitor.Plugins.Purchases.purchaseProduct({ productIdentifier: productId });
        Coins.add(pack.coins);
        toast('+' + pack.coins + ' coins!');
        if(onDone) onDone();
        return true;
      }catch(e){
        console.error('Coin purchase failed', e);
        toast('Purchase failed or was cancelled');
        return false;
      }
    }
    // Browser / pre-RevenueCat placeholder, same as the ad-free purchase above.
    Coins.add(pack.coins);
    toast('(Test mode) +' + pack.coins + ' coins');
    if(onDone) onDone();
    return true;
  }

  return { isAdFree, purchase, restore, openPaywall, purchaseCoins };
})();
