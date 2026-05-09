import {ROW_HEIGHT as DEFAULT_ROW_HEIGHT} from './constants';

const DIAMOND_SIZE = 19;

export default function MilestoneMarker({left, top, isCritical, name, rowHeight}) {
    const ROW_HEIGHT = rowHeight || DEFAULT_ROW_HEIGHT;
    const OFFSET_Y = Math.floor((ROW_HEIGHT - DIAMOND_SIZE) / 2);
    return (
        <div
            className="absolute z-10"
            style={{left: left - DIAMOND_SIZE / 2, top: top + OFFSET_Y}}
            title={name}
        >
            <div
                className={`rotate-45 ${
                    isCritical ? 'ring-critical' : ''
                }`}
                style={{
                    width: DIAMOND_SIZE,
                    height: DIAMOND_SIZE,
                    backgroundColor: '#ecc30b',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    borderRadius: '2px',
                }}
            />
        </div>
    );
}
