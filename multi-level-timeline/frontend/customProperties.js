import {FieldType} from '@airtable/blocks/interface/models';

function isLinkField({config}) {
    return config.type === FieldType.MULTIPLE_RECORD_LINKS;
}

function isDateField({config}) {
    return config.type === FieldType.DATE || config.type === FieldType.DATE_TIME;
}

function isSelectField({config}) {
    return config.type === FieldType.SINGLE_SELECT;
}

// useCustomProperties calls this with (base) and expects an array of property descriptors.
// Field properties reference tables — we use defaults but the user overrides via the settings panel.
// NOTE: When the user changes a table selector, useCustomProperties re-calls this function
// with the updated base (via schema watch), but field `table` refs are still the defaults here.
// The actual selected table comes from customPropertyValueByKey. We define field selectors
// against the default tables so the settings panel can render them initially.
export function getCustomProperties(base) {
    const tables = base.tables;
    const defaultProjectsTable = tables.find(t => t.name.toLowerCase().includes('project')) || tables[0];
    const defaultTasksTable = tables.find(t => t.name.toLowerCase().includes('task') && !t.name.toLowerCase().includes('sub')) || tables[Math.min(1, tables.length - 1)];
    const defaultSubtasksTable = tables.find(t => t.name.toLowerCase().includes('subtask')) || tables[Math.min(2, tables.length - 1)];

    return [
        // Table selectors
        {key: 'projectsTable', label: 'Projects table', type: 'table', defaultValue: defaultProjectsTable},
        {key: 'tasksTable', label: 'Tasks table', type: 'table', defaultValue: defaultTasksTable},
        {key: 'subtasksTable', label: 'Subtasks table', type: 'table', defaultValue: defaultSubtasksTable},

        // Project fields
        {key: 'projectTasksLink', label: 'Projects \u2192 Tasks link field', type: 'field', table: defaultProjectsTable, shouldFieldBeAllowed: isLinkField},

        // Task fields
        {key: 'taskSubtasksLink', label: 'Tasks \u2192 Subtasks link field', type: 'field', table: defaultTasksTable, shouldFieldBeAllowed: isLinkField},

        // Subtask fields
        {key: 'subtaskStartDate', label: 'Start date field', type: 'field', table: defaultSubtasksTable, shouldFieldBeAllowed: isDateField},
        {key: 'subtaskEndDate', label: 'End date field', type: 'field', table: defaultSubtasksTable, shouldFieldBeAllowed: isDateField},
        {key: 'subtaskSelfLink', label: 'Sub-subtask self-link field', type: 'field', table: defaultSubtasksTable, shouldFieldBeAllowed: isLinkField},
        {key: 'subtaskPredecessor', label: 'Predecessor field', type: 'field', table: defaultSubtasksTable, shouldFieldBeAllowed: isLinkField},
        {key: 'subtaskColorField', label: 'Bar color field (single select)', type: 'field', table: defaultSubtasksTable, shouldFieldBeAllowed: isSelectField},

        // Frozen first column (field displayed next to task name, always visible)
        {key: 'frozenField', label: 'Frozen first column', type: 'field', table: defaultSubtasksTable},

        // Sidebar columns (optional extra fields shown in left panel, scrollable)
        {key: 'sidebarField1', label: 'Sidebar column 1', type: 'field', table: defaultSubtasksTable},
        {key: 'sidebarField2', label: 'Sidebar column 2', type: 'field', table: defaultSubtasksTable},
        {key: 'sidebarField3', label: 'Sidebar column 3', type: 'field', table: defaultSubtasksTable},
        {key: 'sidebarField4', label: 'Sidebar column 4', type: 'field', table: defaultSubtasksTable},

        // Display toggles
        {key: 'hideWeekends', label: 'Hide weekends', type: 'boolean', defaultValue: false},
    ];
}
