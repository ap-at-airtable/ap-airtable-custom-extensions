// Inline SVG icons (no icon library dependency). Each icon is a small React
// component taking {size, className}. Stroke-based, currentColor.

function Svg({size = 16, className = '', children, viewBox = '0 0 24 24'}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
            focusable="false"
        >
            {children}
        </svg>
    );
}

export const PlusIcon = (p) => (
    <Svg {...p}>
        <path d="M12 5v14M5 12h14" />
    </Svg>
);
export const MinusIcon = (p) => (
    <Svg {...p}>
        <path d="M5 12h14" />
    </Svg>
);
export const TrashIcon = (p) => (
    <Svg {...p}>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </Svg>
);
export const DuplicateIcon = (p) => (
    <Svg {...p}>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </Svg>
);
export const BringFrontIcon = (p) => (
    <Svg {...p}>
        <rect x="6" y="10" width="12" height="11" rx="2" />
        <path d="M12 9V2M8 6l4-4 4 4" />
    </Svg>
);
export const SendBackIcon = (p) => (
    <Svg {...p}>
        <rect x="6" y="3" width="12" height="11" rx="2" />
        <path d="M12 15v7M8 18l4 4 4-4" />
    </Svg>
);
export const TextIcon = (p) => (
    <Svg {...p}>
        <path d="M4 7V5h16v2M9 19h6M12 5v14" />
    </Svg>
);
export const ImageIcon = (p) => (
    <Svg {...p}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
    </Svg>
);
export const BarcodeIcon = (p) => (
    <Svg {...p}>
        <path d="M4 5v14M8 5v14M12 5v14M16 5v14M20 5v14" />
    </Svg>
);
export const QrIcon = (p) => (
    <Svg {...p}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3M21 14v7h-7" />
    </Svg>
);
export const FieldIcon = (p) => (
    <Svg {...p}>
        <path d="M4 9h16M4 15h16M10 4 8 20M16 4l-2 16" />
    </Svg>
);
export const LineIcon = (p) => (
    <Svg {...p}>
        <path d="M4 12h16" />
    </Svg>
);
export const EyeIcon = (p) => (
    <Svg {...p}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
    </Svg>
);
export const EditIcon = (p) => (
    <Svg {...p}>
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
);
export const PrinterIcon = (p) => (
    <Svg {...p}>
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" rx="1" />
    </Svg>
);
export const GridIcon = (p) => (
    <Svg {...p}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </Svg>
);
export const MaximizeIcon = (p) => (
    <Svg {...p}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </Svg>
);
export const UndoIcon = (p) => (
    <Svg {...p}>
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </Svg>
);
export const RedoIcon = (p) => (
    <Svg {...p}>
        <path d="M15 14l5-5-5-5" />
        <path d="M20 9H9a5 5 0 0 0 0 10h1" />
    </Svg>
);
export const SettingsIcon = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
);
export const CloseIcon = (p) => (
    <Svg {...p}>
        <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
);
export const AlignLeftIcon = (p) => (
    <Svg {...p}>
        <path d="M4 6h16M4 12h10M4 18h13" />
    </Svg>
);
export const AlignCenterIcon = (p) => (
    <Svg {...p}>
        <path d="M4 6h16M7 12h10M5 18h14" />
    </Svg>
);
export const AlignRightIcon = (p) => (
    <Svg {...p}>
        <path d="M4 6h16M10 12h10M7 18h13" />
    </Svg>
);
export const BoldIcon = (p) => (
    <Svg {...p}>
        <path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />
    </Svg>
);
export const ItalicIcon = (p) => (
    <Svg {...p}>
        <path d="M19 4h-9M14 20H5M15 4 9 20" />
    </Svg>
);
export const UnderlineIcon = (p) => (
    <Svg {...p}>
        <path d="M6 4v6a6 6 0 0 0 12 0V4M4 21h16" />
    </Svg>
);
export const ObjAlignLeftIcon = (p) => (
    <Svg {...p}>
        <path d="M4 4v16" />
        <rect x="7" y="7" width="9" height="3" rx="1" />
        <rect x="7" y="14" width="13" height="3" rx="1" />
    </Svg>
);
export const ObjAlignCenterHIcon = (p) => (
    <Svg {...p}>
        <path d="M12 4v16" />
        <rect x="6" y="7" width="12" height="3" rx="1" />
        <rect x="8" y="14" width="8" height="3" rx="1" />
    </Svg>
);
export const ObjAlignRightIcon = (p) => (
    <Svg {...p}>
        <path d="M20 4v16" />
        <rect x="8" y="7" width="9" height="3" rx="1" />
        <rect x="4" y="14" width="13" height="3" rx="1" />
    </Svg>
);
export const ObjAlignTopIcon = (p) => (
    <Svg {...p}>
        <path d="M4 4h16" />
        <rect x="7" y="7" width="3" height="9" rx="1" />
        <rect x="14" y="7" width="3" height="13" rx="1" />
    </Svg>
);
export const ObjAlignMiddleVIcon = (p) => (
    <Svg {...p}>
        <path d="M4 12h16" />
        <rect x="7" y="6" width="3" height="12" rx="1" />
        <rect x="14" y="8" width="3" height="8" rx="1" />
    </Svg>
);
export const ObjAlignBottomIcon = (p) => (
    <Svg {...p}>
        <path d="M4 20h16" />
        <rect x="7" y="8" width="3" height="9" rx="1" />
        <rect x="14" y="4" width="3" height="13" rx="1" />
    </Svg>
);
export const DistributeHIcon = (p) => (
    <Svg {...p}>
        <rect x="3" y="6" width="3" height="12" rx="1" />
        <rect x="10.5" y="6" width="3" height="12" rx="1" />
        <rect x="18" y="6" width="3" height="12" rx="1" />
    </Svg>
);
export const DistributeVIcon = (p) => (
    <Svg {...p}>
        <rect x="6" y="3" width="12" height="3" rx="1" />
        <rect x="6" y="10.5" width="12" height="3" rx="1" />
        <rect x="6" y="18" width="12" height="3" rx="1" />
    </Svg>
);
export const LayersIcon = (p) => (
    <Svg {...p}>
        <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
    </Svg>
);
export const WarningIcon = (p) => (
    <Svg {...p}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
    </Svg>
);
export const EmptyIcon = (p) => (
    <Svg {...p}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
    </Svg>
);
