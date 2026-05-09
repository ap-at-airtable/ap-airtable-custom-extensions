import {
    initializeBlock,
    useRecords,
    useSession,
    useCustomProperties,
    expandRecord,
} from '@airtable/blocks/interface/ui';
import {FieldType} from '@airtable/blocks/interface/models';
import {ArrowFatUpIcon, TrashSimpleIcon, PlayIcon, CheckCircleIcon, ArchiveIcon, ArrowCounterClockwiseIcon, CaretDownIcon, CaretUpIcon, PresentationIcon, XIcon, CornersOutIcon, CornersInIcon, PlusIcon, PencilSimpleIcon, BroadcastIcon} from '@phosphor-icons/react';
import React, {useState, useEffect, useCallback, useRef} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import './style.css';

const markdownComponents = {
    a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
};


class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false, errorMessage: null};
    }

    static getDerivedStateFromError(error) {
        return {hasError: true, errorMessage: error?.message || 'Unknown error'};
    }

    componentDidCatch(error) {
        console.error('AirPulse caught error:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-gray800">
                    <div className="text-center p-8 max-w-md">
                        <p className="text-2xl font-display font-bold text-gray-gray700 dark:text-gray-gray200 mb-2">
                            Something went wrong
                        </p>
                        <p className="text-base text-gray-gray400 dark:text-gray-gray500 mb-2">
                            The extension encountered an error. Try reloading.
                        </p>
                        <p className="text-xs text-gray-gray300 dark:text-gray-gray600 mb-6 font-mono">
                            {this.state.errorMessage}
                        </p>
                        <button
                            onClick={() => this.setState({hasError: false, errorMessage: null})}
                            className="px-5 py-2 rounded-md text-sm font-semibold bg-gray-gray700 dark:bg-gray-gray200 text-white dark:text-gray-gray800 cursor-pointer"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Constants — centralize status names so a rename is a one-line fix
const STATUS = {
    LIVE: 'Live',
    PENDING: 'Pending',
    ANSWERED: 'Answered',
    ARCHIVED: 'Archived',
};

const MAX_QUESTION_LENGTH = 500;

// --- Hardcoded field name constants ---

const EVENT_FIELDS = {
    PRIMARY_COLOR: 'Primary Color',
    LOGO: 'Logo',
    SECONDARY_LOGO: 'Secondary Logo',
    DATE: 'Date',
    DESCRIPTION: 'Description',
    LIVE: 'Live Event',
    EVENT_TYPE: 'Event Type',
};

const QA_FIELDS = {
    QUESTION_TEXT: 'Question Text',
    STATUS: 'Status',
    CREATED_BY: 'Created By',
    AI_ANSWER: 'AI Answer',
    HUMAN_ANSWER: 'Human Answer',
    ANSWERED_BY: 'Answered By',
};

const UPVOTE_FIELDS = {
    CREATED_BY: 'Created By',
};

function getField(table, name) {
    return table?.fields.find((f) => f.name === name) || null;
}

// --- Shared utilities ---

// --- Theme ---

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
}

function isLightColor(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    // Relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}

function darkenColor(hex, factor = 0.55) {
    const h = hex.replace('#', '');
    const r = Math.round(parseInt(h.substring(0, 2), 16) * factor);
    const g = Math.round(parseInt(h.substring(2, 4), 16) * factor);
    const b = Math.round(parseInt(h.substring(4, 6), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function ThemeProvider({primaryColor, children}) {
    const accent = darkenColor(primaryColor);
    const primaryRgb = hexToRgb(primaryColor);
    const accentRgb = hexToRgb(accent);
    const primaryTextColor = isLightColor(primaryColor) ? '#1d1f25' : '#ffffff';
    const accentTextColor = isLightColor(accent) ? '#1d1f25' : '#ffffff';
    const accentSubtextColor = isLightColor(accent) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)';

    const style = {
        '--color-primary': primaryColor,
        '--color-primary-rgb': primaryRgb,
        '--color-accent': accent,
        '--color-accent-rgb': accentRgb,
        '--color-tint': `rgba(${primaryRgb}, 0.06)`,
        '--color-primary-text': primaryTextColor,
        '--color-accent-text': accentTextColor,
        '--color-accent-subtext': accentSubtextColor,
    };

    return <div style={style} className="contents">{children}</div>;
}

function getSortedEvents(allEventRecords, eventsTable) {
    const dateField = eventsTable.fields.find(
        (f) => f.config.type === FieldType.DATE || f.config.type === FieldType.DATE_TIME
    );

    return allEventRecords
        .map((r) => ({
            id: r.id,
            name: r.getCellValueAsString(eventsTable.primaryField),
            date: dateField ? r.getCellValue(dateField) : null,
        }))
        .sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date) - new Date(a.date);
        });
}

function getEventBranding(eventRecord, primaryColorField) {
    const primary = eventRecord && primaryColorField ? eventRecord.getCellValueAsString(primaryColorField) : '';
    return { primaryColor: primary || '#166ee1' };
}

function getEventLogo(eventRecord, logoField) {
    if (!eventRecord || !logoField) return null;
    const attachments = eventRecord.getCellValue(logoField);
    if (!attachments || attachments.length === 0) return null;
    return attachments[0].thumbnails?.large?.url || attachments[0].url;
}

// --- Fullscreen ---

function FullscreenHint({onDismiss, onGoFullscreen}) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => { setVisible(false); onDismiss(); }, 8000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    if (!visible) return null;

    return (
        <div className="fixed top-3 right-3 z-50 flex items-center gap-2 fullscreen-hint-bounce">
            <button
                onClick={() => { onGoFullscreen(); setVisible(false); }}
                className="flex items-center gap-2 bg-gray-gray700 text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer text-xs font-semibold hover:bg-gray-gray900 transition-colors"
            >
                <CornersOutIcon size={16} />
                Go Fullscreen
            </button>
            <button
                onClick={() => { setVisible(false); onDismiss(); }}
                className="text-gray-gray400 hover:text-gray-gray600 cursor-pointer text-xs"
                title="Dismiss"
            >
                <XIcon size={14} />
            </button>
        </div>
    );
}

function FullscreenToggle() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showHint, setShowHint] = useState(true);

    const handleChange = useCallback(() => {
        setIsFullscreen(!!document.fullscreenElement);
        if (document.fullscreenElement) setShowHint(false);
    }, []);

    useEffect(() => {
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, [handleChange]);

    const dismissHint = useCallback(() => {
        setShowHint(false);
    }, []);

    const toggle = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
            dismissHint();
        }
    };

    return (
        <>
            {showHint && !isFullscreen && <FullscreenHint onDismiss={dismissHint} onGoFullscreen={toggle} />}
            <button
                onClick={toggle}
                className="p-2 rounded-lg bg-gray-gray25 text-gray-gray500 hover:text-gray-gray700 hover:bg-gray-gray100 transition-colors cursor-pointer shrink-0"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
                {isFullscreen ? <CornersInIcon size={18} /> : <CornersOutIcon size={18} />}
            </button>
        </>
    );
}

// --- Custom Properties ---

const isLinkedRecordField = (field) =>
    field.config.type === FieldType.MULTIPLE_RECORD_LINKS;

const isCountableField = (field) =>
    field.config.type === FieldType.NUMBER ||
    field.config.type === FieldType.FORMULA ||
    field.config.type === FieldType.COUNT ||
    field.config.type === FieldType.ROLLUP;

function getCustomProperties(base) {
    const qaTable = base.tables.find(
        (t) => t.name.toLowerCase().includes('q&a') || t.name.toLowerCase().includes('qa')
    );
    const eventsTable = base.tables.find(
        (t) => t.name.toLowerCase().includes('event')
    );
    const upvotesTable = base.tables.find(
        (t) => t.name.toLowerCase().includes('upvote')
    );

    const qaLinkedFields = qaTable ? qaTable.fields.filter(isLinkedRecordField) : [];
    const qaCountableFields = qaTable ? qaTable.fields.filter(isCountableField) : [];
    const upvotesLinkedFields = upvotesTable ? upvotesTable.fields.filter(isLinkedRecordField) : [];

    const properties = [
        {
            key: 'mode',
            label: 'Mode',
            type: 'enum',
            possibleValues: [
                {value: 'audience', label: 'Audience'},
                {value: 'admin', label: 'Admin'},
                {value: 'setup', label: 'Setup'},
            ],
            defaultValue: 'audience',
        },
        {
            key: 'eventsTable',
            label: 'Events Table',
            type: 'table',
            defaultValue: eventsTable,
        },
        {
            key: 'qaTable',
            label: 'Q&A Table',
            type: 'table',
            defaultValue: qaTable,
        },
        {
            key: 'upvotesTable',
            label: 'Upvotes Table',
            type: 'table',
            defaultValue: upvotesTable,
        },
    ];

    // Field properties require a valid table reference — only include when the table exists
    if (qaTable) {
        properties.push(
            {
                key: 'eventField',
                label: 'Event Link (Q&A → Events)',
                type: 'field',
                table: qaTable,
                shouldFieldBeAllowed: isLinkedRecordField,
                defaultValue: qaLinkedFields.find((f) =>
                    f.name.toLowerCase().includes('event')
                ) || qaLinkedFields[0],
            },
            {
                key: 'upvoteCountField',
                label: 'Upvote Count',
                type: 'field',
                table: qaTable,
                shouldFieldBeAllowed: isCountableField,
                defaultValue: qaCountableFields.find((f) =>
                    f.name.toLowerCase().includes('upvote') && f.name.toLowerCase().includes('count')
                ) || qaCountableFields[0],
            },
        );
    }

    if (upvotesTable) {
        properties.push({
            key: 'upvoteQuestionField',
            label: 'Question Link (Upvotes → Q&A)',
            type: 'field',
            table: upvotesTable,
            shouldFieldBeAllowed: isLinkedRecordField,
            defaultValue: upvotesLinkedFields.find((f) =>
                f.name.toLowerCase().includes('question')
            ) || upvotesLinkedFields[0],
        });
    }

    return properties;
}

// --- Setup / Error screens ---

function SetupInstructions({allProperties}) {
    const [showSchema, setShowSchema] = useState(false);

    const hasAnyTable = allProperties.eventsTable || allProperties.qaTable || allProperties.upvotesTable;

    const steps = [
        {
            title: 'Connect Your Events Table',
            description: 'Select the table that stores your events. Branding fields (colors, logos, etc.) are looked up automatically by name.',
            properties: [{key: 'eventsTable', label: 'Events Table'}],
            fieldNote: 'Expected fields: Primary Color, Logo, Secondary Logo, Date, Description, Live Event, Event Type',
        },
        {
            title: 'Connect Your Q&A Table',
            description: 'Select the table and map the linked record and count fields in the properties panel.',
            properties: [
                {key: 'qaTable', label: 'Q&A Table'},
                {key: 'eventField', label: 'Event Link (linked record)'},
                {key: 'upvoteCountField', label: 'Upvote Count (formula/count)'},
            ],
            fieldNote: 'Auto-detected by name: Question Text, Status, Created By',
            fieldChecks: [
                {key: 'questionTextField', label: 'Question Text'},
                {key: 'statusField', label: 'Status'},
                {key: 'createdByField', label: 'Created By'},
            ],
        },
        {
            title: 'Connect Your Upvotes Table',
            description: 'Select the table and map the linked record field in the properties panel.',
            properties: [
                {key: 'upvotesTable', label: 'Upvotes Table'},
                {key: 'upvoteQuestionField', label: 'Question Link (linked record)'},
            ],
            fieldNote: 'Auto-detected by name: Created By',
            fieldChecks: [
                {key: 'upvoteCreatedByField', label: 'Created By'},
            ],
        },
    ];

    const requiredKeys = new Set(['eventsTable', 'qaTable', 'upvotesTable', 'eventField', 'upvoteQuestionField', 'upvoteCountField', 'questionTextField', 'statusField', 'createdByField', 'upvoteCreatedByField']);

    // Find the first step that has unconfigured required items
    let activeStepIndex = 0;
    for (let i = 0; i < steps.length; i++) {
        const allKeys = [...(steps[i].properties || []), ...(steps[i].fieldChecks || [])];
        const hasUnset = allKeys.some((p) => requiredKeys.has(p.key) && !allProperties[p.key]);
        if (hasUnset) {
            activeStepIndex = i;
            break;
        }
        if (i === steps.length - 1) activeStepIndex = i;
    }

    const totalRequired = [...requiredKeys].length;
    const configuredRequired = [...requiredKeys].filter((k) => allProperties[k]).length;

    return (
        <div className="min-h-screen bg-white dark:bg-gray-gray800 p-4 sm:p-6">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8 pt-8">
                    <p className="text-5xl font-display font-bold mb-3 text-gray-gray900 dark:text-gray-gray200">
                        Air<span className="pulse-text" style={{color: '#FCB42A'}}>Pulse</span>
                    </p>
                    <h1 className="text-xl font-display font-semibold mb-2" style={{color: '#1a5c4c'}}>
                        Let&apos;s get you set up
                    </h1>
                    <p className="text-base" style={{color: '#3d8b78'}}>
                        Connect your tables and we&apos;ll detect most fields automatically by name.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{backgroundColor: 'rgba(26,92,76,0.15)'}}>
                            <div
                                className="h-full rounded-full transition-all"
                                style={{width: `${(configuredRequired / totalRequired) * 100}%`, backgroundColor: '#1a5c4c'}}
                            />
                        </div>
                        <span className="text-xs" style={{color: '#3d8b78'}}>{configuredRequired}/{totalRequired}</span>
                    </div>
                </div>

                {!hasAnyTable && (
                    <div className="mb-6 rounded-lg p-5" style={{backgroundColor: 'rgba(26,92,76,0.12)', border: '1px solid rgba(26,92,76,0.2)'}}>
                        <h3 className="text-base font-semibold mb-2" style={{color: '#1a5c4c'}}>
                            Need to create your tables first?
                        </h3>
                        <p className="text-sm mb-3" style={{color: '#3d8b78'}}>
                            This extension requires 3 tables with specific field names. Create them in your base, then come back here to connect them.
                        </p>
                        <button
                            onClick={() => setShowSchema(!showSchema)}
                            className="text-sm font-semibold cursor-pointer hover:underline"
                            style={{color: '#1a5c4c'}}
                        >
                            {showSchema ? 'Hide schema reference' : 'Show schema reference'}
                        </button>
                        {showSchema && (
                            <div className="mt-4 space-y-4">
                                <div className="rounded-md p-4" style={{backgroundColor: 'rgba(255,255,255,0.6)'}}>
                                    <p className="text-sm font-bold mb-2" style={{color: '#1a5c4c'}}>1. Events Table</p>
                                    <ul className="text-xs text-gray-gray500 dark:text-gray-gray400 space-y-1">
                                        <li><strong>Name</strong> — Single line text (primary field)</li>
                                        <li><strong>Date</strong> — Date</li>
                                        <li><strong>Description</strong> — Long text</li>
                                        <li><strong>Live Event</strong> — Checkbox</li>
                                        <li><strong>Event Type</strong> — Single select (Live Questions, Q/A)</li>
                                        <li><strong>Primary Color</strong> — Single line text (hex code)</li>
                                        <li><strong>Logo</strong> — Attachment</li>
                                        <li><strong>Secondary Logo</strong> — Attachment</li>
                                    </ul>
                                </div>
                                <div className="rounded-md p-4" style={{backgroundColor: 'rgba(255,255,255,0.6)'}}>
                                    <p className="text-sm font-bold mb-2" style={{color: '#1a5c4c'}}>2. Q&amp;A Table</p>
                                    <ul className="text-xs text-gray-gray500 dark:text-gray-gray400 space-y-1">
                                        <li><strong>Question Text</strong> — Single line text</li>
                                        <li><strong>Event</strong> — Link to Events table</li>
                                        <li><strong>Status</strong> — Single select (Pending, Live, Answered, Archived)</li>
                                        <li><strong>Created By</strong> — Created by field</li>
                                        <li><strong>Upvote Count</strong> — Count or Formula (counts linked Upvotes)</li>
                                    </ul>
                                </div>
                                <div className="rounded-md p-4" style={{backgroundColor: 'rgba(255,255,255,0.6)'}}>
                                    <p className="text-sm font-bold mb-2" style={{color: '#1a5c4c'}}>3. Upvotes Table</p>
                                    <ul className="text-xs text-gray-gray500 dark:text-gray-gray400 space-y-1">
                                        <li><strong>Question</strong> — Link to Q&amp;A table</li>
                                        <li><strong>Created By</strong> — Created by field</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    {steps.map((step, i) => {
                        const allKeys = [...(step.properties || []), ...(step.fieldChecks || [])];
                        const allConfigured = allKeys.every((p) => !requiredKeys.has(p.key) || allProperties[p.key]);
                        const isActive = i === activeStepIndex && !allConfigured;
                        const isDone = allKeys.filter((p) => requiredKeys.has(p.key)).every((p) => allProperties[p.key]);

                        return (
                            <div
                                key={i}
                                className="rounded-lg p-5 transition-colors"
                                style={
                                    isActive
                                        ? {backgroundColor: 'rgba(255,255,255,0.7)', border: '2px solid #1a5c4c'}
                                        : isDone
                                            ? {backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(26,92,76,0.3)'}
                                            : {backgroundColor: 'rgba(255,255,255,0.3)', border: '1px solid rgba(26,92,76,0.1)'}
                                }
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
                                        style={
                                            isDone
                                                ? {backgroundColor: '#1a5c4c', color: 'white'}
                                                : isActive
                                                    ? {backgroundColor: '#e8845a', color: 'white'}
                                                    : {backgroundColor: 'rgba(26,92,76,0.2)', color: '#3d8b78'}
                                        }
                                    >
                                        {isDone ? <CheckCircleIcon size={14} weight="bold" /> : i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold mb-1" style={{color: '#1a5c4c'}}>
                                            {step.title}
                                        </h3>
                                        {(isActive || !isDone) && (
                                            <p className="text-sm mb-3" style={{color: '#3d8b78'}}>
                                                {step.description}
                                            </p>
                                        )}
                                        {(isActive || !isDone) && (
                                            <div className="space-y-1.5">
                                                {step.properties.map((prop) => {
                                                    const isSet = !!allProperties[prop.key];
                                                    return (
                                                        <div key={prop.key} className="flex items-center gap-2 text-sm">
                                                            {isSet ? (
                                                                <CheckCircleIcon size={14} className="shrink-0" weight="fill" style={{color: '#1a5c4c'}} />
                                                            ) : (
                                                                <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0" style={{borderColor: 'rgba(26,92,76,0.4)'}} />
                                                            )}
                                                            <span style={{color: isSet ? '#3d8b78' : '#1a5c4c'}}>
                                                                {prop.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                {step.fieldChecks && step.fieldChecks.map((check) => {
                                                    const isFound = !!allProperties[check.key];
                                                    return (
                                                        <div key={check.key} className="flex items-center gap-2 text-sm">
                                                            {isFound ? (
                                                                <CheckCircleIcon size={14} className="shrink-0" weight="fill" style={{color: '#1a5c4c'}} />
                                                            ) : (
                                                                <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0" style={{borderColor: '#e8845a'}} />
                                                            )}
                                                            <span style={{color: isFound ? '#3d8b78' : '#e8845a'}}>
                                                                {check.label}
                                                                {!isFound && <span className="ml-1 text-xs">(not found — create a field named &quot;{check.label}&quot;)</span>}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {step.fieldNote && isDone && (
                                            <p className="text-xs mt-2" style={{color: '#3d8b78'}}>
                                                {step.fieldNote}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-sm" style={{color: '#3d8b78'}}>
                        Open the <strong>properties panel</strong> on the right to configure tables and linked fields. Other fields are detected automatically by name.
                    </p>
                </div>
            </div>
        </div>
    );
}



// --- Shared components ---


function Logo({logoUrl}) {
    if (!logoUrl) return null;

    return (
        <div className="flex justify-start">
            <img
                src={logoUrl}
                alt="Logo"
                className="max-w-[12vw] max-h-[80px] w-auto object-contain"
            />
        </div>
    );
}

function FilterTabs({filter, setFilter, pendingCount, answeredCount, myCount, isLightMode}) {
    const total = pendingCount + answeredCount;
    const tabs = [
        {key: 'all', label: `All (${total})`},
    ];
    if (myCount !== undefined) {
        tabs.push({key: 'mine', label: `My Questions (${myCount})`});
    }
    tabs.push(
        {key: 'pending', label: `Pending (${pendingCount})`},
        {key: 'answered', label: `Answered (${answeredCount})`},
    );
    return (
        <div className="flex gap-1.5 mb-4">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                        filter === tab.key
                            ? (isLightMode ? 'btn-primary' : '')
                            : (isLightMode ? 'text-gray-gray500 hover:bg-gray-gray100' : 'hover:bg-white/10')
                    }`}
                    style={filter === tab.key && !isLightMode ? {backgroundColor: 'var(--color-primary)', color: 'white'} : isLightMode ? {} : {color: 'var(--color-accent-subtext)'}}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function SplitLayout({left, right, leftFlex = 3, rightFlex = 2, leftStyle = {}, rightStyle = {}, leftCenter = false}) {
    return (
        <div className="split-layout">
            <div className={`split-left ${leftCenter ? 'split-left-centered' : ''}`} style={{flex: leftFlex, ...leftStyle}}>
                {left}
            </div>
            <div className="split-right" style={{flex: rightFlex, ...rightStyle}}>
                {right}
            </div>
        </div>
    );
}

function NowAnswering({record, questionTextField, createdByField, upvoteCountField}) {
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const upvoteCount = Number(record.getCellValue(upvoteCountField)) || 0;
    const submitterName = createdBy?.name || 'Someone';

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full animate-pulse" style={{backgroundColor: 'var(--color-accent-text)'}} />
                <span className="text-lg font-medium uppercase tracking-widest live-label-shimmer">
                    Now Answering
                </span>
            </div>
            <p className="text-4xl font-display font-bold leading-snug mb-3" style={{fontSize: '56px', lineHeight: '1.1', color: 'var(--color-accent-text)'}}>
                {questionText}
            </p>
            <p className="text-xl" style={{color: 'var(--color-accent-subtext)'}}>
                {submitterName} · {upvoteCount} {upvoteCount === 1 ? 'upvote' : 'upvotes'}
            </p>
        </div>
    );
}

// --- Audience components ---

function QuestionInputInner({qaTable, questionTextField, eventField, selectedEventId}) {
    const inputRef = useRef(null);

    // Press "/" anywhere to focus the question input (like Slack/YouTube)
    useEffect(() => {
        const handleGlobalKey = (e) => {
            if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleGlobalKey);
        return () => document.removeEventListener('keydown', handleGlobalKey);
    }, []);

    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const trimmedText = text.trim();
    const canSubmit = trimmedText.length > 0 && trimmedText.length <= MAX_QUESTION_LENGTH && !isSubmitting;
    const showCounter = text.length > MAX_QUESTION_LENGTH - 100;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const fields = {[questionTextField.id]: trimmedText};

            if (selectedEventId) {
                fields[eventField.id] = [{id: selectedEventId}];
            }

            await qaTable.createRecordAsync(fields);
            setText('');
            setTimeout(() => inputRef.current?.focus(), 50);
        } catch {
            setError('Failed to submit question. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            inputRef.current?.blur();
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="mb-4">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-gray700 border-2 border-gray-gray200 dark:border-gray-gray600 rounded-lg px-4 py-3 input-themed transition-colors">
                <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your question... ( / )"
                    maxLength={MAX_QUESTION_LENGTH}
                    disabled={isSubmitting}
                    className="flex-1 bg-transparent text-base text-gray-gray700 dark:text-gray-gray200 placeholder-gray-gray400 dark:placeholder-gray-gray500 outline-none"
                />
                <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                        canSubmit
                            ? 'btn-primary cursor-pointer'
                            : 'bg-gray-gray100 dark:bg-gray-gray600 text-gray-gray400 dark:text-gray-gray500 cursor-not-allowed'
                    }`}
                >
                    {isSubmitting ? 'Sending...' : 'Send'}
                </button>
            </div>
            <div className="flex justify-between items-center mt-1 min-h-[20px]">
                {error && (
                    <p className="text-xs text-red-red">{error}</p>
                )}
                {!error && <span />}
                {showCounter && (
                    <p className={`text-xs ${
                        text.length > MAX_QUESTION_LENGTH
                            ? 'text-red-red'
                            : 'text-gray-gray400'
                    }`}>
                        {text.length}/{MAX_QUESTION_LENGTH}
                    </p>
                )}
            </div>
        </div>
    );
}

function QuestionInput(props) {
    if (!props.qaTable.hasPermissionToCreateRecords()) return null;
    return <QuestionInputInner {...props} />;
}

function UpvotePill({record, upvotesTable, upvoteQuestionField, upvoteCountField, myUpvoteRecord, canVote}) {
    const [isActing, setIsActing] = useState(false);

    const hasVoted = !!myUpvoteRecord;
    const count = Number(record.getCellValue(upvoteCountField)) || 0;

    const handleClick = async () => {
        if (!canVote || isActing) return;
        setIsActing(true);

        try {
            if (!hasVoted) {
                await upvotesTable.createRecordAsync({
                    [upvoteQuestionField.id]: [{id: record.id}],
                });
            } else {
                await upvotesTable.deleteRecordAsync(myUpvoteRecord);
            }
        } catch (e) {
            console.error('Failed to toggle upvote:', e);
        } finally {
            setIsActing(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={!canVote}
            className={`flex flex-col items-center justify-center min-w-[44px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                hasVoted
                    ? 'pill-voted'
                    : ''
            } ${canVote ? 'cursor-pointer' : 'cursor-default'}`}
            style={!hasVoted ? {background: 'rgba(0,0,0,0.08)', color: '#1d1f25'} : undefined}
        >
            <ArrowFatUpIcon size={16} weight={hasVoted ? 'fill' : 'regular'} />
            <span>{count}</span>
        </button>
    );
}

function QuestionRow({record, qaTable, questionTextField, createdByField, upvotesTable, upvoteQuestionField, upvoteCountField, currentUser, myUpvoteRecord, canVote, canDelete, hideUpvote}) {
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const submitterName = createdBy?.name || 'Someone';
    const isOwner = createdBy?.id === currentUser.id;
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!canDelete || !isOwner) return;
        setIsDeleting(true);
        try {
            await qaTable.deleteRecordAsync(record);
        } catch {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex items-center gap-3 question-card rounded-lg p-3 group">
            {!hideUpvote && (
                <UpvotePill
                    record={record}
                    upvotesTable={upvotesTable}
                    upvoteQuestionField={upvoteQuestionField}
                    upvoteCountField={upvoteCountField}
                    myUpvoteRecord={myUpvoteRecord}
                    canVote={canVote}
                />
            )}
            <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold leading-snug text-gray-gray700 dark:text-gray-gray200">
                    {questionText}
                </p>
                <p className="text-base text-gray-gray400 dark:text-gray-gray500 mt-1">
                    {submitterName}
                </p>
            </div>
            {isOwner && canDelete && (
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md cursor-pointer text-gray-gray400 hover:text-gray-gray600"
                    title="Delete your question"
                >
                    <TrashSimpleIcon size={14} />
                </button>
            )}
        </div>
    );
}

// --- Audience Q/A components ---



// --- Admin components ---

function PresentMode({record, qaTable, questionTextField, createdByField, upvoteCountField, statusField, pendingRecords, onClose, logoUrl, activeEvent}) {
    const [isActing, setIsActing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const upvoteCount = Number(record.getCellValue(upvoteCountField)) || 0;
    const submitterName = createdBy?.name || 'Someone';

    const tryFullscreen = () => {
        document.documentElement.requestFullscreen()
            .then(() => setIsFullscreen(true))
            .catch(() => setIsFullscreen(false));
    };

    useEffect(() => {
        if (!document.fullscreenElement) {
            tryFullscreen();
        } else {
            setIsFullscreen(true);
        }
        const handleFsChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
            } else {
                setIsFullscreen(true);
            }
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }, []);

    const handleAction = async (newStatus) => {
        setIsActing(true);
        try {
            await qaTable.updateRecordAsync(record, {
                [statusField.id]: {name: newStatus},
            });
            if (pendingRecords.length > 0) {
                await qaTable.updateRecordAsync(pendingRecords[0], {
                    [statusField.id]: {name: STATUS.LIVE},
                });
            }
        } catch (e) {
            console.error('Failed to update status:', e);
        } finally {
            setIsActing(false);
        }
    };

    const handleClose = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center present-overlay-solid" style={{color: 'var(--color-accent-text)'}}>
            <button
                onClick={handleClose}
                className="absolute top-6 right-6 p-2 rounded-lg transition-colors cursor-pointer"
                style={{color: 'var(--color-accent-subtext)'}}
            >
                <XIcon size={24} />
            </button>
            {(activeEvent || logoUrl) && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-5" style={{color: 'var(--color-accent-subtext)'}}>
                    {logoUrl && (
                        <>
                            <img src={logoUrl} alt="Logo" className="max-w-[12vw] max-h-[80px] w-auto object-contain" />
                            <div className="w-px h-10" style={{backgroundColor: 'rgba(255,255,255,0.3)'}} />
                        </>
                    )}
                    {activeEvent && (
                        <div>
                            <p className="text-lg font-display font-bold" style={{color: 'var(--color-accent-text)', opacity: 0.85}}>
                                {activeEvent.name}
                            </p>
                            {activeEvent.date && (
                                <p className="text-sm mt-0.5" style={{opacity: 0.6}}>
                                    {new Date(activeEvent.date).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
            {!isFullscreen && (
                <button
                    onClick={tryFullscreen}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                    style={{backgroundColor: 'rgba(255,255,255,0.15)', color: 'var(--color-accent-text)', border: '1px solid rgba(255,255,255,0.25)'}}
                >
                    <CornersOutIcon size={16} />
                    Click to go fullscreen
                </button>
            )}
            <div className="mx-auto px-12 text-center" style={{maxWidth: '80vw', marginTop: '5vh'}}>
                <p className="text-2xl font-medium uppercase tracking-widest live-label-shimmer mb-8">
                    Now Answering
                </p>
                <p className="font-display font-bold mb-8" style={{fontSize: '72px', lineHeight: '1.1'}}>
                    {questionText}
                </p>
                <p className="text-2xl mb-12" style={{color: 'var(--color-accent-subtext)'}}>
                    {submitterName} · {upvoteCount} {upvoteCount === 1 ? 'upvote' : 'upvotes'}
                </p>
                <button
                    onClick={() => handleAction(STATUS.ANSWERED)}
                    disabled={isActing}
                    className="flex items-center gap-2 mx-auto px-6 py-3 rounded-lg text-lg font-semibold transition-all cursor-pointer active:scale-95 present-mark-answered"
                    style={{background: 'none', border: 'none', color: 'var(--color-accent-subtext)'}}
                >
                    <CheckCircleIcon size={28} weight="bold" />
                    Mark Answered
                </button>
            </div>
        </div>
    );
}

function AdminLiveCard({record, qaTable, questionTextField, createdByField, upvoteCountField, statusField, pendingRecords, onPresent}) {
    const [isActing, setIsActing] = useState(false);
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const upvoteCount = Number(record.getCellValue(upvoteCountField)) || 0;
    const submitterName = createdBy?.name || 'Someone';

    const handleAction = async (newStatus) => {
        setIsActing(true);
        try {
            await qaTable.updateRecordAsync(record, {
                [statusField.id]: {name: newStatus},
            });
            if (pendingRecords.length > 0) {
                await qaTable.updateRecordAsync(pendingRecords[0], {
                    [statusField.id]: {name: STATUS.LIVE},
                });
            }
        } catch (e) {
            console.error('Failed to update status:', e);
        } finally {
            setIsActing(false);
        }
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full animate-pulse" style={{backgroundColor: 'var(--color-accent-text)'}} />
                <span className="text-lg font-medium uppercase tracking-widest live-label-shimmer">
                    Now Answering
                </span>
            </div>
            <p className="font-display font-bold leading-snug mb-3" style={{fontSize: '56px', lineHeight: '1.1', color: 'var(--color-accent-text)'}}>
                {questionText}
            </p>
            <p className="text-xl mb-8" style={{color: 'var(--color-accent-subtext)'}}>
                {submitterName} · {upvoteCount} {upvoteCount === 1 ? 'upvote' : 'upvotes'}
            </p>
            <div className="flex items-center gap-8">
                <button
                    onClick={onPresent}
                    className="flex items-center gap-2 text-lg font-bold transition-colors cursor-pointer"
                    style={{background: 'none', border: 'none', color: 'var(--color-accent-text)'}}
                >
                    <PresentationIcon size={22} weight="bold" />
                    Present
                </button>
                <span className="w-px h-5" style={{backgroundColor: 'rgba(255,255,255,0.2)'}} />
                <button
                    onClick={() => handleAction(STATUS.ANSWERED)}
                    disabled={isActing}
                    className="flex items-center gap-2 text-lg transition-colors cursor-pointer present-mark-answered"
                    style={{background: 'none', border: 'none', color: 'var(--color-accent-subtext)'}}
                >
                    <CheckCircleIcon size={20} />
                    Mark Answered
                </button>
                <button
                    onClick={() => handleAction(STATUS.ARCHIVED)}
                    disabled={isActing}
                    className="flex items-center gap-2 text-lg transition-colors cursor-pointer present-mark-answered"
                    style={{background: 'none', border: 'none', color: 'var(--color-accent-subtext)'}}
                >
                    <ArchiveIcon size={20} />
                    Archive
                </button>
            </div>
        </div>
    );
}


function AdminQueueRow({record, qaTable, questionTextField, createdByField, upvoteCountField, statusField, liveRecord, canUpdate}) {
    const [isActing, setIsActing] = useState(false);
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const upvoteCount = Number(record.getCellValue(upvoteCountField)) || 0;
    const submitterName = createdBy?.name || 'Someone';

    const handleGoLive = async () => {
        if (!canUpdate) return;
        setIsActing(true);
        try {
            // Demote current live question back to Pending
            if (liveRecord) {
                await qaTable.updateRecordAsync(liveRecord, {
                    [statusField.id]: {name: STATUS.PENDING},
                });
            }
            await qaTable.updateRecordAsync(record, {
                [statusField.id]: {name: STATUS.LIVE},
            });
        } catch (e) {
            console.error('Failed to go live:', e);
        } finally {
            setIsActing(false);
        }
    };

    const handleArchive = async () => {
        if (!canUpdate) return;
        setIsActing(true);
        try {
            await qaTable.updateRecordAsync(record, {
                [statusField.id]: {name: STATUS.ARCHIVED},
            });
        } catch (e) {
            console.error('Failed to archive:', e);
        } finally {
            setIsActing(false);
        }
    };

    return (
        <div className="flex items-center gap-3 question-card rounded-lg p-3">
            <div className="flex flex-col items-center justify-center min-w-[44px] px-2 py-1.5 rounded-lg text-xs font-bold" style={{backgroundColor: 'var(--color-accent)', color: 'white'}}>
                <ArrowFatUpIcon size={14} />
                <span>{upvoteCount}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold leading-snug text-gray-gray700 dark:text-gray-gray200">
                    {questionText}
                </p>
                <p className="text-base text-gray-gray400 dark:text-gray-gray500 mt-1">
                    {submitterName}
                </p>
            </div>
            {canUpdate && (
                <div className="flex gap-1.5 shrink-0">
                    <button
                        onClick={handleGoLive}
                        disabled={isActing}
                        className="flex items-center gap-1 btn-primary px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                    >
                        <PlayIcon size={12} weight="fill" />
                        Pin Question
                    </button>
                    <button
                        onClick={handleArchive}
                        disabled={isActing}
                        className="p-1.5 rounded-md transition-colors cursor-pointer hover:opacity-100 text-gray-gray400 hover:text-gray-gray600"
                        title="Archive"
                    >
                        <ArchiveIcon size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

function AdminHistoryRow({record, qaTable, questionTextField, createdByField, upvoteCountField, statusField, canUpdate}) {
    const [isActing, setIsActing] = useState(false);
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const upvoteCount = Number(record.getCellValue(upvoteCountField)) || 0;
    const submitterName = createdBy?.name || 'Someone';
    const status = record.getCellValue(statusField);
    const statusName = status?.name || 'Unknown';

    const handleRestore = async () => {
        if (!canUpdate) return;
        setIsActing(true);
        try {
            await qaTable.updateRecordAsync(record, {
                [statusField.id]: {name: STATUS.PENDING},
            });
        } catch (e) {
            console.error('Failed to restore:', e);
        } finally {
            setIsActing(false);
        }
    };

    return (
        <div className="flex items-center gap-3 question-card rounded-lg p-3 opacity-50">
            <div className="flex flex-col items-center justify-center min-w-[44px] px-2 py-1.5 rounded-lg text-xs font-bold" style={{backgroundColor: 'var(--color-accent)', color: 'white'}}>
                <ArrowFatUpIcon size={14} />
                <span>{upvoteCount}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold leading-snug text-gray-gray700 dark:text-gray-gray200">
                    {questionText}
                </p>
                <p className="text-base text-gray-gray400 dark:text-gray-gray500 mt-1">
                    {submitterName}
                </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-gray100 dark:bg-gray-gray600 text-gray-gray500 dark:text-gray-gray400">
                {statusName}
            </span>
            {canUpdate && (
                <button
                    onClick={handleRestore}
                    disabled={isActing}
                    className="p-1.5 rounded-md transition-colors cursor-pointer hover:opacity-100 text-gray-gray400 hover:text-gray-gray600"
                    title="Restore to queue"
                >
                    <ArrowCounterClockwiseIcon size={14} />
                </button>
            )}
        </div>
    );
}

// --- Admin Q/A components ---

function AdminQAQueueRow({record, qaTable, questionTextField, createdByField, aiAnswerField, humanAnswerField, statusField, canUpdate, isLightMode}) {
    const existingHumanAnswer = humanAnswerField ? record.getCellValueAsString(humanAnswerField) : '';
    const [humanAnswer, setHumanAnswer] = useState(existingHumanAnswer);
    const [isActing, setIsActing] = useState(false);
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const submitterName = createdBy?.name || 'Someone';
    const aiAnswer = aiAnswerField ? record.getCellValueAsString(aiAnswerField) : '';

    const handleMarkAnswered = async () => {
        if (!canUpdate) return;
        setIsActing(true);
        try {
            const fields = {[statusField.id]: {name: STATUS.ANSWERED}};
            if (humanAnswerField && humanAnswer.trim()) {
                fields[humanAnswerField.id] = humanAnswer.trim();
            }
            await qaTable.updateRecordAsync(record, fields);
            // Focus the next question's textarea
            setTimeout(() => {
                const textareas = document.querySelectorAll('[data-human-answer]');
                if (textareas.length > 0) textareas[0].focus();
            }, 100);
        } catch (e) {
            console.error('Failed to mark answered:', e);
        } finally {
            setIsActing(false);
        }
    };

    const handleArchive = async () => {
        if (!canUpdate) return;
        setIsActing(true);
        try {
            await qaTable.updateRecordAsync(record, {
                [statusField.id]: {name: STATUS.ARCHIVED},
            });
        } catch (e) {
            console.error('Failed to archive:', e);
        } finally {
            setIsActing(false);
        }
    };

    return (
        <div className={`rounded-lg p-4 ${isLightMode ? 'bg-white border border-gray-gray200' : 'dark-card-pending'}`} style={isLightMode ? {} : {color: 'var(--color-accent-text)'}}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className={`text-lg font-semibold leading-snug ${isLightMode ? 'text-gray-gray700' : ''}`}>{questionText}</p>
                    <p className={`text-sm mt-1 ${isLightMode ? 'text-gray-gray400' : ''}`} style={isLightMode ? {} : {color: 'var(--color-accent-subtext)'}}>{submitterName}</p>
                </div>
                {canUpdate && (
                    <button
                        onClick={handleArchive}
                        disabled={isActing}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer hover:opacity-100 shrink-0 ${isLightMode ? 'text-gray-gray400 hover:text-gray-gray600' : ''}`}
                        style={isLightMode ? {} : {color: 'var(--color-accent-subtext)'}}
                        title="Archive"
                    >
                        <ArchiveIcon size={14} />
                    </button>
                )}
            </div>
            {aiAnswer && (
                <div className={`mt-3 p-3 rounded-md ${isLightMode ? 'bg-gray-gray25' : ''}`} style={isLightMode ? {borderLeft: '3px solid var(--color-primary)'} : {background: 'rgba(255,255,255,0.06)', borderLeft: '3px solid rgba(255,255,255,0.2)'}}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isLightMode ? 'text-gray-gray400' : ''}`} style={isLightMode ? {} : {color: 'var(--color-accent-subtext)'}}>AI Suggestion</p>
                    <div className={`text-sm prose prose-sm max-w-none ${isLightMode ? 'text-gray-gray600' : ''}`} style={isLightMode ? {} : {color: 'var(--color-accent-text)', opacity: 0.9}}>
                        <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{aiAnswer}</Markdown>
                    </div>
                </div>
            )}
            {canUpdate && (
                <div className="mt-3">
                    <textarea
                        data-human-answer
                        value={humanAnswer}
                        onChange={(e) => setHumanAnswer(e.target.value)}
                        onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                e.preventDefault();
                                handleMarkAnswered();
                            }
                        }}
                        placeholder="Write a human answer (optional)... ⌘Enter to submit"
                        rows={2}
                        className={`w-full px-3 py-2 rounded-md text-sm resize-y min-h-[38px] transition-colors ${isLightMode ? 'bg-white text-gray-gray700 border-2 border-gray-gray200' : ''}`}
                        style={isLightMode ? {} : {background: 'rgba(255,255,255,0.1)', color: 'var(--color-accent-text)', border: '1px solid rgba(255,255,255,0.2)'}}
                    />
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={handleMarkAnswered}
                            disabled={isActing}
                            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors cursor-pointer ${isLightMode ? 'text-gray-gray500 hover:text-gray-gray700' : 'present-mark-answered'}`}
                            style={{background: 'none', border: 'none', ...(isLightMode ? {} : {color: 'var(--color-accent-subtext)'})}}
                        >
                            <CheckCircleIcon size={16} weight="bold" />
                            Mark Answered
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function AdminAnsweredCard({record, qaTable, questionTextField, createdByField, aiAnswerField, humanAnswerField, answeredByField, statusField, canUpdate, isLightMode}) {
    const [isActing, setIsActing] = useState(false);
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const submitterName = createdBy?.name || 'Someone';
    const humanAnswer = humanAnswerField ? record.getCellValueAsString(humanAnswerField) : '';
    const aiAnswer = aiAnswerField ? record.getCellValueAsString(aiAnswerField) : '';
    const answer = humanAnswer || aiAnswer;
    const answeredBy = answeredByField ? record.getCellValueAsString(answeredByField) : '';

    const handleRestore = async () => {
        if (!canUpdate) return;
        setIsActing(true);
        try {
            await qaTable.updateRecordAsync(record, {
                [statusField.id]: {name: STATUS.PENDING},
            });
        } catch (e) {
            console.error('Failed to restore:', e);
        } finally {
            setIsActing(false);
        }
    };

    return (
        <div className={`rounded-lg p-4 ${isLightMode ? 'bg-white border border-gray-gray200' : 'dark-card-answered'}`} style={isLightMode ? {borderLeft: '4px solid var(--color-primary)'} : {color: 'var(--color-accent-text)'}}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className={`text-lg font-semibold leading-snug ${isLightMode ? 'text-gray-gray700' : ''}`}>{questionText}</p>
                    <span className={`text-xs mt-1 inline-block ${isLightMode ? 'text-gray-gray400' : ''}`} style={isLightMode ? {} : {color: 'var(--color-accent-subtext)'}}>{submitterName}</span>
                </div>
                {canUpdate && (
                    <button
                        onClick={handleRestore}
                        disabled={isActing}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer hover:opacity-100 ${isLightMode ? 'text-gray-gray400 hover:text-gray-gray600' : ''}`}
                        style={isLightMode ? {} : {color: 'var(--color-accent-subtext)'}}
                        title="Restore to pending"
                    >
                        <ArrowCounterClockwiseIcon size={14} />
                    </button>
                )}
            </div>
            {answer && (
                <div className={`mt-3 pt-3 ${isLightMode ? 'border-t border-gray-gray200' : ''}`} style={isLightMode ? {} : {borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                    <div className={`text-sm prose prose-sm max-w-none ${isLightMode ? 'text-gray-gray600' : ''}`} style={isLightMode ? {} : {color: 'var(--color-accent-text)', opacity: 0.9}}><Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{answer}</Markdown></div>
                    {answeredBy && (
                        <div className={`flex items-center gap-2 mt-3 pt-3 ${isLightMode ? 'border-t border-gray-gray200' : ''}`} style={isLightMode ? {} : {borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                            <span className={`text-xs ${isLightMode ? 'text-gray-gray400' : ''}`} style={isLightMode ? {} : {color: 'var(--color-accent-subtext)'}}>Answered by:</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${isLightMode ? 'bg-gray-gray100 text-gray-gray600 border border-gray-gray200' : ''}`} style={isLightMode ? {} : {background: 'rgba(255,255,255,0.12)', color: 'var(--color-accent-text)'}}>
                                {answeredBy}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Setup components ---

function EventForm({eventsTable, eventRecord, allEventRecords, primaryColorField, eventDateField, eventDescriptionField, eventLiveField, eventTypeField, onSave, onCancel}) {
    const isNew = !eventRecord;
    const [name, setName] = useState(isNew ? '' : eventRecord.getCellValueAsString(eventsTable.primaryField));
    const [date, setDate] = useState(isNew ? '' : (eventDateField ? eventRecord.getCellValue(eventDateField) || '' : ''));
    const [description, setDescription] = useState(isNew ? '' : (eventDescriptionField ? eventRecord.getCellValueAsString(eventDescriptionField) : ''));
    const [primaryColor, setPrimaryColor] = useState(isNew ? '#166ee1' : (primaryColorField ? eventRecord.getCellValueAsString(primaryColorField) : '#166ee1'));
    const [isLive, setIsLive] = useState(isNew ? false : (eventLiveField ? !!eventRecord.getCellValue(eventLiveField) : false));
    const [eventType, setEventType] = useState(isNew ? 'Live Questions' : (eventTypeField ? (eventRecord.getCellValue(eventTypeField)?.name || 'Live Questions') : 'Live Questions'));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Event name is required.');
            return;
        }
        setIsSaving(true);
        setError(null);

        try {
            const fields = {};
            fields[eventsTable.primaryField.id] = name.trim();
            if (eventDateField) fields[eventDateField.id] = date || null;
            if (eventDescriptionField) fields[eventDescriptionField.id] = description;
            if (primaryColorField) fields[primaryColorField.id] = primaryColor;
            if (eventLiveField) fields[eventLiveField.id] = isLive;
            if (eventTypeField) fields[eventTypeField.id] = {name: eventType};

            // Ensure only one event is live at a time
            if (isLive && eventLiveField && allEventRecords) {
                for (const record of allEventRecords) {
                    if (record.id !== eventRecord?.id && record.getCellValue(eventLiveField)) {
                        await eventsTable.updateRecordAsync(record, {[eventLiveField.id]: false});
                    }
                }
            }

            if (isNew) {
                await eventsTable.createRecordAsync(fields);
            } else {
                await eventsTable.updateRecordAsync(eventRecord, fields);
            }
            onSave();
        } catch (e) {
            console.error('Failed to save event:', e);
            setError('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = 'w-full px-3 py-2 rounded-md text-sm bg-white dark:bg-gray-gray700 text-gray-gray700 dark:text-gray-gray200 border border-gray-gray200 dark:border-gray-gray600 outline-none input-themed';
    const labelClass = 'text-xs font-semibold text-gray-gray500 dark:text-gray-gray400 uppercase tracking-wider mb-0.5 block';
    const helpClass = 'text-xs text-gray-gray400 dark:text-gray-gray500 mb-1.5';

    return (
        <div className="bg-gray-gray25 dark:bg-gray-gray700 rounded-lg p-6">
            <h2 className="text-xl font-display font-bold text-gray-gray700 dark:text-gray-gray200 mb-6">
                {isNew ? 'Create Event' : 'Edit Event'}
            </h2>

            <div className="space-y-4">
                <div>
                    <label className={labelClass}>Event Name</label>
                    <p className={helpClass}>The title displayed to attendees and in the event picker.</p>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Q1 All Hands"
                    />
                </div>

                {eventTypeField && (
                    <div>
                        <label className={labelClass}>Event Type</label>
                        <p className={helpClass}>Live Questions uses upvoting and a live queue. Q&amp;A lets attendees ask questions and admins post answers.</p>
                        <div className="flex gap-2">
                            {['Live Questions', 'Q/A'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setEventType(type)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                        eventType === type
                                            ? 'bg-gray-gray700 dark:bg-gray-gray200 text-white dark:text-gray-gray800'
                                            : 'bg-gray-gray75 dark:bg-gray-gray600 text-gray-gray500 dark:text-gray-gray400 hover:bg-gray-gray100 dark:hover:bg-gray-gray500'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {eventDateField && (
                    <div>
                        <label className={labelClass}>Date</label>
                        <p className={helpClass}>When the event takes place. Used for sorting events (most recent first).</p>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                )}

                {eventDescriptionField && (
                    <div>
                        <label className={labelClass}>Description</label>
                        <p className={helpClass}>Optional context about the event for organizers.</p>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={`${inputClass} min-h-[80px] resize-y`}
                            placeholder="What's this event about?"
                        />
                    </div>
                )}

                {primaryColorField && (
                    <div>
                        <label className={labelClass}>Brand Color</label>
                        <p className={helpClass}>The primary color used throughout the interface. An accent color is derived automatically.</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-0"
                            />
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className={`${inputClass} font-mono max-w-[140px]`}
                            />
                        </div>
                    </div>
                )}

                {!isNew && eventRecord && eventsTable.hasPermissionToExpandRecords() && (
                    <div>
                        <label className={labelClass}>Logos</label>
                        <p className={helpClass}>Upload your primary and secondary logos via the record detail page. Use a white/light logo as secondary for presentation mode on dark backgrounds.</p>
                        <button
                            onClick={() => expandRecord(eventRecord)}
                            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-gray-gray500 dark:text-gray-gray400 bg-gray-gray75 dark:bg-gray-gray600 hover:bg-gray-gray100 dark:hover:bg-gray-gray500 transition-colors cursor-pointer"
                        >
                            Open record to manage logos
                        </button>
                    </div>
                )}
                {isNew && (
                    <p className="text-xs text-gray-gray400 dark:text-gray-gray500">
                        After creating the event, you can add logos by editing it.
                    </p>
                )}
            </div>

            {error && (
                <p className="text-xs text-red-red mt-3">{error}</p>
            )}

            <div className="flex items-center gap-3 mt-6">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary px-5 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer"
                >
                    {isSaving ? 'Saving...' : (isNew ? 'Create Event' : 'Save Changes')}
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-md text-sm text-gray-gray500 dark:text-gray-gray400 hover:bg-gray-gray75 dark:hover:bg-gray-gray600 transition-colors cursor-pointer"
                >
                    Cancel
                </button>
                {eventLiveField && (
                    <button
                        onClick={() => setIsLive(!isLive)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer ml-auto ${
                            isLive
                                ? 'bg-green-green text-white'
                                : 'bg-gray-gray100 dark:bg-gray-gray600 text-gray-gray500 dark:text-gray-gray400'
                        }`}
                    >
                        <BroadcastIcon size={16} weight={isLive ? 'fill' : 'regular'} />
                        {isLive ? 'Live' : 'Not Live'}
                    </button>
                )}
            </div>
        </div>
    );
}

// Ensures only one event is live at a time. Sets all others to false before
// setting the target to true. If toggling off, just sets the target to false.
async function toggleEventLive(eventsTable, eventLiveField, allEventRecords, targetRecord, newLiveValue) {
    if (newLiveValue) {
        // Unset any other live events first
        for (const record of allEventRecords) {
            if (record.id !== targetRecord.id && eventLiveField && record.getCellValue(eventLiveField)) {
                await eventsTable.updateRecordAsync(record, {[eventLiveField.id]: false});
            }
        }
    }
    await eventsTable.updateRecordAsync(targetRecord, {[eventLiveField.id]: newLiveValue});
}

function SetupContent({eventsTable, primaryColorField, logoField, eventDateField, eventDescriptionField, eventLiveField, eventTypeField}) {
    const allEventRecords = useRecords(eventsTable);
    const [editingEventId, setEditingEventId] = useState(null);
    const [creating, setCreating] = useState(false);

    const canCreate = eventsTable.hasPermissionToCreateRecords();
    const canUpdate = eventsTable.hasPermissionToUpdateRecords();

    const events = getSortedEvents(allEventRecords, eventsTable);

    if (creating) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-gray800 p-4 sm:p-6">
                <div className="max-w-2xl mx-auto">
                    <EventForm
                        eventsTable={eventsTable}
                        eventRecord={null}
                        allEventRecords={allEventRecords}
                        primaryColorField={primaryColorField}
                        eventDateField={eventDateField}
                        eventDescriptionField={eventDescriptionField}
                        eventLiveField={eventLiveField}
                        eventTypeField={eventTypeField}
                        onSave={() => setCreating(false)}
                        onCancel={() => setCreating(false)}
                    />
                </div>
            </div>
        );
    }

    if (editingEventId) {
        const eventRecord = allEventRecords.find((r) => r.id === editingEventId);
        if (!eventRecord) {
            setEditingEventId(null);
            return null;
        }
        return (
            <div className="min-h-screen bg-white dark:bg-gray-gray800 p-4 sm:p-6">
                <div className="max-w-2xl mx-auto">
                    <EventForm
                        eventsTable={eventsTable}
                        eventRecord={eventRecord}
                        allEventRecords={allEventRecords}
                        primaryColorField={primaryColorField}
                        eventDateField={eventDateField}
                        eventDescriptionField={eventDescriptionField}
                        eventLiveField={eventLiveField}
                        eventTypeField={eventTypeField}
                        onSave={() => setEditingEventId(null)}
                        onCancel={() => setEditingEventId(null)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-gray800 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
                <p className="text-4xl font-display font-bold mb-1 text-gray-gray900 dark:text-gray-gray200">
                    Air<span className="pulse-text" style={{color: '#FCB42A'}}>Pulse</span>
                </p>
                <p className="text-sm text-gray-gray400 dark:text-gray-gray500 mb-6">
                    Create and manage your events. Set branding, toggle events live, and configure logos.
                </p>
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-display font-semibold text-gray-gray700 dark:text-gray-gray200">
                        Events
                    </h1>
                    {canCreate && (
                        <button
                            onClick={() => setCreating(true)}
                            className="flex items-center gap-1.5 btn-primary px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer"
                        >
                            <PlusIcon size={16} weight="bold" />
                            New Event
                        </button>
                    )}
                </div>

                {events.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                        <p className="text-base text-gray-gray400 dark:text-gray-gray500">
                            No events yet. Create one to get started.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map((event) => {
                            const eventRecord = allEventRecords.find((r) => r.id === event.id);
                            const isLive = eventRecord && eventLiveField ? !!eventRecord.getCellValue(eventLiveField) : false;
                            const eventPrimaryColor = eventRecord && primaryColorField ? eventRecord.getCellValueAsString(primaryColorField) : '';
                            const logoUrl = getEventLogo(eventRecord, logoField);

                            return (
                                <div
                                    key={event.id}
                                    onClick={canUpdate ? () => setEditingEventId(event.id) : undefined}
                                    className={`flex items-center gap-4 bg-gray-gray25 dark:bg-gray-gray700 rounded-lg p-4 transition-colors ${canUpdate ? 'cursor-pointer hover:bg-gray-gray75 dark:hover:bg-gray-gray600' : ''}`}
                                >
                                    {logoUrl && (
                                        <img src={logoUrl} alt="" className="w-10 h-10 object-contain rounded" />
                                    )}
                                    {!logoUrl && eventPrimaryColor && (
                                        <div
                                            className="w-10 h-10 rounded shrink-0"
                                            style={{background: eventPrimaryColor}}
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg font-semibold text-gray-gray700 dark:text-gray-gray200">
                                            {event.name}
                                        </p>
                                        {event.date && (
                                            <p className="text-sm text-gray-gray400 dark:text-gray-gray500">
                                                {new Date(event.date).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})}
                                            </p>
                                        )}
                                    </div>
                                    {canUpdate && eventLiveField && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleEventLive(eventsTable, eventLiveField, allEventRecords, eventRecord, !isLive)
                                                    .catch((err) => console.error('Failed to toggle live:', err));
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                                isLive
                                                    ? 'bg-green-green text-white'
                                                    : 'bg-gray-gray100 dark:bg-gray-gray600 text-gray-gray500 dark:text-gray-gray400'
                                            }`}
                                        >
                                            <BroadcastIcon size={12} weight={isLive ? 'fill' : 'regular'} />
                                            {isLive ? 'Live' : 'Not Live'}
                                        </button>
                                    )}
                                    {canUpdate && (
                                        <PencilSimpleIcon size={16} className="text-gray-gray400 shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Content views ---

function AdminContent({eventsTable, primaryColorField, logoField, secondaryLogoField, qaTable, questionTextField, upvoteCountField, statusField, createdByField, eventField, eventTypeField, aiAnswerField, humanAnswerField, answeredByField}) {
    const allEventRecords = useRecords(eventsTable);
    const allRecords = useRecords(qaTable);
    const [selectedEventId, setSelectedEventId] = useState(() => {
        try { return localStorage.getItem('airpulse_event') || null; }
        catch { return null; }
    });
    const [showHistory, setShowHistory] = useState(false);
    const [presenting, setPresenting] = useState(false);
    const [qaFilter, setQaFilter] = useState('all');

    const events = getSortedEvents(allEventRecords, eventsTable);

    // Auto-select: use persisted event if it exists in the list, otherwise most recent
    useEffect(() => {
        if (events.length > 0) {
            if (!selectedEventId || !events.some((e) => e.id === selectedEventId)) {
                setSelectedEventId(events[0].id);
            }
        }
    }, [events.length, selectedEventId, events]);

    const activeEventId = selectedEventId;

    const activeEvent = events.find((e) => e.id === activeEventId);
    const activeEventRecord = allEventRecords.find((r) => r.id === activeEventId);

    // Branding from active event
    const branding = getEventBranding(activeEventRecord, primaryColorField);
    const logoUrl = getEventLogo(activeEventRecord, logoField);
    const secondaryLogoUrl = getEventLogo(activeEventRecord, secondaryLogoField);
    const presentLogoUrl = secondaryLogoUrl || logoUrl;

    const records = activeEventId
        ? allRecords.filter((r) => {
            const eventLinks = r.getCellValue(eventField);
            return eventLinks?.some((link) => link.id === activeEventId);
        })
        : allRecords;

    const liveRecords = records.filter((r) => {
        const status = r.getCellValue(statusField);
        return status?.name === STATUS.LIVE;
    });

    const liveRecord = liveRecords.length > 0
        ? [...liveRecords].sort((a, b) => {
            const aCount = Number(a.getCellValue(upvoteCountField)) || 0;
            const bCount = Number(b.getCellValue(upvoteCountField)) || 0;
            return bCount - aCount;
        })[0]
        : null;

    const excludedStatuses = new Set([STATUS.LIVE, STATUS.ANSWERED, STATUS.ARCHIVED]);
    const pendingRecords = records
        .filter((r) => {
            const status = r.getCellValue(statusField);
            return !excludedStatuses.has(status?.name);
        })
        .sort((a, b) => {
            const aCount = Number(a.getCellValue(upvoteCountField)) || 0;
            const bCount = Number(b.getCellValue(upvoteCountField)) || 0;
            return bCount - aCount;
        });

    const historyRecords = records.filter((r) => {
        const status = r.getCellValue(statusField);
        return status?.name === STATUS.ANSWERED || status?.name === STATUS.ARCHIVED;
    });

    const answeredRecords = records.filter((r) => {
        const status = r.getCellValue(statusField);
        return status?.name === STATUS.ANSWERED;
    });

    const canUpdate = qaTable.hasPermissionToUpdateRecords();

    const eventType = activeEventRecord && eventTypeField ? (activeEventRecord.getCellValue(eventTypeField)?.name || 'Live Questions') : 'Live Questions';
    const isQA = eventType === 'Q/A';

    const showPicker = events.length > 1;

    const eventPickerDropdown = showPicker ? (
        <div className="fixed top-3 right-14 z-40">
            <select
                value={activeEventId || ''}
                onChange={(e) => { setSelectedEventId(e.target.value); try { localStorage.setItem('airpulse_event', e.target.value); } catch { /* sandboxed */ } }}
                className="text-xs px-3 h-[34px] w-48 rounded-lg bg-white/80 dark:bg-gray-gray700/80 text-gray-gray500 dark:text-gray-gray400 border-none outline-none cursor-pointer appearance-none backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-gray-gray700 transition-colors truncate"
                style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23979aa0\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: '20px'}}
            >
                {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                ))}
            </select>
        </div>
    ) : null;

    if (!activeEventId) {
        return (
            <ThemeProvider primaryColor={branding.primaryColor}>
                {eventPickerDropdown}
                <div className="flex items-center justify-center min-h-screen">
                    <p className="text-base text-gray-gray400 dark:text-gray-gray500">
                        No active event. Check back when an event goes live.
                    </p>
                </div>
            </ThemeProvider>
        );
    }

    if (isQA) {
        // Q/A Admin: split layout leftFlex=2 (white, branding), rightFlex=3 (dark accent, cards)
        const totalQuestions = pendingRecords.length + answeredRecords.length;
        const completionPct = totalQuestions > 0 ? Math.round((answeredRecords.length / totalQuestions) * 100) : 0;

        const leftPanel = (
            <div className="relative h-full min-h-[60vh] flex flex-col items-center justify-center" style={{color: 'var(--color-accent-text)'}}>
                {/* Logo + event bar at top */}
                {activeEvent && (
                    <div className="absolute top-8 left-10 flex items-center gap-5" style={{color: 'var(--color-accent-subtext)'}}>
                        {logoUrl && (
                            <>
                                <img src={secondaryLogoUrl || logoUrl} alt="Logo" className="max-w-[12vw] max-h-[80px] w-auto object-contain" />
                                <div className="w-px h-12" style={{backgroundColor: 'rgba(255,255,255,0.3)'}} />
                            </>
                        )}
                        <div>
                            <p className="text-xl font-display font-bold" style={{color: 'var(--color-accent-text)'}}>
                                {activeEvent.name}
                            </p>
                            {activeEvent.date && (
                                <p className="text-sm mt-1" style={{opacity: 0.6}}>
                                    {new Date(activeEvent.date).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="px-10 w-full max-w-sm">
                    {/* Progress ring */}
                    <div className="flex justify-center mb-8">
                        <div className="relative w-36 h-36">
                            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
                                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-primary)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${completionPct * 3.27} 327`} style={{transition: 'stroke-dasharray 0.5s ease'}} />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-display font-bold">{completionPct}%</span>
                                <span className="text-xs uppercase tracking-widest mt-0.5" style={{color: 'var(--color-accent-subtext)'}}>Complete</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 rounded-lg" style={{backgroundColor: 'rgba(255,255,255,0.08)'}}>
                            <p className="text-3xl font-display font-bold">{pendingRecords.length}</p>
                            <p className="text-xs uppercase tracking-wider mt-1" style={{color: 'var(--color-accent-subtext)'}}>Pending</p>
                        </div>
                        <div className="text-center p-4 rounded-lg" style={{backgroundColor: 'rgba(255,255,255,0.08)'}}>
                            <p className="text-3xl font-display font-bold">{answeredRecords.length}</p>
                            <p className="text-xs uppercase tracking-wider mt-1" style={{color: 'var(--color-accent-subtext)'}}>Answered</p>
                        </div>
                    </div>

                    <div className="text-center p-4 rounded-lg" style={{backgroundColor: 'rgba(255,255,255,0.08)'}}>
                        <p className="text-3xl font-display font-bold">{totalQuestions}</p>
                        <p className="text-xs uppercase tracking-wider mt-1" style={{color: 'var(--color-accent-subtext)'}}>Total Questions</p>
                    </div>
                </div>

            </div>
        );

        const rightPanel = (
            <div className="flex flex-col h-full">
                <div className="shrink-0 px-10 pt-8 pb-4 bg-white" style={{boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', zIndex: 10, position: 'relative'}}>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-gray700">
                            Admin — Q/A ({pendingRecords.length + answeredRecords.length})
                        </p>
                        <div className="flex items-center gap-2">
                            {showPicker && (
                                <select
                                    value={activeEventId || ''}
                                    onChange={(e) => { setSelectedEventId(e.target.value); try { localStorage.setItem('airpulse_event', e.target.value); } catch { /* sandboxed */ } }}
                                    className="text-xs px-3 h-[34px] w-48 rounded-lg bg-gray-gray25 text-gray-gray500 border border-gray-gray200 outline-none cursor-pointer appearance-none truncate"
                                    style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23979aa0\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: '20px'}}
                                >
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>{event.name}</option>
                                    ))}
                                </select>
                            )}
                            <FullscreenToggle />
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-10 py-4 bg-gray-gray25">
                    <FilterTabs filter={qaFilter} setFilter={setQaFilter} pendingCount={pendingRecords.length} answeredCount={answeredRecords.length} isLightMode />
                    {(qaFilter === 'all' || qaFilter === 'pending') && pendingRecords.length > 0 && (
                        <>
                            <p className="text-base font-bold uppercase tracking-wider mb-3 pb-2 text-gray-gray700 border-b border-gray-gray200">
                                Pending ({pendingRecords.length})
                            </p>
                            <div className="space-y-3 mb-6">
                                {pendingRecords.map((record) => (
                                    <AdminQAQueueRow key={record.id} record={record} qaTable={qaTable} questionTextField={questionTextField} createdByField={createdByField} aiAnswerField={aiAnswerField} humanAnswerField={humanAnswerField} statusField={statusField} canUpdate={canUpdate} isLightMode />
                                ))}
                            </div>
                        </>
                    )}
                    {(qaFilter === 'all' || qaFilter === 'answered') && answeredRecords.length > 0 && (
                        <>
                            <p className="text-base font-bold uppercase tracking-wider mb-3 pb-2 text-gray-gray700 border-b border-gray-gray200">
                                Answered ({answeredRecords.length})
                            </p>
                            <div className="space-y-3">
                                {answeredRecords.map((record) => (
                                    <AdminAnsweredCard key={record.id} record={record} qaTable={qaTable} questionTextField={questionTextField} createdByField={createdByField} aiAnswerField={aiAnswerField} humanAnswerField={humanAnswerField} answeredByField={answeredByField} statusField={statusField} canUpdate={canUpdate} isLightMode />
                                ))}
                            </div>
                        </>
                    )}
                    {pendingRecords.length === 0 && answeredRecords.length === 0 && (
                        <div className="flex items-center justify-center py-16">
                            <p className="text-base text-gray-gray400">No questions yet.</p>
                        </div>
                    )}
                </div>
            </div>
        );

        return (
            <ThemeProvider primaryColor={branding.primaryColor}>
                <SplitLayout
                    left={leftPanel}
                    right={rightPanel}
                    leftFlex={2}
                    rightFlex={3}
                    leftCenter
                    leftStyle={{backgroundColor: 'var(--color-accent)'}}
                    rightStyle={{backgroundColor: 'white', padding: 0, overflow: 'hidden'}}
                />
            </ThemeProvider>
        );
    }

    // Live Questions Admin: split layout leftFlex=3 (dark accent), rightFlex=2 (white, queue)
    const leftPanel = (
        <div className="relative h-full min-h-[60vh]" style={{color: 'var(--color-accent-text)'}}>
            <div className="flex flex-col justify-center h-full px-6 sm:px-10 py-20">
                    {liveRecord ? (
                        <AdminLiveCard
                            record={liveRecord}
                            qaTable={qaTable}
                            questionTextField={questionTextField}
                            createdByField={createdByField}
                            upvoteCountField={upvoteCountField}
                            statusField={statusField}
                            pendingRecords={pendingRecords}
                            onPresent={() => setPresenting(true)}
                        />
                    ) : (
                        <div className="py-16 text-center">
                            <p className="text-base" style={{color: 'var(--color-accent-subtext)'}}>
                                No live question. Pick one from the queue.
                            </p>
                        </div>
                    )}
            </div>
            {activeEvent && (
                <div className="absolute bottom-8 left-10 flex items-center gap-4" style={{color: 'var(--color-accent-subtext)'}}>
                    {logoUrl && (
                        <>
                            <img src={secondaryLogoUrl || logoUrl} alt="Logo" className="max-w-[12vw] max-h-[80px] w-auto object-contain" />
                            <div className="w-px h-12" style={{backgroundColor: 'rgba(255,255,255,0.3)'}} />
                        </>
                    )}
                    <div>
                        <p className="text-lg font-display font-bold" style={{color: 'var(--color-accent-text)', opacity: 0.8}}>
                            {activeEvent.name}
                        </p>
                        {activeEvent.date && (
                            <p className="text-xs mt-0.5" style={{opacity: 0.6}}>
                                {new Date(activeEvent.date).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const rightPanel = (
        <div>
            <p className="text-sm font-bold text-gray-gray700 dark:text-gray-gray200 uppercase tracking-wider mb-3">
                Queue ({pendingRecords.length} question{pendingRecords.length !== 1 ? 's' : ''})
            </p>
            {pendingRecords.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                    <p className="text-base text-gray-gray400 dark:text-gray-gray500">
                        No pending questions.
                    </p>
                </div>
            ) : (
                <div className="space-y-2 mb-6">
                    {pendingRecords.map((record) => (
                        <AdminQueueRow
                            key={record.id}
                            record={record}
                            qaTable={qaTable}
                            questionTextField={questionTextField}
                            createdByField={createdByField}
                            upvoteCountField={upvoteCountField}
                            statusField={statusField}
                            liveRecord={liveRecord}
                            canUpdate={canUpdate}
                        />
                    ))}
                </div>
            )}
            {historyRecords.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-gray500 dark:text-gray-gray400 uppercase tracking-wider mb-2 cursor-pointer hover:text-gray-gray600 dark:hover:text-gray-gray300 transition-colors"
                    >
                        {showHistory ? <CaretUpIcon size={12} /> : <CaretDownIcon size={12} />}
                        History ({historyRecords.length})
                    </button>
                    {showHistory && (
                        <div className="space-y-2">
                            {historyRecords.map((record) => (
                                <AdminHistoryRow
                                    key={record.id}
                                    record={record}
                                    qaTable={qaTable}
                                    questionTextField={questionTextField}
                                    createdByField={createdByField}
                                    upvoteCountField={upvoteCountField}
                                    statusField={statusField}
                                    canUpdate={canUpdate}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <ThemeProvider primaryColor={branding.primaryColor}>
            {eventPickerDropdown}
            {presenting && liveRecord && (
                <PresentMode
                    record={liveRecord}
                    qaTable={qaTable}
                    questionTextField={questionTextField}
                    createdByField={createdByField}
                    upvoteCountField={upvoteCountField}
                    statusField={statusField}
                    pendingRecords={pendingRecords}
                    onClose={() => setPresenting(false)}
                    logoUrl={presentLogoUrl}
                    activeEvent={activeEvent}
                />
            )}
            <SplitLayout
                left={leftPanel}
                right={rightPanel}
                leftFlex={3}
                rightFlex={2}
                leftCenter
                leftStyle={{backgroundColor: 'var(--color-accent)'}}
                rightStyle={{backgroundColor: 'white'}}
            />
        </ThemeProvider>
    );
}

function QAContent({eventsTable, primaryColorField, logoField, secondaryLogoField, qaTable, questionTextField, upvotesTable, upvoteQuestionField, upvoteCreatedByField, upvoteCountField, statusField, createdByField, eventField, eventTypeField, aiAnswerField, humanAnswerField, answeredByField, eventDescriptionField}) {
    const session = useSession();
    const currentUser = session.currentUser;
    const allEventRecords = useRecords(eventsTable);
    const allRecords = useRecords(qaTable);
    const allUpvoteRecords = useRecords(upvotesTable);
    const [selectedEventId, setSelectedEventId] = useState(() => {
        try { return localStorage.getItem('airpulse_event') || null; }
        catch { return null; }
    });
    const [expandedAnswerId, setExpandedAnswerId] = useState(null);
    const [qaFilter, setQaFilter] = useState('all');

    const events = getSortedEvents(allEventRecords, eventsTable);

    // Auto-select: use persisted event if it exists in the list, otherwise most recent
    useEffect(() => {
        if (events.length > 0) {
            if (!selectedEventId || !events.some((e) => e.id === selectedEventId)) {
                setSelectedEventId(events[0].id);
            }
        }
    }, [events.length, selectedEventId, events]);

    const activeEventId = selectedEventId;

    const activeEvent = events.find((e) => e.id === activeEventId);
    const activeEventRecord = allEventRecords.find((r) => r.id === activeEventId);

    // Branding from active event
    const branding = getEventBranding(activeEventRecord, primaryColorField);
    const logoUrl = getEventLogo(activeEventRecord, logoField);
    const secondaryLogoUrl = getEventLogo(activeEventRecord, secondaryLogoField);

    const records = activeEventId
        ? allRecords.filter((r) => {
            const eventLinks = r.getCellValue(eventField);
            return eventLinks?.some((link) => link.id === activeEventId);
        })
        : allRecords;

    const liveRecords = records.filter((r) => {
        const status = r.getCellValue(statusField);
        return status?.name === STATUS.LIVE;
    });

    const liveRecord = liveRecords.length > 0
        ? [...liveRecords].sort((a, b) => {
            const aCount = Number(a.getCellValue(upvoteCountField)) || 0;
            const bCount = Number(b.getCellValue(upvoteCountField)) || 0;
            return bCount - aCount;
        })[0]
        : null;

    const excludedStatuses = new Set([STATUS.LIVE, STATUS.ANSWERED, STATUS.ARCHIVED]);
    const pendingRecords = records
        .filter((r) => {
            const status = r.getCellValue(statusField);
            return !excludedStatuses.has(status?.name);
        })
        .sort((a, b) => {
            const aCount = Number(a.getCellValue(upvoteCountField)) || 0;
            const bCount = Number(b.getCellValue(upvoteCountField)) || 0;
            return bCount - aCount;
        });

    const eventType = activeEventRecord && eventTypeField ? (activeEventRecord.getCellValue(eventTypeField)?.name || 'Live Questions') : 'Live Questions';
    const isQA = eventType === 'Q/A';

    const answeredRecords = isQA ? records.filter((r) => {
        const status = r.getCellValue(statusField);
        return status?.name === STATUS.ANSWERED;
    }) : [];

    const myPendingRecords = pendingRecords.filter((r) => r.getCellValue(createdByField)?.id === currentUser.id);
    const myAnsweredRecords = answeredRecords.filter((r) => r.getCellValue(createdByField)?.id === currentUser.id);
    const myCount = myPendingRecords.length + myAnsweredRecords.length;

    const canDelete = qaTable.hasPermissionToDeleteRecords();
    const canVote = upvotesTable.hasPermissionToCreateRecords() && upvotesTable.hasPermissionToDeleteRecords();

    // Build lookup: questionId -> this user's upvote record (for toggle/dedup)
    const myUpvotesByQuestion = new Map();
    for (const upvote of allUpvoteRecords) {
        const createdBy = upvote.getCellValue(upvoteCreatedByField);
        if (createdBy?.id === currentUser.id) {
            const questionLinks = upvote.getCellValue(upvoteQuestionField);
            if (questionLinks) {
                for (const link of questionLinks) {
                    myUpvotesByQuestion.set(link.id, upvote);
                }
            }
        }
    }

    const showPicker = events.length > 1;

    const eventPickerDropdown = showPicker ? (
        <div className="fixed top-3 right-14 z-40">
            <select
                value={activeEventId || ''}
                onChange={(e) => { setSelectedEventId(e.target.value); try { localStorage.setItem('airpulse_event', e.target.value); } catch { /* sandboxed */ } }}
                className="text-xs px-3 h-[34px] w-48 rounded-lg bg-white/80 dark:bg-gray-gray700/80 text-gray-gray500 dark:text-gray-gray400 border-none outline-none cursor-pointer appearance-none backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-gray-gray700 transition-colors truncate"
                style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23979aa0\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: '20px'}}
            >
                {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                ))}
            </select>
        </div>
    ) : null;

    if (!activeEventId) {
        return (
            <ThemeProvider primaryColor={branding.primaryColor}>
                {eventPickerDropdown}
                <div className="flex items-center justify-center min-h-screen">
                    <p className="text-base text-gray-gray400 dark:text-gray-gray500">
                        No active event. Check back when an event goes live.
                    </p>
                </div>
            </ThemeProvider>
        );
    }

    if (isQA) {
        // Q/A Audience: split layout leftFlex=2 (white, branding + input), rightFlex=3 (dark accent, board)
        const leftPanel = (
            <div className="relative h-full min-h-[60vh]">
                <div className="flex flex-col justify-center h-full px-6 sm:px-10 py-20">
                    {activeEvent && (
                        <div className="flex items-center gap-6 mb-8">
                            {logoUrl && (
                                <>
                                    <img src={logoUrl} alt="Logo" className="max-w-[12vw] max-h-[80px] w-auto object-contain" />
                                    <div className="w-px h-16 bg-gray-gray200" />
                                </>
                            )}
                            <div>
                                <p className="text-3xl font-display font-bold text-gray-gray700">
                                    {activeEvent.name}
                                </p>
                                {activeEvent.date && (
                                    <p className="text-base text-gray-gray400 mt-1">
                                        {new Date(activeEvent.date).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                    {activeEventRecord && eventDescriptionField && activeEventRecord.getCellValueAsString(eventDescriptionField) && (
                        <p className="text-base text-gray-gray500 mb-6">
                            {activeEventRecord.getCellValueAsString(eventDescriptionField)}
                        </p>
                    )}
                    <div>
                        <p className="text-base font-bold text-gray-gray700 uppercase tracking-wider mb-2">
                            Ask a Question
                        </p>
                        <QuestionInput qaTable={qaTable} questionTextField={questionTextField} eventField={eventField} selectedEventId={activeEventId} />
                    </div>
                </div>
            </div>
        );

        const rightPanel = (
            <div className="flex flex-col h-full" style={{color: 'var(--color-accent-text)'}}>
                <div className="shrink-0 px-10 pt-8 pb-4" style={{backgroundColor: 'var(--color-accent)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)', zIndex: 10, position: 'relative'}}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold uppercase tracking-wider" style={{color: 'var(--color-accent-text)'}}>
                            Question Board ({pendingRecords.length + answeredRecords.length})
                        </p>
                        <div className="flex items-center gap-2">
                            {showPicker && (
                                <select
                                    value={activeEventId || ''}
                                    onChange={(e) => { setSelectedEventId(e.target.value); try { localStorage.setItem('airpulse_event', e.target.value); } catch { /* sandboxed */ } }}
                                    className="text-xs px-3 h-[34px] w-48 rounded-lg outline-none cursor-pointer appearance-none truncate"
                                    style={{backgroundColor: 'rgba(255,255,255,0.12)', color: 'var(--color-accent-text)', border: '1px solid rgba(255,255,255,0.2)', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'white\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: '20px'}}
                                >
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>{event.name}</option>
                                    ))}
                                </select>
                            )}
                            <FullscreenToggle />
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-10 py-4">
                    <FilterTabs filter={qaFilter} setFilter={setQaFilter} pendingCount={pendingRecords.length} answeredCount={answeredRecords.length} myCount={myCount} isLightMode={false} />
                    {qaFilter === 'mine' && (
                        <>
                            {myCount === 0 ? (
                                <div className="flex items-center justify-center py-16">
                                    <p className="text-base" style={{color: 'var(--color-accent-subtext)'}}>You haven&apos;t asked any questions yet.</p>
                                </div>
                            ) : (
                                <>
                                    {myAnsweredRecords.length > 0 && (
                                        <>
                                            <p className="text-base font-bold uppercase tracking-wider mb-3 pb-2" style={{color: 'var(--color-accent-text)', borderBottom: '1px solid rgba(255,255,255,0.15)'}}>
                                                Answered ({myAnsweredRecords.length})
                                            </p>
                                            <div className="space-y-2 mb-6">
                                                {myAnsweredRecords.map((record) => {
                                                    const questionText = record.getCellValueAsString(questionTextField);
                                                    const humanAnswer = humanAnswerField ? record.getCellValueAsString(humanAnswerField) : '';
                                                    const aiAnswer = aiAnswerField ? record.getCellValueAsString(aiAnswerField) : '';
                                                    const answer = humanAnswer || aiAnswer;
                                                    const answeredByVal = answeredByField ? record.getCellValueAsString(answeredByField) : '';
                                                    const isExpanded = expandedAnswerId === record.id;
                                                    return (
                                                        <div
                                                            key={record.id}
                                                            className="dark-card-answered rounded-lg p-4 cursor-pointer transition-all"
                                                            onClick={() => setExpandedAnswerId(isExpanded ? null : record.id)}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-xl font-bold leading-snug flex-1 min-w-0">{questionText}</p>
                                                                <span className="shrink-0 mt-1" style={{color: 'var(--color-accent-subtext)', transition: 'transform 0.25s ease-out', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                                                                    <CaretDownIcon size={18} />
                                                                </span>
                                                            </div>
                                                            {answer && (
                                                                <div className={`accordion-content ${isExpanded ? 'expanded' : ''}`}>
                                                                    <div>
                                                                        <div className="mt-3 pt-3" style={{borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                                                                            <div className="text-base prose max-w-none" style={{color: 'var(--color-accent-text)', opacity: 0.9}}>
                                                                                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{answer}</Markdown>
                                                                            </div>
                                                                            {answeredByVal && (
                                                                                <div className="flex items-center gap-2 mt-3 pt-3" style={{borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                                                                                    <span className="text-xs" style={{color: 'var(--color-accent-subtext)'}}>Answered by:</span>
                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{background: 'rgba(255,255,255,0.12)', color: 'var(--color-accent-text)'}}>
                                                                                        {answeredByVal}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                    {myPendingRecords.length > 0 && (
                                        <>
                                            <p className="text-base font-bold uppercase tracking-wider mb-3 pb-2" style={{color: 'var(--color-accent-text)', borderBottom: '1px solid rgba(255,255,255,0.15)'}}>
                                                Pending ({myPendingRecords.length})
                                            </p>
                                            <div className="space-y-2 mb-6">
                                                {myPendingRecords.map((record) => {
                                                    const questionText = record.getCellValueAsString(questionTextField);
                                                    return (
                                                        <div key={record.id} className="dark-card-pending rounded-lg p-4">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xl font-bold leading-snug">{questionText}</p>
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm mt-2" style={{background: 'rgba(255,255,255,0.12)', color: 'var(--color-accent-subtext)'}}>
                                                                        awaiting answer
                                                                    </span>
                                                                </div>
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={() => qaTable.deleteRecordAsync(record).catch(() => {})}
                                                                        className="p-1.5 rounded-md cursor-pointer transition-opacity hover:opacity-100"
                                                                        style={{color: 'var(--color-accent-subtext)', opacity: 0.6}}
                                                                        title="Delete your question"
                                                                    >
                                                                        <TrashSimpleIcon size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {(qaFilter === 'all' || qaFilter === 'answered') && answeredRecords.length > 0 && (
                        <>
                            <p className="text-base font-bold uppercase tracking-wider mb-3 pb-2" style={{color: 'var(--color-accent-text)', borderBottom: '1px solid rgba(255,255,255,0.15)'}}>
                                Answered ({answeredRecords.length})
                            </p>
                            <div className="space-y-2 mb-6">
                                {answeredRecords.map((record) => {
                                    const questionText = record.getCellValueAsString(questionTextField);
                                    const createdByVal = record.getCellValue(createdByField);
                                    const submitterName = createdByVal?.name || 'Someone';
                                    const humanAnswer = humanAnswerField ? record.getCellValueAsString(humanAnswerField) : '';
                                    const aiAnswer = aiAnswerField ? record.getCellValueAsString(aiAnswerField) : '';
                                    const answer = humanAnswer || aiAnswer;
                                    const answeredBy = answeredByField ? record.getCellValueAsString(answeredByField) : '';
                                    const isExpanded = expandedAnswerId === record.id;
                                    return (
                                        <div
                                            key={record.id}
                                            className="dark-card-answered rounded-lg p-4 cursor-pointer transition-all"
                                            onClick={() => setExpandedAnswerId(isExpanded ? null : record.id)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xl font-bold leading-snug">{questionText}</p>
                                                    <span className="text-xs mt-1 inline-block" style={{color: 'var(--color-accent-subtext)'}}>
                                                        {submitterName}
                                                    </span>
                                                </div>
                                                <span className="shrink-0 mt-1" style={{color: 'var(--color-accent-subtext)', transition: 'transform 0.25s ease-out', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                                                    <CaretDownIcon size={18} />
                                                </span>
                                            </div>
                                            {answer && (
                                                <div className={`accordion-content ${isExpanded ? 'expanded' : ''}`}>
                                                    <div>
                                                        <div className="mt-3 pt-3" style={{borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                                                            <div className="text-base prose max-w-none" style={{color: 'var(--color-accent-text)', opacity: 0.9}}>
                                                                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{answer}</Markdown>
                                                            </div>
                                                            {answeredBy && (
                                                                <div className="flex items-center gap-2 mt-3 pt-3" style={{borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                                                                    <span className="text-xs" style={{color: 'var(--color-accent-subtext)'}}>Answered by:</span>
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{background: 'rgba(255,255,255,0.12)', color: 'var(--color-accent-text)'}}>
                                                                        {answeredBy}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {(qaFilter === 'all' || qaFilter === 'pending') && pendingRecords.length > 0 && (
                        <>
                            <p className="text-base font-bold uppercase tracking-wider mb-3 pb-2" style={{color: 'var(--color-accent-text)', borderBottom: '1px solid rgba(255,255,255,0.15)'}}>
                                Pending ({pendingRecords.length})
                            </p>
                            <div className="space-y-2 mb-6">
                                {pendingRecords.map((record) => {
                                    const questionText = record.getCellValueAsString(questionTextField);
                                    const createdByVal = record.getCellValue(createdByField);
                                    const submitterName = createdByVal?.name || 'Someone';
                                    const isOwner = createdByVal?.id === currentUser.id;
                                    return (
                                        <div key={record.id} className="dark-card-pending rounded-lg p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xl font-bold leading-snug">{questionText}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs" style={{color: 'var(--color-accent-subtext)'}}>
                                                            {submitterName}
                                                        </span>
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm" style={{background: 'rgba(255,255,255,0.12)', color: 'var(--color-accent-subtext)'}}>
                                                            awaiting answer
                                                        </span>
                                                    </div>
                                                </div>
                                                {isOwner && canDelete && (
                                                    <button
                                                        onClick={() => qaTable.deleteRecordAsync(record).catch(() => {})}
                                                        className="p-1.5 rounded-md cursor-pointer transition-opacity hover:opacity-100"
                                                        style={{color: 'var(--color-accent-subtext)', opacity: 0.6}}
                                                        title="Delete your question"
                                                    >
                                                        <TrashSimpleIcon size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {pendingRecords.length === 0 && answeredRecords.length === 0 && (
                        <div className="flex items-center justify-center py-16">
                            <p className="text-base" style={{color: 'var(--color-accent-subtext)'}}>No questions yet. Be the first to ask!</p>
                        </div>
                    )}
                </div>
            </div>
        );

        return (
            <ThemeProvider primaryColor={branding.primaryColor}>
                <SplitLayout
                    left={leftPanel}
                    right={rightPanel}
                    leftFlex={2}
                    rightFlex={3}
                    leftStyle={{backgroundColor: 'white'}}
                    rightStyle={{backgroundColor: 'var(--color-accent)', padding: 0, overflow: 'hidden'}}
                />
            </ThemeProvider>
        );
    }

    // Live Questions Audience: split layout leftFlex=3 (dark accent), rightFlex=2 (white, queue)
    const leftPanel = (
        <div className="relative h-full min-h-[60vh]" style={{color: 'var(--color-accent-text)'}}>
            <div className="flex flex-col justify-center h-full px-6 sm:px-10 py-20">
                    {liveRecord ? (
                        <NowAnswering
                            record={liveRecord}
                            questionTextField={questionTextField}
                            createdByField={createdByField}
                            upvoteCountField={upvoteCountField}
                        />
                    ) : (
                        <div className="py-16 text-center">
                            <p className="text-base" style={{color: 'var(--color-accent-subtext)'}}>
                                No question being answered yet
                            </p>
                        </div>
                    )}
            </div>
            {activeEvent && (
                <div className="absolute bottom-8 left-10 flex items-center gap-4" style={{color: 'var(--color-accent-subtext)'}}>
                    {logoUrl && (
                        <>
                            <img src={secondaryLogoUrl || logoUrl} alt="Logo" className="max-w-[12vw] max-h-[80px] w-auto object-contain" />
                            <div className="w-px h-12" style={{backgroundColor: 'rgba(255,255,255,0.3)'}} />
                        </>
                    )}
                    <div>
                        <p className="text-lg font-display font-bold" style={{color: 'var(--color-accent-text)', opacity: 0.8}}>
                            {activeEvent.name}
                        </p>
                        {activeEvent.date && (
                            <p className="text-xs mt-0.5" style={{opacity: 0.6}}>
                                {new Date(activeEvent.date).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const rightPanel = (
        <div className="flex flex-col h-full">
            <div className="shrink-0 px-10 pt-8 pb-4 bg-white" style={{boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', zIndex: 50, position: 'relative'}}>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-gray700 dark:text-gray-gray200 uppercase tracking-wider">
                        Questions ({pendingRecords.length})
                    </p>
                    <div className="flex items-center gap-2">
                        {showPicker && (
                            <select
                                value={activeEventId || ''}
                                onChange={(e) => { setSelectedEventId(e.target.value); try { localStorage.setItem('airpulse_event', e.target.value); } catch { /* sandboxed */ } }}
                                className="text-xs px-3 h-[34px] w-48 rounded-lg bg-gray-gray25 text-gray-gray500 border border-gray-gray200 outline-none cursor-pointer appearance-none truncate"
                                style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23979aa0\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: '20px'}}
                            >
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))}
                            </select>
                        )}
                        <FullscreenToggle />
                    </div>
                </div>
                <QuestionInput
                    qaTable={qaTable}
                    questionTextField={questionTextField}
                    eventField={eventField}
                    selectedEventId={activeEventId}
                />
            </div>
            <div className="flex-1 overflow-y-auto px-10 py-4">
            <div className="flex gap-1.5 mb-4">
                {[{key: 'all', label: `All (${pendingRecords.length})`}, {key: 'mine', label: `My Questions (${myPendingRecords.length})`}].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setQaFilter(tab.key)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            qaFilter === tab.key
                                ? 'btn-primary'
                                : 'text-gray-gray500 hover:bg-gray-gray100'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {qaFilter === 'mine' ? (
                myPendingRecords.length > 0 ? (
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-gray500 dark:text-gray-gray400 uppercase tracking-wider mb-2">My Questions</p>
                        <div className="space-y-2">
                            {myPendingRecords.map((record) => (
                                <QuestionRow
                                    key={record.id}
                                    record={record}
                                    qaTable={qaTable}
                                    questionTextField={questionTextField}
                                    createdByField={createdByField}
                                    upvotesTable={upvotesTable}
                                    upvoteQuestionField={upvoteQuestionField}
                                    upvoteCountField={upvoteCountField}
                                    currentUser={currentUser}
                                    myUpvoteRecord={myUpvotesByQuestion.get(record.id)}
                                    canVote={canVote}
                                    canDelete={canDelete}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-16">
                        <p className="text-base text-gray-gray400 dark:text-gray-gray500">
                            You haven&apos;t asked any questions yet.
                        </p>
                    </div>
                )
            ) : (
                <>
                {pendingRecords.length > 0 && (
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-gray500 dark:text-gray-gray400 uppercase tracking-wider mb-2">Up Next</p>
                        <div className="space-y-2">
                            {pendingRecords.map((record) => (
                                <QuestionRow
                                    key={record.id}
                                    record={record}
                                    qaTable={qaTable}
                                    questionTextField={questionTextField}
                                    createdByField={createdByField}
                                    upvotesTable={upvotesTable}
                                    upvoteQuestionField={upvoteQuestionField}
                                    upvoteCountField={upvoteCountField}
                                    currentUser={currentUser}
                                    myUpvoteRecord={myUpvotesByQuestion.get(record.id)}
                                    canVote={canVote}
                                    canDelete={canDelete}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {pendingRecords.length === 0 && !liveRecord && (
                    <div className="flex items-center justify-center py-16">
                        <p className="text-base text-gray-gray400 dark:text-gray-gray500">
                            No questions yet. Be the first to ask!
                        </p>
                    </div>
                )}
                </>
            )}
            </div>
        </div>
    );

    return (
        <ThemeProvider primaryColor={branding.primaryColor}>
            <SplitLayout
                left={leftPanel}
                right={rightPanel}
                leftFlex={3}
                rightFlex={2}
                leftCenter
                leftStyle={{backgroundColor: 'var(--color-accent)'}}
                rightStyle={{backgroundColor: 'white', padding: 0, overflow: 'hidden'}}
            />
        </ThemeProvider>
    );
}

// --- Root ---

function QAApp() {
    const {customPropertyValueByKey} = useCustomProperties(getCustomProperties);

    // Mode from custom property — set by the builder in the properties panel.
    const mode = customPropertyValueByKey.mode || 'audience';

    // Tables + fields from custom properties
    const eventsTable = customPropertyValueByKey.eventsTable;
    const qaTable = customPropertyValueByKey.qaTable;
    const upvotesTable = customPropertyValueByKey.upvotesTable;
    const eventField = customPropertyValueByKey.eventField;
    const upvoteQuestionField = customPropertyValueByKey.upvoteQuestionField;
    const upvoteCountField = customPropertyValueByKey.upvoteCountField;

    // Look up hardcoded fields by name from tables
    const primaryColorField = getField(eventsTable, EVENT_FIELDS.PRIMARY_COLOR);
    const logoField = getField(eventsTable, EVENT_FIELDS.LOGO);
    const secondaryLogoField = getField(eventsTable, EVENT_FIELDS.SECONDARY_LOGO);
    const eventDateField = getField(eventsTable, EVENT_FIELDS.DATE);
    const eventDescriptionField = getField(eventsTable, EVENT_FIELDS.DESCRIPTION);
    const eventLiveField = getField(eventsTable, EVENT_FIELDS.LIVE);
    const eventTypeField = getField(eventsTable, EVENT_FIELDS.EVENT_TYPE);

    const questionTextField = getField(qaTable, QA_FIELDS.QUESTION_TEXT);
    const statusField = getField(qaTable, QA_FIELDS.STATUS);
    const createdByField = getField(qaTable, QA_FIELDS.CREATED_BY);
    const aiAnswerField = getField(qaTable, QA_FIELDS.AI_ANSWER);
    const humanAnswerField = getField(qaTable, QA_FIELDS.HUMAN_ANSWER);
    const answeredByField = getField(qaTable, QA_FIELDS.ANSWERED_BY);

    const upvoteCreatedByField = getField(upvotesTable, UPVOTE_FIELDS.CREATED_BY);

    const allProperties = {
        eventsTable, qaTable, upvotesTable,
        eventField, upvoteQuestionField, upvoteCountField,
        primaryColorField,
        logoField, secondaryLogoField,
        eventDateField, eventDescriptionField, eventLiveField,
        questionTextField, statusField, createdByField,
        upvoteCreatedByField,
    };

    // Tables + linked/count fields (custom props) + essential hardcoded fields
    const requiredFields = [eventsTable, qaTable, upvotesTable, eventField, upvoteQuestionField, upvoteCountField, questionTextField, statusField, createdByField, upvoteCreatedByField];
    const hasMissing = requiredFields.some((f) => !f);

    if (hasMissing) {
        return <SetupInstructions allProperties={allProperties} />;
    }

    const sharedProps = {
        eventsTable,
        primaryColorField,
        logoField,
        secondaryLogoField,
        qaTable,
        upvotesTable,
        questionTextField,
        upvoteQuestionField,
        upvoteCreatedByField,
        upvoteCountField,
        statusField,
        createdByField,
        eventDateField,
        eventDescriptionField,
        eventLiveField,
        eventField,
        eventTypeField,
        aiAnswerField,
        humanAnswerField,
        answeredByField,
    };

    if (mode === 'setup') {
        return <SetupContent {...sharedProps} />;
    }

    if (mode === 'admin') {
        return <AdminContent {...sharedProps} />;
    }

    return <QAContent {...sharedProps} />;
}

initializeBlock({interface: () => <ErrorBoundary><QAApp /></ErrorBoundary>});
