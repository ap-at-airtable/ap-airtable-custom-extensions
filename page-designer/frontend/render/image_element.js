// Renders an image element: either the first image in an attachment field, or a
// static image URL. Falls back to a labeled placeholder when there is no record
// (editor preview) or no usable image.

import {useState} from 'react';
import {ImageSource} from '../domain/element_types.mjs';
import {extractAttachments, isImageAttachment, isSafeImageUrl} from '../domain/cell_value_helpers.mjs';
import {ImageIcon} from '../ui/icons.js';

function Placeholder({label}) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-gray100 text-gray-gray500 dark:bg-gray-gray700">
            <ImageIcon size={24} />
            <span className="text-xs">{label}</span>
        </div>
    );
}

function resolveAttachmentUrl(record, table, element) {
    if (!element.fieldId) {
        return null;
    }
    const field = table.getFieldByIdIfExists(element.fieldId);
    if (!field) {
        return null;
    }
    const attachments = extractAttachments(record.getCellValue(field));
    const image = attachments.find(isImageAttachment) || attachments[0];
    if (!image) {
        return null;
    }
    return record.getAttachmentClientUrlFromCellValueUrl(image.id, image.url);
}

export function ImageElement({element, record, table}) {
    const isStatic = element.imageSource === ImageSource.STATIC;
    // Track the URL that failed to load so a broken/expired src shows a labeled
    // placeholder instead of silently printing a blank box.
    const [failedUrl, setFailedUrl] = useState(null);
    let url = null;

    if (isStatic) {
        url = isSafeImageUrl(element.imageUrl) ? element.imageUrl.trim() : null;
    } else if (record && table) {
        url = resolveAttachmentUrl(record, table, element);
    }

    // Static images use the builder-supplied alt text (empty = decorative);
    // attachment images fall back to the field name.
    const attachmentField = !isStatic && element.fieldId ? table?.getFieldByIdIfExists(element.fieldId) : null;
    const alt = isStatic ? element.imageAlt || '' : attachmentField ? attachmentField.name : '';

    if (!url) {
        if (isStatic) {
            return <Placeholder label="Image URL" />;
        }
        if (!record) {
            return <Placeholder label="Attachment" />;
        }
        return <Placeholder label="No image" />;
    }

    if (url === failedUrl) {
        return <Placeholder label="Image failed to load" />;
    }

    return (
        <img
            src={url}
            alt={alt}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setFailedUrl(url)}
            style={{
                width: '100%',
                height: '100%',
                objectFit: element.style.imageFit || 'contain',
                objectPosition: 'center',
            }}
        />
    );
}
