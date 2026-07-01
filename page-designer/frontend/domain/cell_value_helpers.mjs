// Pure helpers over the documented runtime shapes of Airtable cell values.
// They take plain values (not SDK Record objects) so they are fully testable.

// MULTIPLE_ATTACHMENTS cell value -> array of {id, url, filename, thumbnails}.
// `url` here is the raw cell url; the render layer must pass it through
// record.getAttachmentClientUrlFromCellValueUrl to get a renderable URL.
export function extractAttachments(cellValue) {
    if (!Array.isArray(cellValue)) {
        return [];
    }
    return cellValue.filter((a) => a && typeof a.url === 'string');
}

// A user-typed static image URL is untrusted. Only http(s) is allowed as an
// <img src>: this blocks javascript:/blob:/unknown schemes and, by rejecting
// data: URLs, also stops a pasted base64 image from blowing the GlobalConfig
// size budget. Attachment URLs go through the SDK's own sanitizer, not this.
export function isSafeImageUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

export function isImageAttachment(attachment) {
    if (!attachment) {
        return false;
    }
    if (typeof attachment.type === 'string' && attachment.type.startsWith('image/')) {
        return true;
    }
    // Fall back to extension sniffing when the mime type is absent.
    const name = attachment.filename ?? '';
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

// BARCODE cell value -> the encodable text, or '' if none.
export function extractBarcodeText(cellValue) {
    if (cellValue == null) {
        return '';
    }
    if (typeof cellValue === 'string') {
        return cellValue;
    }
    if (typeof cellValue === 'object' && typeof cellValue.text === 'string') {
        return cellValue.text;
    }
    return '';
}

// MULTIPLE_RECORD_LINKS -> array of {id, name} (linked record display values).
// Keyed on `id` (always present); a linked record whose primary value is empty
// has no `name`, so treat name as optional display text rather than dropping the
// link — otherwise real links vanish from the rendered list/table.
export function extractLinkedRecords(cellValue) {
    if (!Array.isArray(cellValue)) {
        return [];
    }
    return cellValue
        .filter((r) => r && (typeof r.id === 'string' || typeof r.name === 'string'))
        .map((r) => ({id: r.id, name: typeof r.name === 'string' ? r.name : ''}));
}

// SINGLE_SELECT / MULTIPLE_SELECTS -> array of {name, color}.
export function extractSelectChoices(cellValue) {
    if (cellValue == null) {
        return [];
    }
    if (Array.isArray(cellValue)) {
        return cellValue.filter((c) => c && typeof c.name === 'string');
    }
    if (typeof cellValue === 'object' && typeof cellValue.name === 'string') {
        return [cellValue];
    }
    return [];
}

// Truncate display text with an ellipsis (used by render fallbacks).
export function truncate(text, maxLength) {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return text ?? '';
    }
    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}
