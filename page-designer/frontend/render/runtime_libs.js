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

let qrUtf8Set = false;
export function getQRCode() {
    // The vendored library's default stringToBytes truncates each code unit to one
    // byte (Latin-1), so non-ASCII record text scans as mojibake. QR readers assume
    // UTF-8 for byte mode; encode accordingly.
    if (!qrUtf8Set) {
        qrcode.stringToBytes = (str) => Array.from(new TextEncoder().encode(str));
        qrUtf8Set = true;
    }
    return qrcode;
}
