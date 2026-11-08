import {deepStrictEqual} from 'assert';
import {calculateBackgroundSize} from '../background';
import {Bounds} from '../../css/layout/bounds';
import {BackgroundSizeInfo} from '../../css/property-descriptors/background-size';
import {TokenType} from '../../css/syntax/tokenizer';

const ident = (value: string): BackgroundSizeInfo => ({type: TokenType.IDENT_TOKEN, value});
const length = (number: number): BackgroundSizeInfo => ({
    type: TokenType.DIMENSION_TOKEN,
    number,
    unit: 'px',
    flags: 0
});

describe('render', () => {
    describe('background', () => {
        describe('calculateBackgroundSize', () => {
            const bounds = new Bounds(0, 0, 200, 100);

            it('contain with intrinsic proportion', () =>
                deepStrictEqual(calculateBackgroundSize([ident('contain')], [50, 50, 1], bounds), [100, 100]));

            it('cover with intrinsic proportion', () =>
                deepStrictEqual(calculateBackgroundSize([ident('cover')], [50, 50, 1], bounds), [200, 200]));

            // Firefox can report 0x0 for SVG images without explicit width/height, so 0 / 0 is NaN (#3043)
            it('contain with NaN proportion', () =>
                deepStrictEqual(calculateBackgroundSize([ident('contain')], [0, 0, NaN], bounds), [200, 100]));

            it('cover with Infinity proportion', () =>
                deepStrictEqual(calculateBackgroundSize([ident('cover')], [10, 0, Infinity], bounds), [200, 100]));

            it('width with auto height and NaN proportion', () =>
                deepStrictEqual(calculateBackgroundSize([length(40), ident('auto')], [0, 0, NaN], bounds), [40, 100]));

            it('width with auto height and intrinsic proportion', () =>
                deepStrictEqual(calculateBackgroundSize([length(40), ident('auto')], [20, 10, 2], bounds), [40, 20]));

            it('auto auto with intrinsic size', () =>
                deepStrictEqual(calculateBackgroundSize([ident('auto')], [20, 10, 2], bounds), [20, 10]));

            it('auto auto with zero intrinsic size', () =>
                deepStrictEqual(calculateBackgroundSize([ident('auto')], [0, 0, NaN], bounds), [200, 100]));

            it('auto auto with NaN intrinsic size', () =>
                deepStrictEqual(calculateBackgroundSize([ident('auto')], [NaN, NaN, NaN], bounds), [200, 100]));
        });
    });
});
