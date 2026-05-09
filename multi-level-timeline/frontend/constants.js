export const ROW_HEIGHT = 34;
export const ROW_HEIGHT_COMPACT = 28;
export const BAR_HEIGHT = 28;
export const BAR_HEIGHT_COMPACT = 26;
export const GANTT_LANE_HEIGHT = 38;
export const HEADER_HEIGHT = 48;
export const HEADER_HEIGHT_DAY = 64;
export const MIN_LEFT_WIDTH = 200;
export const DEFAULT_LEFT_WIDTH = 420;
export const MIN_BAR_WIDTH = 8;

export const LEVEL_COLORS = {
    0: { bg: 'rgba(0,0,0,0.03)', text: 'text-gray-gray800', font: 'font-semibold' },
    1: { bg: 'rgba(0,0,0,0.015)', text: 'text-gray-gray700', font: 'font-medium' },
    2: { bg: null, text: 'text-gray-gray700', font: 'font-normal' },
    3: { bg: null, text: 'text-gray-gray500', font: 'font-normal' },
};

export const BAR_COLORS = {
    2: { bar: '#2d7ff9', fill: '#1a6be0' },
    3: { bar: '#74aafc', fill: '#5b99f5' },
};

export const ZOOM_PRESETS = {
    day: { label: 'Day', basePxPerDay: 40, headerFormat: 'day' },
    week: { label: 'Week', basePxPerDay: 12, headerFormat: 'week' },
    month: { label: 'Month', basePxPerDay: 3, headerFormat: 'month' },
    quarter: { label: 'Quarter', basePxPerDay: 1, headerFormat: 'quarter' },
};

export const DEFAULT_ZOOM = 'week';
export const MIN_ZOOM_MULTIPLIER = 0.5;
export const MAX_ZOOM_MULTIPLIER = 3;
