# Vendored libraries

Bundled into the extension so barcode/QR rendering has no runtime CDN dependency
(reproducible builds, no third-party fetch when a published page is viewed). Import
these from `render/runtime_libs.js` only.

| File | Package | Version | License | SHA-256 |
|------|---------|---------|---------|---------|
| `jsbarcode.min.js` | jsbarcode (`JsBarcode.all.min.js`) | 3.11.6 | MIT | `52e032534c3f98976ad95cb8c20baf80ed0cc83d42590602a8cf1db16e2e22ed` |
| `qrcode-generator.min.js` | qrcode-generator (`qrcode.min.js`) | 1.4.4 | MIT | `bb2365e4902f4f84852cf4025e6f6a60325a682aeafa43fb63b7fc8f098d1ef2` |

Source (pinned): `https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js`
and `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js`.

Module shape (why the two are imported differently):
- jsbarcode assigns `window.JsBarcode` as a side effect (no CJS/AMD export).
- qrcode-generator exports its factory via CommonJS `module.exports`.

To update: re-download the pinned version, replace the file, and update the version
+ SHA-256 above (`shasum -a 256 <file>`).
