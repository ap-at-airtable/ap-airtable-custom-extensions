// Barcode/QR libraries, vendored under ./vendor and bundled into the extension so
// rendering needs no runtime CDN fetch (reproducible, and no third-party network
// dependency when a published page is viewed). See vendor/README.md for versions.
//
// The two libraries expose themselves differently: jsbarcode assigns
// window.JsBarcode as a side effect (no module export), while qrcode-generator
// exports its factory via CommonJS.

import qrcode from '../vendor/qrcode-generator.min.js';
import '../vendor/jsbarcode.min.js';

export function getJsBarcode() {
    return window.JsBarcode;
}

export function getQRCode() {
    return qrcode;
}
