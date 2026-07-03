// Hidden-until-print layer: renders every record's pages at physical scale with a
// page break between them. Each record prints all its pages in order (rec1 p1, rec1
// p2, rec2 p1, ...). Shared by view mode and the editor's Print action.

import {PageCanvas, ScaledPage} from '../render/page_canvas.js';
import {PRINT_SCALE} from './print.js';

// Hard sheet cap enforced HERE so no caller can mount an unbounded print DOM
// (printNow flushSync-mounts this synchronously; thousands of sheets hang the
// iframe). View mode also uses this to size its "printing first N" banner.
export const MAX_PRINT_SHEETS = 500;

export function PrintLayer({page, pages, records, table}) {
    const pageCount = Math.max(1, pages.length);
    const maxRecords = Math.max(1, Math.floor(MAX_PRINT_SHEETS / pageCount));
    const printable = records.length > maxRecords ? records.slice(0, maxRecords) : records;
    return (
        <div className="pd-print-only">
            {printable.map((record) =>
                pages.map((entry, i) => (
                    <div key={`${record.id}:${i}`} className="pd-print-page">
                        <ScaledPage page={page} scale={PRINT_SCALE}>
                            <PageCanvas
                                page={{...page, backgroundColor: entry.backgroundColor}}
                                layout={entry.layout}
                                record={record}
                                table={table}
                                scale={PRINT_SCALE}
                                scaleMode="zoom"
                                eagerImages
                            />
                        </ScaledPage>
                    </div>
                )),
            )}
        </div>
    );
}
