import {deepStrictEqual, ok} from 'assert';
import {Parser} from '../../../syntax/parser';
import {calculateGradientDirection, processColorStops} from '../gradient';
import {color} from '../../color';
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
    });
});
