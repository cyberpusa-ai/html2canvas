import {deepStrictEqual, strictEqual} from 'assert';
import {Bounds} from '../../css/layout/bounds';
import {CSSParsedDeclaration} from '../../css';
import {Context} from '../../core/context';
import {BORDER_STYLE} from '../../css/property-descriptors/border-style';
import {getAbsoluteValue, getAbsoluteValueForTuple} from '../../css/types/length-percentage';
import {calculateInlineFragments} from '../inline-fragments';
import {BoundCurves, calculateBorderBoxPath} from '../bound-curves';
import {isBezierCurve} from '../bezier-curve';

const context = new Context({logging: false, imageTimeout: 0, useCORS: false, allowTaint: false}, Bounds.EMPTY);
const parseStyles = (style: {[key: string]: string}): CSSParsedDeclaration =>
    new CSSParsedDeclaration(context, style as unknown as CSSStyleDeclaration);

const lines = [new Bounds(100, 0, 100, 20), new Bounds(0, 20, 50, 20), new Bounds(0, 40, 80, 20)];

const edges = (styles: CSSParsedDeclaration) => ({
    left: [styles.borderLeftWidth, styles.borderLeftStyle, getAbsoluteValue(styles.paddingLeft, 0)],
    right: [styles.borderRightWidth, styles.borderRightStyle, getAbsoluteValue(styles.paddingRight, 0)],
    top: [styles.borderTopWidth, styles.borderTopStyle, getAbsoluteValue(styles.paddingTop, 0)],
    bottom: [styles.borderBottomWidth, styles.borderBottomStyle, getAbsoluteValue(styles.paddingBottom, 0)]
});

describe('inline-fragments', () => {
    const styles = parseStyles({
        borderTopWidth: '1px',
        borderRightWidth: '2px',
        borderBottomWidth: '3px',
        borderLeftWidth: '4px',
        borderTopStyle: 'dotted',
        borderRightStyle: 'dashed',
        borderBottomStyle: 'double',
        borderLeftStyle: 'solid',
        borderTopColor: 'red',
        borderRightColor: 'red',
        borderBottomColor: 'red',
        borderLeftColor: 'red',
        paddingLeft: '5px',
        paddingRight: '6px',
        paddingTop: '1px',
        paddingBottom: '1px',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        boxShadow: '1px 1px 2px black'
    });

    it('keeps one fragment per line box with its bounds', () => {
        const fragments = calculateInlineFragments(lines, styles);
        deepStrictEqual(
            fragments.map((f) => f.bounds),
            lines
        );
    });

    it('keeps the start edge only on the first fragment and the end edge only on the last', () => {
        const [first, middle, last] = calculateInlineFragments(lines, styles).map((f) => edges(f.styles));
        const top = [1, BORDER_STYLE.DOTTED, 1];
        const bottom = [3, BORDER_STYLE.DOUBLE, 1];
        const none = [0, BORDER_STYLE.NONE, 0];
        deepStrictEqual(first, {left: [4, BORDER_STYLE.SOLID, 5], right: none, top, bottom});
        deepStrictEqual(middle, {left: none, right: none, top, bottom});
        deepStrictEqual(last, {left: none, right: [2, BORDER_STYLE.DASHED, 6], top, bottom});
    });

    it('keeps corner radii only on the outer corners', () => {
        const radii = calculateInlineFragments(lines, styles).map(({styles: s}) =>
            [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(
                (r) => getAbsoluteValueForTuple(r, 100, 20)[0]
            )
        );
        deepStrictEqual(radii, [
            [4, 0, 0, 4],
            [0, 0, 0, 0],
            [0, 4, 4, 0]
        ]);
        const corners = calculateInlineFragments(lines, styles).map((fragment) =>
            calculateBorderBoxPath(new BoundCurves(fragment)).map(isBezierCurve)
        );
        deepStrictEqual(corners, [
            [true, false, false, true],
            [false, false, false, false],
            [false, true, true, false]
        ]);
    });

    it('keeps every other style, such as box-shadow and colors', () => {
        calculateInlineFragments(lines, styles).forEach((fragment) => {
            strictEqual(fragment.styles.boxShadow, styles.boxShadow);
            strictEqual(fragment.styles.borderTopColor, styles.borderTopColor);
        });
        // the original styles are not modified
        deepStrictEqual(edges(styles).left, [4, BORDER_STYLE.SOLID, 5]);
        deepStrictEqual(edges(styles).right, [2, BORDER_STYLE.DASHED, 6]);
    });

    it('swaps the start and end edges for rtl', () => {
        const rtl = parseStyles({
            borderLeftWidth: '4px',
            borderLeftStyle: 'solid',
            borderRightWidth: '2px',
            borderRightStyle: 'solid',
            direction: 'rtl'
        });
        const [first, , last] = calculateInlineFragments(lines, rtl).map((f) => edges(f.styles));
        deepStrictEqual([first.left[0], first.right[0]], [0, 2]);
        deepStrictEqual([last.left[0], last.right[0]], [4, 0]);
    });
});
