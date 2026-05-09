import {initializeBlock, useCustomProperties} from '@airtable/blocks/interface/ui';
import './style.css';
import {getCustomProperties} from './customProperties';
import {useGanttData} from './useGanttData';
import GanttChart from './GanttChart';

function App() {
    const {customPropertyValueByKey: props} = useCustomProperties(getCustomProperties);

    const config = {
        projectsTable: props.projectsTable || null,
        tasksTable: props.tasksTable || null,
        subtasksTable: props.subtasksTable || null,
        projectTasksLink: props.projectTasksLink || null,
        taskSubtasksLink: props.taskSubtasksLink || null,
        subtaskStartDate: props.subtaskStartDate || null,
        subtaskEndDate: props.subtaskEndDate || null,
        subtaskSelfLink: props.subtaskSelfLink || null,
        subtaskPredecessor: props.subtaskPredecessor || null,
        subtaskColorField: props.subtaskColorField || null,
        frozenField: props.frozenField || null,
        sidebarFields: [props.sidebarField1, props.sidebarField2, props.sidebarField3, props.sidebarField4].filter(Boolean),
        showDependencies: true,
        hideWeekends: props.hideWeekends || false,
    };

    const isConfigured = config.projectsTable && config.tasksTable && config.subtasksTable;

    if (!isConfigured) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-gray50 dark:bg-gray-gray800">
                <div className="text-center p-8 max-w-md">
                    <div className="text-4xl mb-4">&#9776;</div>
                    <h2 className="text-lg font-semibold text-gray-gray700 dark:text-gray-gray200 mb-2">
                        Configure your Gantt chart
                    </h2>
                    <p className="text-sm text-gray-gray500 dark:text-gray-gray400">
                        Open the settings panel to select your Projects, Tasks, and Subtasks tables, then map the required fields.
                    </p>
                </div>
            </div>
        );
    }

    return <GanttChartWrapper config={config} />;
}

function GanttChartWrapper({config}) {
    const {items, timelineStart, timelineEnd, toggleExpand, expandAll, collapseAll, selectedRowId, setSelectedRowId} = useGanttData(config);

    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-gray50 dark:bg-gray-gray800">
                <div className="text-center p-8 max-w-md">
                    <div className="text-4xl mb-4">&#128197;</div>
                    <h2 className="text-lg font-semibold text-gray-gray700 dark:text-gray-gray200 mb-2">
                        No timeline data
                    </h2>
                    <p className="text-sm text-gray-gray500 dark:text-gray-gray400">
                        Add records to your tables or check your field mappings in settings.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <GanttChart
            items={items}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            toggleExpand={toggleExpand}
            expandAll={expandAll}
            collapseAll={collapseAll}
            selectedRowId={selectedRowId}
            setSelectedRowId={setSelectedRowId}
            config={config}
        />
    );
}

initializeBlock({interface: () => <div style={{height: '100%', width: '100%'}}><App /></div>});
