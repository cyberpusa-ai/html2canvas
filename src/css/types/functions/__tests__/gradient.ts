import {deepStrictEqual} from 'assert';
import {processColorStops} from '../gradient';
import {UnprocessedGradientColorStop} from '../../image';
import {HUNDRED_PERCENT, ZERO_LENGTH} from '../../length-percentage';
import {TokenType} from '../../../syntax/tokenizer';

const RED = 0xff0000ff;
const BLUE = 0x0000ffff;
const GREEN = 0x00ff00ff;

const stops = (): UnprocessedGradientColorStop[] => [
    {color: RED, stop: null},
    {color: BLUE, stop: {type: TokenType.DIMENSION_TOKEN, number: 10, flags: 0, unit: 'px'}},
    {color: GREEN, stop: null}
];

describe('functions', () => {
    describe('gradient', () => {
        describe('processColorStops', () => {
            it('resolves stops relative to line length', () =>
                deepStrictEqual(processColorStops(stops(), 100), [
                    {color: RED, stop: 0},
                    {color: BLUE, stop: 0.1},
                    {color: GREEN, stop: 1}
                ]));

            it('returns finite stops when line length is 0', () =>
                deepStrictEqual(processColorStops(stops(), 0), [
                    {color: RED, stop: 0},
                    {color: BLUE, stop: 0},
                    {color: GREEN, stop: 0}
                ]));

            it('returns finite stops for percentage stops when line length is 0', () =>
                deepStrictEqual(
                    processColorStops(
                        [
                            {color: RED, stop: ZERO_LENGTH},
                            {color: GREEN, stop: HUNDRED_PERCENT}
                        ],
                        0
                    ),
                    [
                        {color: RED, stop: 0},
                        {color: GREEN, stop: 0}
                    ]
                ));
        });

    });
});
