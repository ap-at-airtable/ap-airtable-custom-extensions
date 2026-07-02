// Renders a 1D barcode or QR code from a field value. The encoding libraries are
// bundled (vendored); if encoding fails (invalid data for the chosen symbology, QR
// capacity exceeded), we fall back to the raw text so a page still prints legibly.

import {useEffect, useRef, useState} from 'react';
import {ElementKind} from '../domain/element_types.mjs';
import {extractBarcodeText} from '../domain/cell_value_helpers.mjs';
import {getJsBarcode, getQRCode} from './runtime_libs.js';

function resolveText(element, record, table) {
    if (!record || !table || !element.fieldId) {
        return '';
    }
    const field = table.getFieldByIdIfExists(element.fieldId);
    if (!field) {
        return '';
    }
    const fromBarcode = extractBarcodeText(record.getCellValue(field));
    return fromBarcode || record.getCellValueAsString(field) || '';
}

function Fallback({label, text}) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gray-gray100 text-center text-gray-gray500 dark:bg-gray-gray700">
            <span className="text-[10px] uppercase tracking-wide">{label}</span>
            {text ? <span className="px-1 text-[11px] text-gray-gray500">{text}</span> : null}
        </div>
    );
}

export function BarcodeElement({element, record, table}) {
    const isQr = element.kind === ElementKind.QR_CODE;
    const text = resolveText(element, record, table);
    const containerRef = useRef(null);
    const [status, setStatus] = useState('idle'); // idle | ok | error

    useEffect(() => {
        const node = containerRef.current;
        if (!node || !text) {
            setStatus('idle');
            return;
        }
        node.replaceChildren();
        try {
            if (isQr) {
                const qrcode = getQRCode();
                // typeNumber 0 = auto-fit the data; 'M' error correction.
                const qr = qrcode(0, 'M');
                qr.addData(text);
                qr.make();
                const img = document.createElement('img');
                img.src = qr.createDataURL(8); // cellSize 8px; default 4-module quiet zone
                img.alt = text;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                node.appendChild(img);
            } else {
                const JsBarcode = getJsBarcode();
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('role', 'img');
                svg.setAttribute('aria-label', text);
                node.appendChild(svg);
                // Encode at a fixed intrinsic height and let CSS scale to the box, so
                // live resizing doesn't re-encode every frame.
                JsBarcode(svg, text, {
                    format: element.barcodeFormat || 'CODE128',
                    displayValue: true,
                    margin: 0,
                    width: 2,
                    height: 100,
                    background: 'transparent',
                });
                svg.style.width = '100%';
                svg.style.height = '100%';
            }
            setStatus('ok');
        } catch (err) {
            // Invalid data for the chosen symbology or QR capacity exceeded; log so
            // "shows plain text" is diagnosable, then fall back to the raw text.
            console.error('Barcode render failed', {
                format: isQr ? 'QR' : element.barcodeFormat,
                text,
                error: err,
            });
            setStatus('error');
        }
    }, [text, isQr, element.barcodeFormat]);

    if (!text) {
        return <Fallback label={isQr ? 'QR code' : 'Barcode'} />;
    }

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="flex h-full w-full items-center justify-center" />
            {status === 'error' ? (
                <Fallback label={isQr ? 'Could not encode QR code' : 'Could not encode barcode'} text={text} />
            ) : null}
        </div>
    );
}
