import {deepStrictEqual} from 'assert';
import {Bounds} from '../../css/layout/bounds';
import {CSSParsedDeclaration} from '../../css';
import {Context} from '../../core/context';
import {BACKGROUND_CLIP} from '../../css/property-descriptors/background-clip';
import {calculateInlineFragmentBorders, calculateInlineFragmentClipBoxes} from '../inline-fragments';

const context = new Context({logging: false, imageTimeout: 0, useCORS: false, allowTaint: false}, Bounds.EMPTY);
const parseStyles = (style: {[key: string]: string}): CSSParsedDeclaration =>
    new CSSParsedDeclaration(context, style as unknown as CSSStyleDeclaration);

const fragments = [new Bounds(100, 0, 100, 20), new Bounds(0, 20, 50, 20)];
const toArray = (bounds: Bounds[]) => bounds.map((b) => [b.left, b.top, b.width, b.height]);

describe('inline-fragments', () => {
    const styles = parseStyles({
        borderTopWidth: '1px',
        borderRightWidth: '2px',
        borderBottomWidth: '3px',
        borderLeftWidth: '4px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: 'red',
        borderRightColor: 'red',
        borderBottomColor: 'red',
        borderLeftColor: 'red',
        paddingLeft: '5px',
        paddingRight: '6px',
        paddingTop: '1px',
        paddingBottom: '1px'
    });

    describe('calculateInlineFragmentClipBoxes', () => {
        it('uses the fragments as they are for border-box', () => {
            deepStrictEqual(toArray(calculateInlineFragmentClipBoxes(fragments, styles, BACKGROUND_CLIP.BORDER_BOX)), [
                [100, 0, 100, 20],
                [0, 20, 50, 20]
            ]);
        });

        it('insets the start edge only on the first fragment and the end edge only on the last', () => {
            deepStrictEqual(toArray(calculateInlineFragmentClipBoxes(fragments, styles, BACKGROUND_CLIP.PADDING_BOX)), [
                [104, 1, 96, 16],
                [0, 21, 48, 16]
            ]);
            deepStrictEqual(toArray(calculateInlineFragmentClipBoxes(fragments, styles, BACKGROUND_CLIP.CONTENT_BOX)), [
                [109, 2, 91, 14],
                [0, 22, 42, 14]
            ]);
        });

        it('swaps the start and end edges for rtl', () => {
            const rtl = parseStyles({borderLeftWidth: '4px', borderRightWidth: '2px', direction: 'rtl'});
            deepStrictEqual(toArray(calculateInlineFragmentClipBoxes(fragments, rtl, BACKGROUND_CLIP.PADDING_BOX)), [
                [100, 0, 98, 20],
                [4, 20, 46, 20]
            ]);
        });
    });

    describe('calculateInlineFragmentBorders', () => {
        it('draws top and bottom on every fragment, left on the first and right on the last', () => {
            deepStrictEqual(toArray(calculateInlineFragmentBorders(fragments, styles).map((b) => b.bounds)), [
                [100, 0, 100, 1],
                [100, 17, 100, 3],
                [100, 0, 4, 20],
                [0, 20, 50, 1],
                [48, 20, 2, 20],
                [0, 37, 50, 3]
            ]);
        });

        it('skips sides without a visible border', () => {
            const top = parseStyles({borderTopWidth: '2px', borderTopStyle: 'solid', borderTopColor: 'red'});
            deepStrictEqual(toArray(calculateInlineFragmentBorders(fragments, top).map((b) => b.bounds)), [
                [100, 0, 100, 2],
                [0, 20, 50, 2]
            ]);
            deepStrictEqual(calculateInlineFragmentBorders(fragments, parseStyles({})), []);
        });
    });
});
