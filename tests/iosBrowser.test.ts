import test from "node:test";
import assert from "node:assert/strict";
import { getIosBrowser } from "../src/lib/pwaInstall.ts";

const base = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";

test("riconosce il browser su iPhone per mostrare la guida giusta", () => {
  assert.equal(getIosBrowser(`${base} Version/18.0 Mobile/15E148 Safari/604.1`), "safari");
  assert.equal(getIosBrowser(`${base} CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1`), "chrome");
  assert.equal(getIosBrowser(`${base} EdgiOS/129.0.2792.84 Version/18.0 Mobile/15E148 Safari/604.1`), "edge");
  assert.equal(getIosBrowser(`${base} FxiOS/131.0 Mobile/15E148 Safari/605.1.15`), "firefox");
  assert.equal(getIosBrowser(`${base} GSA/337.0.674504843 Mobile/15E148 Safari/604.1`), "google");
  assert.equal(getIosBrowser(`${base} Mobile/15E148 Instagram 350.0.0.21.110 (iPhone15,2; iOS 18_0)`), "inapp");
  assert.equal(getIosBrowser(`${base} Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.42.105]`), "inapp");
});
