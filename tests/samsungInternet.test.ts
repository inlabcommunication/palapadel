import test from "node:test";
import assert from "node:assert/strict";
import { getChromeIntentUrl, isSamsungInternetAndroid } from "../src/lib/pwaInstall.ts";

test("riconosce Samsung Internet su Android (installazione bloccata da Play Protect)", () => {
  const android = "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko)";
  assert.equal(isSamsungInternetAndroid(`${android} SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36`), true);
  assert.equal(isSamsungInternetAndroid(`${android} Chrome/130.0.0.0 Mobile Safari/537.36`), false);
  assert.equal(isSamsungInternetAndroid("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1"), false);
});

test("il link apre la stessa pagina in Chrome", () => {
  assert.equal(
    getChromeIntentUrl("https://palapadel-c3tj-theta.vercel.app/campionati?x=1"),
    "intent://palapadel-c3tj-theta.vercel.app/campionati?x=1#Intent;scheme=https;package=com.android.chrome;" +
      "S.browser_fallback_url=https%3A%2F%2Fpalapadel-c3tj-theta.vercel.app%2Fcampionati%3Fx%3D1;end",
  );
});
