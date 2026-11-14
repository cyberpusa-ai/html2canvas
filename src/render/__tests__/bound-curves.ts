import {deepStrictEqual, strictEqual} from 'assert';
import {Bounds} from '../../css/layout/bounds';
import {CSSParsedDeclaration} from '../../css';
import {Context} from '../../core/context';
import {BoundCurves, calculateBorderBoxPath, calculateShadowPath, spreadRadius} from '../bound-curves';
import {BezierCurve, isBezierCurve} from '../bezier-curve';
import {Path, reversePath} from '../path';
import {Vector} from '../vector';

const context = new Context({logging: false, imageTimeout: 0, useCORS: false, allowTaint: false}, Bounds.EMPTY);
const createBox = (style: {[key: string]: string}, bounds = new Bounds(10, 20, 100, 60)) => ({
    styles: new CSSParsedDeclaration(context, style as unknown as CSSStyleDeclaration),
    bounds
});
const radius = (value: string) => ({
    borderTopLeftRadius: value,
    borderTopRightRadius: value,
    borderBottomRightRadius: value,
    borderBottomLeftRadius: value
});

const points = (path: Path[]): number[][] =>
    path.map((point) =>
        isBezierCurve(point)
            ? [point.start, point.startControl, point.endControl, point.end].reduce(
                  (values: number[], v) => values.concat([v.x, v.y]),
                  []
              )
            : [point.x, point.y]
    );
// horizontal and vertical radius of a corner curve
const radii = (point: Path): number[] =>
    isBezierCurve(point) ? [Math.abs(point.end.x - point.start.x), Math.abs(point.end.y - point.start.y)] : [0, 0];

describe('bound-curves', () => {
    describe('spreadRadius', () => {
        it('adds the spread to radii at least as large as the spread', () => {
            strictEqual(spreadRadius(20, 10), 30);
            strictEqual(spreadRadius(10, 10), 20);
        });

        it('grows radii smaller than the spread less, so nearly sharp corners stay nearly sharp', () => {
            // 5 + 10 * (1 + (0.5 - 1)^3)
            strictEqual(spreadRadius(5, 10), 13.75);
        });

        it('keeps sharp corners sharp', () => {
            strictEqual(spreadRadius(0, 10), 0);
            strictEqual(spreadRadius(0, -10), 0);
        });

        it('shrinks radii by a negative spread, down to zero', () => {
            strictEqual(spreadRadius(20, -5), 15);
            strictEqual(spreadRadius(20, -30), 0);
        });

        it('keeps radii without a spread', () => {
            strictEqual(spreadRadius(20, 0), 20);
        });
    });

    describe('calculateShadowPath', () => {
        it('matches the border box without offset or spread', () => {
            const box = createBox(radius('20px'));
            deepStrictEqual(
                points(calculateShadowPath(box, 0, 0, 0)),
                points(calculateBorderBoxPath(new BoundCurves(box)))
            );
        });

        it('moves the border box by the offset and keeps the rounded corners', () => {
            const box = createBox(radius('20px'));
            const expected = calculateBorderBoxPath(
                new BoundCurves(createBox(radius('20px'), new Bounds(15, 13, 100, 60)))
            );
            deepStrictEqual(points(calculateShadowPath(box, 5, -7, 0)), points(expected));
        });

        it('grows the box and its corner radii by a positive spread', () => {
            const path = calculateShadowPath(createBox(radius('20px')), 0, 0, 10);
            path.forEach((corner) => deepStrictEqual(radii(corner), [30, 30]));
            const [topLeft, , bottomRight] = path as BezierCurve[];
            // the top left curve runs from (x, y + r) to (x + r, y)
            deepStrictEqual([topLeft.start.x, topLeft.end.y], [0, 10]);
            deepStrictEqual([bottomRight.start.x, bottomRight.end.y], [120, 90]);
        });

        it('shrinks the box and its corner radii by a negative spread, as inset shadows use it', () => {
            const path = calculateShadowPath(createBox(radius('20px')), 0, 0, -5);
            path.forEach((corner) => deepStrictEqual(radii(corner), [15, 15]));
            const [topLeft] = path as BezierCurve[];
            deepStrictEqual([topLeft.start.x, topLeft.end.y], [15, 25]);
        });

        it('keeps sharp corners sharp', () => {
            const path = calculateShadowPath(createBox({}), 0, 0, 10);
            deepStrictEqual(points(path), [
                [0, 10],
                [120, 10],
                [120, 90],
                [0, 90]
            ]);
        });

        it('collapses to the center when a negative spread is larger than the box', () => {
            const path = calculateShadowPath(createBox(radius('20px')), 0, 0, -60);
            deepStrictEqual(points(path), [
                [60, 50],
                [60, 50],
                [60, 50],
                [60, 50]
            ]);
        });

        it('keeps the radii of a fully rounded box from overlapping', () => {
            const path = calculateShadowPath(createBox(radius('50%')), 0, 0, 10);
            const [topLeft, topRight] = path as BezierCurve[];
            // the top edge ends where the next corner starts, without crossing it
            strictEqual(topLeft.end.x <= topRight.start.x, true);
        });
    });

    describe('reversePath', () => {
        it('traces the path in the opposite direction, curves included', () => {
            const curve = new BezierCurve(new Vector(0, 10), new Vector(0, 5), new Vector(5, 0), new Vector(10, 0));
            const corner = new Vector(20, 0);
            const reversed = reversePath([curve, corner]);
            strictEqual(reversed[0], corner);
            deepStrictEqual(points([reversed[1]]), [[10, 0, 5, 0, 0, 5, 0, 10]]);
        });
    });
});
