// Hidden-until-print layer: renders every record's page at physical scale with a
// page break between them. Shared by view mode and the editor's Print action.

import {PageCanvas, ScaledPage} from '../render/page_canvas.js';
import {PRINT_SCALE} from './print.js';

export function PrintLayer({page, layout, records, table}) {
    return (
        <div className="pd-print-only">
            {records.map((record) => (
                <div key={record.id} className="pd-print-page">
                    <ScaledPage page={page} scale={PRINT_SCALE}>
                        <PageCanvas
                            page={page}
                            layout={layout}
                            record={record}
                            table={table}
                            scale={PRINT_SCALE}
                            scaleMode="zoom"
                            eagerImages
                        />
                    </ScaledPage>
                </div>
            ))}
        </div>
    );
}
