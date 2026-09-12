"use strict";
/*
  Google's public TEST ad unit IDs — safe to ship in dev builds, they always serve test
  creatives. Replace with your real AdMob app + ad unit IDs (from admob.google.com)
  before submitting to the stores, and set AD_MOB_APP_ID in capacitor.config.json.
*/
const ADMOB_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712'
};

const Ads = (function(){
  function nativeAdMob(){
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
      && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob);
  }
  function isAdFree(){
    return typeof IAP !== 'undefined' && IAP.isAdFree();
  }
  function showBanner(){
    if(isAdFree()) return hideBanner();
    if(nativeAdMob()){
      try{ window.Capacitor.Plugins.AdMob.showBanner({ adId: ADMOB_IDS.banner, position: 'BOTTOM_CENTER' }); }
      catch(e){ console.error('AdMob showBanner failed', e); }
      const el = document.getElementById('adBanner'); if(el) el.style.display = 'none';
      return;
    }
    const bar = document.getElementById('adBanner');
    if(bar) bar.style.display = 'flex';
  }
  function hideBanner(){
    if(nativeAdMob()){
      try{ window.Capacitor.Plugins.AdMob.hideBanner(); }catch(e){}
    }
    const bar = document.getElementById('adBanner');
    if(bar) bar.style.display = 'none';
  }
  function showInterstitial(){
    return new Promise((resolve) => {
      if(isAdFree()) return resolve();
      if(nativeAdMob()){
        const AdMob = window.Capacitor.Plugins.AdMob;
        AdMob.prepareInterstitial({ adId: ADMOB_IDS.interstitial })
          .then(() => AdMob.showInterstitial())
          .catch((e) => console.error('AdMob interstitial failed', e))
          .finally(resolve);
        return;
      }
      // Browser / pre-native placeholder so the transition is visually testable today.
      const ov = document.createElement('div');
      ov.className = 'interstitial-sim';
      ov.innerHTML =
        '<div class="is-box">' +
          '<div style="font-family:var(--disp);font-weight:900;font-size:18px;text-transform:uppercase">Advertisement</div>' +
          '<div class="is-sub">Placeholder — real ads appear here once AdMob is configured.</div>' +
          '<button class="btn-cream" id="isSkip" type="button">Continue</button>' +
        '</div>';
      document.body.appendChild(ov);
      let done = false;
      const finish = () => { if(done) return; done = true; ov.remove(); resolve(); };
      ov.querySelector('#isSkip').onclick = finish;
      setTimeout(finish, 2200);
    });
  }
  return { isAdFree, showBanner, hideBanner, showInterstitial };
})();
