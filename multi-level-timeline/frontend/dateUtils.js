export function diffDays(a, b) {
    if (!a || !b) return 0;
    const msPerDay = 86400000;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcB - utcA) / msPerDay);
}

export function diffWorkdays(a, b) {
    if (!a || !b) return 0;
    const sign = a <= b ? 1 : -1;
    const start = sign === 1 ? a : b;
    const end = sign === 1 ? b : a;
    const msPerDay = 86400000;
    const totalDays = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / msPerDay);
    const fullWeeks = Math.floor(totalDays / 7);
    let workdays = fullWeeks * 5;
    const remaining = totalDays % 7;
    const startDay = start.getDay();
    for (let i = 0; i < remaining; i++) {
        const d = (startDay + i) % 7;
        if (d !== 0 && d !== 6) workdays++;
    }
    return workdays * sign;
}

export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export function formatDate(date, format) {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    switch (format) {
        case 'day':
            return `${days[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
        case 'week':
            return `${date.getMonth() + 1}/${date.getDate()}`;
        case 'month':
            return `${months[date.getMonth()]} ${date.getFullYear()}`;
        case 'short':
            return `${date.getMonth() + 1}/${date.getDate()}`;
        default:
            return date.toLocaleDateString();
    }
}

export function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
}

export function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

export function today() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function makeDayDiff(hideWeekends) {
    return hideWeekends ? diffWorkdays : diffDays;
}
