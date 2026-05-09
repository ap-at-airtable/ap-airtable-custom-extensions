import {useMemo, useState, useCallback} from 'react';
import {useRecords} from '@airtable/blocks/interface/ui';
import {parseDate} from './dateUtils';
import {useLocalStorageMap} from './useLocalStorage';

function getLinkedIds(record, fieldName) {
    if (!record || !fieldName) return [];
    try {
        const val = record.getCellValue(fieldName);
        if (!val) return [];
        if (Array.isArray(val)) return val.map(v => v.id);
        return [];
    } catch {
        return [];
    }
}

function getSelectColor(record, field) {
    if (!record || !field) return null;
    try {
        const val = record.getCellValue(field);
        if (!val || !val.color) return null;
        return val.color; // Airtable color name like 'blueLight2', 'redDark1', etc.
    } catch {
        return null;
    }
}


export function useGanttData(config) {
    const {
        projectsTable, tasksTable, subtasksTable,
        projectTasksLink, taskSubtasksLink,
        subtaskStartDate, subtaskEndDate,
        subtaskSelfLink, subtaskPredecessor,
        subtaskColorField,
    } = config;

    const [expandState, setExpandState] = useLocalStorageMap('expandState');
    const [selectedRowId, setSelectedRowId] = useState(null);

    const projectRecords = useRecords(projectsTable);
    const taskRecords = useRecords(tasksTable);
    const subtaskRecords = useRecords(subtasksTable);

    const toggleExpand = useCallback((id) => {
        setExpandState(prev => {
            const next = new Map(prev);
            next.set(id, !next.get(id));
            return next;
        });
    }, [setExpandState]);

    const data = useMemo(() => {
        if (!projectsTable || !tasksTable || !subtasksTable) return { items: [], timelineStart: null, timelineEnd: null };
        if (!projectRecords || !taskRecords || !subtaskRecords) return { items: [], timelineStart: null, timelineEnd: null };

        const taskMap = new Map();
        for (const r of taskRecords) taskMap.set(r.id, r);

        const subtaskItems = new Map();
        for (const r of subtaskRecords) {
            const startDate = parseDate(subtaskStartDate ? r.getCellValue(subtaskStartDate) : null);
            const endDate = parseDate(subtaskEndDate ? r.getCellValue(subtaskEndDate) : null);
            const predecessorIds = getLinkedIds(r, subtaskPredecessor);
            const childIds = getLinkedIds(r, subtaskSelfLink);
            const colorName = getSelectColor(r, subtaskColorField);

            subtaskItems.set(r.id, {
                id: r.id,
                record: r,
                table: subtasksTable,
                name: r.name || 'Untitled',
                startDate,
                endDate,
                colorName,
                isMilestone: startDate && endDate && startDate.getTime() === endDate.getTime(),
                childIds,
                predecessorIds,
                dependencyType: 'FS',
            });
        }

        const items = [];
        let minDate = null;
        let maxDate = null;
        const visited = new Set();

        // Build a set of all IDs that are children of another subtask (via self-link).
        // These should NOT appear as top-level subtasks under a task.
        const isChildOfSubtask = new Set();
        for (const [, si] of subtaskItems) {
            for (const childId of si.childIds) {
                isChildOfSubtask.add(childId);
            }
        }

        function addSubtask(subtaskId, level, parentId) {
            const si = subtaskItems.get(subtaskId);
            if (!si) return;
            if (visited.has(subtaskId)) return;
            visited.add(subtaskId);

            const defaultExpanded = level <= 2;
            const isExpanded = expandState.has(si.id) ? expandState.get(si.id) : defaultExpanded;
            const hasChildren = si.childIds.length > 0;

            if (si.startDate) {
                if (!minDate || si.startDate < minDate) minDate = si.startDate;
            }
            if (si.endDate) {
                if (!maxDate || si.endDate > maxDate) maxDate = si.endDate;
            }

            items.push({
                ...si,
                level,
                type: 'bar',
                parentId,
                isExpanded,
                hasChildren,
                isVisible: true,
            });

            if (hasChildren) {
                if (isExpanded) {
                    for (const childId of si.childIds) {
                        if (level < 5) {
                            addSubtask(childId, level + 1, si.id);
                        }
                    }
                } else {
                    // Mark children as visited even when collapsed, so they don't
                    // appear as top-level subtasks under the task
                    const markVisited = (ids) => {
                        for (const cid of ids) {
                            if (visited.has(cid)) continue;
                            visited.add(cid);
                            const child = subtaskItems.get(cid);
                            if (child && child.childIds.length > 0) markVisited(child.childIds);
                        }
                    };
                    markVisited(si.childIds);
                }
            }
        }

        for (const project of projectRecords) {
            const isExpanded = expandState.has(project.id) ? expandState.get(project.id) : true;
            items.push({
                id: project.id,
                record: project,
                table: projectsTable,
                name: project.name || 'Untitled Project',
                level: 0,
                type: 'group',
                startDate: null,
                endDate: null,
                assignee: null,
                isMilestone: false,
                childIds: [],
                parentId: null,
                predecessorIds: [],
                dependencyType: 'FS',
                isExpanded,
                hasChildren: true,
                isVisible: true,
            });

            if (!isExpanded) continue;

            const taskIds = getLinkedIds(project, projectTasksLink);
            for (const taskId of taskIds) {
                const taskRecord = taskMap.get(taskId);
                if (!taskRecord) continue;

                const taskExpanded = expandState.has(taskId) ? expandState.get(taskId) : true;
                items.push({
                    id: taskId,
                    record: taskRecord,
                    table: tasksTable,
                    name: taskRecord.name || 'Untitled Task',
                    level: 1,
                    type: 'group',
                    startDate: null,
                    endDate: null,
                        assignee: null,
                    isMilestone: false,
                    childIds: [],
                    parentId: project.id,
                    predecessorIds: [],
                    dependencyType: 'FS',
                    isExpanded: taskExpanded,
                    hasChildren: true,
                    isVisible: true,
                });

                if (!taskExpanded) continue;

                // Only add subtasks that aren't children of another subtask.
                // Sub-subtasks will be added recursively by their parent.
                const subtaskIds = getLinkedIds(taskRecord, taskSubtasksLink);
                for (const stId of subtaskIds) {
                    if (!isChildOfSubtask.has(stId)) {
                        addSubtask(stId, 2, taskId);
                    }
                }

                // Insert an "add subtask" placeholder after this task's subtasks
                items.push({
                    id: `add-${taskId}`,
                    type: 'add',
                    addType: 'subtask',
                    level: 2,
                    parentId: taskId,
                    parentRecord: taskRecord,
                    name: '',
                    startDate: null,
                    endDate: null,
                    isVisible: true,
                });
            }

            // Insert an "add task" placeholder after this project's tasks
            items.push({
                id: `add-task-${project.id}`,
                type: 'add',
                addType: 'task',
                level: 1,
                parentId: project.id,
                parentRecord: project,
                name: '',
                startDate: null,
                endDate: null,
                isVisible: true,
            });
        }

        // Compute rollup dates for group items using source data (not just visible items)
        // This ensures rollup bars show even when children are collapsed
        function computeSubtaskRollup(subtaskIds) {
            let minStart = null, maxEnd = null;
            const seen = new Set();
            function walk(ids) {
                for (const id of ids) {
                    if (seen.has(id)) continue;
                    seen.add(id);
                    const si = subtaskItems.get(id);
                    if (!si) continue;
                    if (si.startDate && si.endDate) {
                        if (!minStart || si.startDate < minStart) minStart = si.startDate;
                        if (!maxEnd || si.endDate > maxEnd) maxEnd = si.endDate;
                    }
                    if (si.childIds.length > 0) walk(si.childIds);
                }
            }
            walk(subtaskIds);
            return {rollupStartDate: minStart, rollupEndDate: maxEnd};
        }

        for (const item of items) {
            if (item.type !== 'group') continue;
            if (item.level === 1) {
                // Task: get subtask IDs from record
                const stIds = getLinkedIds(item.record, taskSubtasksLink);
                const rollup = computeSubtaskRollup(stIds);
                Object.assign(item, rollup);
            } else if (item.level === 0) {
                // Project: aggregate across all tasks' subtasks
                const tIds = getLinkedIds(item.record, projectTasksLink);
                let minStart = null, maxEnd = null;
                for (const tId of tIds) {
                    const tr = taskMap.get(tId);
                    if (!tr) continue;
                    const stIds = getLinkedIds(tr, taskSubtasksLink);
                    const r = computeSubtaskRollup(stIds);
                    if (r.rollupStartDate) {
                        if (!minStart || r.rollupStartDate < minStart) minStart = r.rollupStartDate;
                    }
                    if (r.rollupEndDate) {
                        if (!maxEnd || r.rollupEndDate > maxEnd) maxEnd = r.rollupEndDate;
                    }
                }
                item.rollupStartDate = minStart;
                item.rollupEndDate = maxEnd;
            }
        }

        const timelineStart = minDate ? new Date(minDate.getTime() - 7 * 86400000) : new Date();
        const timelineEnd = maxDate ? new Date(maxDate.getTime() + 30 * 86400000) : new Date(Date.now() + 90 * 86400000);

        return { items, timelineStart, timelineEnd };
    }, [
        projectsTable, tasksTable, subtasksTable,
        projectRecords, taskRecords, subtaskRecords,
        projectTasksLink, taskSubtasksLink,
        subtaskStartDate, subtaskEndDate, subtaskSelfLink,
        subtaskPredecessor,
        subtaskColorField,
        expandState,
    ]);

    const expandAll = useCallback(() => {
        setExpandState(prev => {
            const next = new Map(prev);
            for (const item of data.items) {
                if (item.hasChildren) next.set(item.id, true);
            }
            return next;
        });
    }, [data.items, setExpandState]);

    const collapseAll = useCallback(() => {
        setExpandState(prev => {
            const next = new Map(prev);
            for (const item of data.items) {
                if (item.hasChildren) next.set(item.id, false);
            }
            return next;
        });
    }, [data.items, setExpandState]);

    return { ...data, toggleExpand, expandAll, collapseAll, selectedRowId, setSelectedRowId };
}
