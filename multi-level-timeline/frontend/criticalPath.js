import {diffDays} from './dateUtils';

export function computeCriticalPath(items) {
    // Only consider bar items (subtasks) with valid dates
    const barItems = items.filter(i => i.type === 'bar' && i.startDate && i.endDate);
    if (barItems.length === 0) return new Set();

    const itemMap = new Map();
    for (const item of barItems) {
        itemMap.set(item.id, {
            ...item,
            duration: Math.max(diffDays(item.startDate, item.endDate), 0),
            es: 0, // early start
            ef: 0, // early finish
            ls: Infinity, // late start
            lf: Infinity, // late finish
            float: Infinity,
        });
    }

    // Build predecessor/successor relationships
    const successors = new Map(); // predecessorId -> [{id, type}]
    for (const item of barItems) {
        for (const predId of item.predecessorIds) {
            if (!successors.has(predId)) successors.set(predId, []);
            successors.get(predId).push({ id: item.id, type: item.dependencyType || 'FS' });
        }
    }

    // Forward pass - compute early start/finish
    // Use topological order based on predecessors
    const visited = new Set();
    const order = [];

    function visit(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const item = itemMap.get(id);
        if (!item) return;
        for (const predId of item.predecessorIds) {
            if (itemMap.has(predId)) visit(predId);
        }
        order.push(id);
    }

    for (const item of barItems) visit(item.id);

    // Forward pass
    for (const id of order) {
        const item = itemMap.get(id);
        if (!item) continue;

        let maxES = 0;
        for (const predId of item.predecessorIds) {
            const pred = itemMap.get(predId);
            if (!pred) continue;
            const depType = item.dependencyType || 'FS';

            let constraint = 0;
            switch (depType) {
                case 'FS': constraint = pred.ef; break;      // Finish-to-Start
                case 'SS': constraint = pred.es; break;      // Start-to-Start
                case 'FF': constraint = pred.ef - item.duration; break; // Finish-to-Finish
                case 'SF': constraint = pred.es - item.duration; break; // Start-to-Finish
                default: constraint = pred.ef; break;
            }
            maxES = Math.max(maxES, constraint);
        }

        item.es = maxES;
        item.ef = maxES + item.duration;
    }

    // Find project end (max EF)
    let projectEnd = 0;
    for (const [, item] of itemMap) {
        projectEnd = Math.max(projectEnd, item.ef);
    }

    // Backward pass
    for (let i = order.length - 1; i >= 0; i--) {
        const id = order[i];
        const item = itemMap.get(id);
        if (!item) continue;

        const succs = successors.get(id) || [];
        if (succs.length === 0) {
            item.lf = projectEnd;
            item.ls = projectEnd - item.duration;
        } else {
            let minLF = Infinity;
            for (const succ of succs) {
                const s = itemMap.get(succ.id);
                if (!s) continue;
                const depType = succ.type || 'FS';

                let constraint = Infinity;
                switch (depType) {
                    case 'FS': constraint = s.ls; break;
                    case 'SS': constraint = s.ls; break;
                    case 'FF': constraint = s.lf; break;
                    case 'SF': constraint = s.lf; break;
                    default: constraint = s.ls; break;
                }
                minLF = Math.min(minLF, constraint);
            }

            switch (true) {
                // For FS/SS, lf = constraint, ls = lf - duration
                default:
                    item.lf = minLF;
                    item.ls = minLF - item.duration;
            }
        }

        item.float = item.ls - item.es;
    }

    // Critical path = items with zero float
    const critical = new Set();
    for (const [id, item] of itemMap) {
        if (Math.abs(item.float) < 0.001) {
            critical.add(id);
        }
    }

    return critical;
}
