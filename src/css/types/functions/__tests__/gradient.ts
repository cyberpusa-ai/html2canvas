import {deepStrictEqual, ok} from 'assert';
import {Parser} from '../../../syntax/parser';
import {
    calculateGradientDirection,
    calculateRadialPaintLength,
    processColorStops,
    processRepeatingColorStops
} from '../gradient';
import {asString, color} from '../../color';
import {UnprocessedGradientColorStop} from '../../image';
import {FIFTY_PERCENT, LengthPercentage} from '../../length-percentage';
import {Context} from '../../../../core/context';

const colorParse = (value: string) => color.parse({} as Context, Parser.parseValue(value));
const length = (value: string) => Parser.parseValue(value) as LengthPercentage;

const stops = (): UnprocessedGradientColorStop[] => [
    {color: colorParse('red'), stop: null},
    {color: colorParse('blue'), stop: FIFTY_PERCENT},
    {color: colorParse('green'), stop: length('20px')},
    {color: colorParse('yellow'), stop: null}
];

describe('functions', () => {
    describe('gradient', () => {
        describe('processColorStops', () => {
            it('returns stops relative to the line length', () =>
                deepStrictEqual(
                    processColorStops(stops(), 100).map(({stop}) => stop),
                    [0, 0.5, 0.5, 1]
                ));

            it('returns finite stops when the line length is 0', () => {
                const result = processColorStops(stops(), 0);
                deepStrictEqual(result.length, 4);
                result.forEach(({stop}) => ok(isFinite(stop) && stop >= 0 && stop <= 1, `stop ${stop}`));
            });

            it('returns finite stops when the line length is negative', () =>
                processColorStops(stops(), -1).forEach(({stop}) => ok(isFinite(stop), `stop ${stop}`)));

            it('returns finite stops for a zero-sized gradient box', () => {
                const [lineLength] = calculateGradientDirection(Math.PI / 2, 0, 0);
                processColorStops(stops(), lineLength).forEach(({stop}) => ok(isFinite(stop), `stop ${stop}`));
            });
        });

        describe('processRepeatingColorStops', () => {
            const simplify = (result: {color: number; stop: number}[]) =>
                result.map(({color, stop}) => [asString(color), Math.round(stop * 1000) / 1000]);

            it('repeats the stop list along the gradient line', () =>
                deepStrictEqual(
                    simplify(
                        processRepeatingColorStops(
                            [
                                {color: colorParse('red'), stop: null},
                                {color: colorParse('blue'), stop: length('25px')}
                            ],
                            100
                        )
                    ),
                    [
                        ['rgb(255,0,0)', 0],
                        ['rgb(0,0,255)', 0.25],
                        ['rgb(255,0,0)', 0.25],
                        ['rgb(0,0,255)', 0.5],
                        ['rgb(255,0,0)', 0.5],
                        ['rgb(0,0,255)', 0.75],
                        ['rgb(255,0,0)', 0.75],
                        ['rgb(0,0,255)', 1]
                    ]
                ));

            it('cuts the last repetition at the end of the line with the interpolated color', () =>
                deepStrictEqual(
                    simplify(
                        processRepeatingColorStops(
                            [
                                {color: colorParse('black'), stop: null},
                                {color: colorParse('white'), stop: length('40px')}
                            ],
                            100
                        )
                    ),
                    [
                        ['rgb(0,0,0)', 0],
                        ['rgb(255,255,255)', 0.4],
                        ['rgb(0,0,0)', 0.4],
                        ['rgb(255,255,255)', 0.8],
                        ['rgb(0,0,0)', 0.8],
                        ['rgb(128,128,128)', 1]
                    ]
                ));

            it('repeats backwards to fill the line before the first stop', () =>
                deepStrictEqual(
                    simplify(
                        processRepeatingColorStops(
                            [
                                {color: colorParse('red'), stop: length('5px')},
                                {color: colorParse('blue'), stop: length('15px')}
                            ],
                            20
                        )
                    ),
                    [
                        ['rgb(128,0,128)', 0],
                        ['rgb(0,0,255)', 0.25],
                        ['rgb(255,0,0)', 0.25],
                        ['rgb(0,0,255)', 0.75],
                        ['rgb(255,0,0)', 0.75],
                        ['rgb(128,0,128)', 1]
                    ]
                ));

            it('offsets stops by the paint length when it is longer than the line', () =>
                deepStrictEqual(
                    simplify(
                        processRepeatingColorStops(
                            [
                                {color: colorParse('red'), stop: null},
                                {color: colorParse('blue'), stop: FIFTY_PERCENT}
                            ],
                            20,
                            40
                        )
                    ),
                    [
                        ['rgb(255,0,0)', 0],
                        ['rgb(0,0,255)', 0.25],
                        ['rgb(255,0,0)', 0.25],
                        ['rgb(0,0,255)', 0.5],
                        ['rgb(255,0,0)', 0.5],
                        ['rgb(0,0,255)', 0.75],
                        ['rgb(255,0,0)', 0.75],
                        ['rgb(0,0,255)', 1]
                    ]
                ));

            it('falls back to non-repeating stops when the period is 0', () =>
                deepStrictEqual(
                    processRepeatingColorStops(
                        [
                            {color: colorParse('red'), stop: length('10px')},
                            {color: colorParse('blue'), stop: length('10px')}
                        ],
                        100
                    ).map(({stop}) => stop),
                    [0.1, 0.1]
                ));

            it('falls back to non-repeating stops when the period is too small to repeat', () =>
                deepStrictEqual(
                    processRepeatingColorStops(
                        [
                            {color: colorParse('red'), stop: length('0px')},
                            {color: colorParse('blue'), stop: length('0.001px')}
                        ],
                        1000
                    ).length,
                    2
                ));

            it('returns finite stops in [0, 1] for empty or negative lines', () =>
                [0, -1].forEach((lineLength) =>
                    processRepeatingColorStops(stops(), lineLength).forEach(({stop}) =>
                        ok(isFinite(stop) && stop >= 0 && stop <= 1, `stop ${stop} for line ${lineLength}`)
                    )
                ));
        });

        describe('calculateRadialPaintLength', () => {
            it('returns the distance to the farthest corner for circles', () =>
                deepStrictEqual(calculateRadialPaintLength(0, 0, 30, 40, 10, 10), 50));

            it('measures elliptical gradients along the x radius', () =>
                deepStrictEqual(calculateRadialPaintLength(0, 0, 30, 20, 10, 5), 50));
        });
    });
});
