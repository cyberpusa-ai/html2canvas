import {CSSValue} from '../../syntax/parser';
import {
    CSSRadialExtent,
    CSSRadialGradientImage,
    CSSRadialShape,
    GradientColorStop,
    GradientCorner,
    UnprocessedGradientColorStop
} from '../image';
import {Color, color as colorType, pack} from '../color';
import {getAbsoluteValue, HUNDRED_PERCENT, isLengthPercentage, ZERO_LENGTH} from '../length-percentage';
import {Context} from '../../../core/context';

export const parseColorStop = (context: Context, args: CSSValue[]): UnprocessedGradientColorStop => {
    const color = colorType.parse(context, args[0]);
    const stop = args[1];
    return stop && isLengthPercentage(stop) ? {color, stop} : {color, stop: null};
};

const getColorStopPositions = (stops: UnprocessedGradientColorStop[], lineLength: number): number[] => {
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (first.stop === null) {
        first.stop = ZERO_LENGTH;
    }

    if (last.stop === null) {
        last.stop = HUNDRED_PERCENT;
    }

    const processStops: (number | null)[] = [];
    let previous = 0;
    for (let i = 0; i < stops.length; i++) {
        const stop = stops[i].stop;
        if (stop !== null) {
            const absoluteValue = getAbsoluteValue(stop, lineLength);
            if (absoluteValue > previous) {
                processStops.push(absoluteValue);
            } else {
                processStops.push(previous);
            }
            previous = absoluteValue;
        } else {
            processStops.push(null);
        }
    }

    let gapBegin = null;
    for (let i = 0; i < processStops.length; i++) {
        const stop = processStops[i];
        if (stop === null) {
            if (gapBegin === null) {
                gapBegin = i;
            }
        } else if (gapBegin !== null) {
            const gapLength = i - gapBegin;
            const beforeGap = processStops[gapBegin - 1] as number;
            const gapValue = (stop - beforeGap) / (gapLength + 1);
            for (let g = 1; g <= gapLength; g++) {
                processStops[gapBegin + g - 1] = gapValue * g;
            }
            gapBegin = null;
        }
    }

    return processStops as number[];
};

export const processColorStops = (stops: UnprocessedGradientColorStop[], lineLength: number): GradientColorStop[] => {
    const positions = getColorStopPositions(stops, lineLength);
    return stops.map(({color}, i) => {
        if (lineLength <= 0) {
            return {color, stop: 0};
        }
        return {color, stop: Math.max(Math.min(1, positions[i] / lineLength), 0)};
    });
};

// Upper bound on how often the stop list is repeated along the gradient line, so a tiny period can't
// produce an unbounded number of color stops.
const MAX_GRADIENT_REPEATS = 1000;

const interpolateColor = (from: Color, to: Color, t: number): Color => {
    const channel = (shift: number) => {
        const a = 0xff & (from >> shift);
        const b = 0xff & (to >> shift);
        return Math.round(a + (b - a) * t);
    };
    return pack(channel(24), channel(16), channel(8), channel(0) / 255);
};

interface PositionedColor {
    color: Color;
    position: number;
}

const colorAt = (from: PositionedColor, to: PositionedColor, position: number): Color =>
    interpolateColor(from.color, to.color, (position - from.position) / (to.position - from.position));

// Color stops for repeating-linear-gradient / repeating-radial-gradient: the stop list (from the first
// to the last stop) is repeated in both directions until it covers the whole gradient line.
// Stop lengths resolve against lineLength; the returned offsets are relative to paintLength, which can be
// longer (a repeating radial gradient keeps repeating past its ending shape up to the corners of the box).
export const processRepeatingColorStops = (
    stops: UnprocessedGradientColorStop[],
    lineLength: number,
    paintLength = lineLength
): GradientColorStop[] => {
    const positions = getColorStopPositions(stops, lineLength);
    const first = positions[0];
    const period = positions[positions.length - 1] - first;
    if (
        !(lineLength > 0) ||
        !(paintLength >= lineLength) ||
        !(period > 0) ||
        !isFinite(paintLength) ||
        paintLength / period > MAX_GRADIENT_REPEATS
    ) {
        return processColorStops(stops, lineLength);
    }
    lineLength = paintLength;

    const repeated: PositionedColor[] = [];
    for (let offset = first - Math.ceil(first / period) * period; offset < lineLength; offset += period) {
        stops.forEach(({color}, i) => repeated.push({color, position: offset + positions[i] - first}));
    }

    const result: GradientColorStop[] = [];
    repeated.forEach((current, i) => {
        const previous = repeated[i - 1];
        if (previous) {
            if (previous.position < 0 && current.position > 0) {
                result.push({color: colorAt(previous, current, 0), stop: 0});
            }
            if (previous.position < lineLength && current.position > lineLength) {
                result.push({color: colorAt(previous, current, lineLength), stop: 1});
            }
        }
        if (current.position >= 0 && current.position <= lineLength) {
            result.push({color: current.color, stop: current.position / lineLength});
        }
    });
    return result;
};

const getAngleFromCorner = (corner: GradientCorner, width: number, height: number): number => {
    const centerX = width / 2;
    const centerY = height / 2;
    const x = getAbsoluteValue(corner[0], width) - centerX;
    const y = centerY - getAbsoluteValue(corner[1], height);

    return (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
};

export const calculateGradientDirection = (
    angle: number | GradientCorner,
    width: number,
    height: number
): [number, number, number, number, number] => {
    const radian = typeof angle === 'number' ? angle : getAngleFromCorner(angle, width, height);

    const lineLength = Math.abs(width * Math.sin(radian)) + Math.abs(height * Math.cos(radian));

    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfLineLength = lineLength / 2;

    const yDiff = Math.sin(radian - Math.PI / 2) * halfLineLength;
    const xDiff = Math.cos(radian - Math.PI / 2) * halfLineLength;

    return [lineLength, halfWidth - xDiff, halfWidth + xDiff, halfHeight - yDiff, halfHeight + yDiff];
};

const distance = (a: number, b: number): number => Math.sqrt(a * a + b * b);

const findCorner = (width: number, height: number, x: number, y: number, closest: boolean): [number, number] => {
    const corners = [
        [0, 0],
        [0, height],
        [width, 0],
        [width, height]
    ];

    return corners.reduce(
        (stat, corner) => {
            const [cx, cy] = corner;
            const d = distance(x - cx, y - cy);
            if (closest ? d < stat.optimumDistance : d > stat.optimumDistance) {
                return {
                    optimumCorner: corner,
                    optimumDistance: d
                };
            }

            return stat;
        },
        {
            optimumDistance: closest ? Infinity : -Infinity,
            optimumCorner: null
        }
    ).optimumCorner as [number, number];
};

export const calculateRadius = (
    gradient: CSSRadialGradientImage,
    x: number,
    y: number,
    width: number,
    height: number
): [number, number] => {
    let rx = 0;
    let ry = 0;

    switch (gradient.size) {
        case CSSRadialExtent.CLOSEST_SIDE:
            // The ending shape is sized so that that it exactly meets the side of the gradient box closest to the gradient’s center.
            // If the shape is an ellipse, it exactly meets the closest side in each dimension.
            if (gradient.shape === CSSRadialShape.CIRCLE) {
                rx = ry = Math.min(Math.abs(x), Math.abs(x - width), Math.abs(y), Math.abs(y - height));
            } else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                rx = Math.min(Math.abs(x), Math.abs(x - width));
                ry = Math.min(Math.abs(y), Math.abs(y - height));
            }
            break;

        case CSSRadialExtent.CLOSEST_CORNER:
            // The ending shape is sized so that that it passes through the corner of the gradient box closest to the gradient’s center.
            // If the shape is an ellipse, the ending shape is given the same aspect-ratio it would have if closest-side were specified.
            if (gradient.shape === CSSRadialShape.CIRCLE) {
                rx = ry = Math.min(
                    distance(x, y),
                    distance(x, y - height),
                    distance(x - width, y),
                    distance(x - width, y - height)
                );
            } else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                // Compute the ratio ry/rx (which is to be the same as for "closest-side")
                const c = Math.min(Math.abs(y), Math.abs(y - height)) / Math.min(Math.abs(x), Math.abs(x - width));
                const [cx, cy] = findCorner(width, height, x, y, true);
                rx = distance(cx - x, (cy - y) / c);
                ry = c * rx;
            }
            break;

        case CSSRadialExtent.FARTHEST_SIDE:
            // Same as closest-side, except the ending shape is sized based on the farthest side(s)
            if (gradient.shape === CSSRadialShape.CIRCLE) {
                rx = ry = Math.max(Math.abs(x), Math.abs(x - width), Math.abs(y), Math.abs(y - height));
            } else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                rx = Math.max(Math.abs(x), Math.abs(x - width));
                ry = Math.max(Math.abs(y), Math.abs(y - height));
            }
            break;

        case CSSRadialExtent.FARTHEST_CORNER:
            // Same as closest-corner, except the ending shape is sized based on the farthest corner.
            // If the shape is an ellipse, the ending shape is given the same aspect ratio it would have if farthest-side were specified.
            if (gradient.shape === CSSRadialShape.CIRCLE) {
                rx = ry = Math.max(
                    distance(x, y),
                    distance(x, y - height),
                    distance(x - width, y),
                    distance(x - width, y - height)
                );
            } else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                // Compute the ratio ry/rx (which is to be the same as for "farthest-side")
                const c = Math.max(Math.abs(y), Math.abs(y - height)) / Math.max(Math.abs(x), Math.abs(x - width));
                const [cx, cy] = findCorner(width, height, x, y, false);
                rx = distance(cx - x, (cy - y) / c);
                ry = c * rx;
            }
            break;
    }

    if (Array.isArray(gradient.size)) {
        rx = getAbsoluteValue(gradient.size[0], width);
        ry = gradient.size.length === 2 ? getAbsoluteValue(gradient.size[1], height) : rx;
    }

    return [rx, ry];
};

// Distance from the gradient center to the farthest corner of the box, measured along the x radius of the
// ending shape (an elliptical gradient is drawn as a circle of radius rx, scaled vertically by ry / rx).
export const calculateRadialPaintLength = (
    x: number,
    y: number,
    width: number,
    height: number,
    rx: number,
    ry: number
): number => {
    const scale = rx / ry;
    return Math.max(
        distance(x, y * scale),
        distance(x - width, y * scale),
        distance(x, (y - height) * scale),
        distance(x - width, (y - height) * scale)
    );
};
