import {strictEqual} from 'assert';
import {asString, color, isTransparent, pack} from '../color';
import {Parser} from '../../syntax/parser';
import {Context} from '../../../core/context';
import {Logger} from '../../../core/logger';

const logger = new Logger({id: 'test', enabled: false});
const parse = (value: string) => color.parse({logger} as Context, Parser.parseValue(value));

describe('types', () => {
    describe('<color>', () => {
        describe('parsing', () => {
            it('#000', () => strictEqual(parse('#000'), pack(0, 0, 0, 1)));
            it('#0000', () => strictEqual(parse('#0000'), pack(0, 0, 0, 0)));
            it('#000f', () => strictEqual(parse('#000f'), pack(0, 0, 0, 1)));
            it('#fff', () => strictEqual(parse('#fff'), pack(255, 255, 255, 1)));
            it('#000000', () => strictEqual(parse('#000000'), pack(0, 0, 0, 1)));
            it('#00000000', () => strictEqual(parse('#00000000'), pack(0, 0, 0, 0)));
            it('#ffffff', () => strictEqual(parse('#ffffff'), pack(255, 255, 255, 1)));
            it('#ffffffff', () => strictEqual(parse('#ffffffff'), pack(255, 255, 255, 1)));
            it('#7FFFD4', () => strictEqual(parse('#7FFFD4'), pack(127, 255, 212, 1)));
            it('#f0ffff', () => strictEqual(parse('#f0ffff'), pack(240, 255, 255, 1)));
            it('transparent', () => strictEqual(parse('transparent'), pack(0, 0, 0, 0)));
            it('bisque', () => strictEqual(parse('bisque'), pack(255, 228, 196, 1)));
            it('BLUE', () => strictEqual(parse('BLUE'), pack(0, 0, 255, 1)));
            it('rgb(1, 3, 5)', () => strictEqual(parse('rgb(1, 3, 5)'), pack(1, 3, 5, 1)));
            it('rgb(0% 0% 0%)', () => strictEqual(parse('rgb(0% 0% 0%)'), pack(0, 0, 0, 1)));
            it('rgb(50% 50% 50%)', () => strictEqual(parse('rgb(50% 50% 50%)'), pack(128, 128, 128, 1)));
            it('rgba(50% 50% 50% 50%)', () => strictEqual(parse('rgba(50% 50% 50% 50%)'), pack(128, 128, 128, 0.5)));
            it('rgb(100% 100% 100%)', () => strictEqual(parse('rgb(100% 100% 100%)'), pack(255, 255, 255, 1)));
            it('rgb(222 111 50)', () => strictEqual(parse('rgb(222 111 50)'), pack(222, 111, 50, 1)));
            it('rgba(200, 3, 5, 1)', () => strictEqual(parse('rgba(200, 3, 5, 1)'), pack(200, 3, 5, 1)));
            it('rgba(222, 111, 50, 0.22)', () =>
                strictEqual(parse('rgba(222, 111, 50, 0.22)'), pack(222, 111, 50, 0.22)));
            it('rgba(222 111 50 0.123)', () => strictEqual(parse('rgba(222 111 50 0.123)'), pack(222, 111, 50, 0.123)));
            it('hsl(270,60%,70%)', () => strictEqual(parse('hsl(270,60%,70%)'), parse('rgb(178,132,224)')));
            it('hsl(270, 60%, 70%)', () => strictEqual(parse('hsl(270, 60%, 70%)'), parse('rgb(178,132,224)')));
            it('hsl(270 60% 70%)', () => strictEqual(parse('hsl(270 60% 70%)'), parse('rgb(178,132,224)')));
            it('hsl(270deg, 60%, 70%)', () => strictEqual(parse('hsl(270deg, 60%, 70%)'), parse('rgb(178,132,224)')));
            it('hsl(4.71239rad, 60%, 70%)', () =>
                strictEqual(parse('hsl(4.71239rad, 60%, 70%)'), parse('rgb(178,132,224)')));
            it('hsl(.75turn, 60%, 70%)', () => strictEqual(parse('hsl(.75turn, 60%, 70%)'), parse('rgb(178,132,224)')));
            it('hsla(.75turn, 60%, 70%, 50%)', () =>
                strictEqual(parse('hsl(.75turn, 60%, 70%, 50%)'), parse('rgba(178,132,224, 0.5)')));
            it('color(srgb 0 0 0)', () => strictEqual(parse('color(srgb 0 0 0)'), pack(0, 0, 0, 1)));
            it('color(srgb 1 1 1)', () => strictEqual(parse('color(srgb 1 1 1)'), pack(255, 255, 255, 1)));
            it('color(srgb 0.5 0.5 0.5)', () => strictEqual(parse('color(srgb 0.5 0.5 0.5)'), pack(128, 128, 128, 1)));
            it('color(srgb 1 0.5 0)', () => strictEqual(parse('color(srgb 1 0.5 0)'), pack(255, 128, 0, 1)));
            it('color(srgb 0 0 0 / 0.5)', () => strictEqual(parse('color(srgb 0 0 0 / 0.5)'), pack(0, 0, 0, 0.5)));
            it('color(srgb 0 0 0 / 0.85)', () => strictEqual(parse('color(srgb 0 0 0 / 0.85)'), pack(0, 0, 0, 0.85)));
            it('color(srgb 100% 0% 50%)', () => strictEqual(parse('color(srgb 100% 0% 50%)'), pack(255, 0, 128, 1)));
            it('color(srgb 50% 50% 50% / 25%)', () =>
                strictEqual(parse('color(srgb 50% 50% 50% / 25%)'), pack(128, 128, 128, 0.25)));
            it('color(SRGB 1 0 0)', () => strictEqual(parse('color(SRGB 1 0 0)'), pack(255, 0, 0, 1)));
            it('color(srgb 2 -1 0 / 3)', () => strictEqual(parse('color(srgb 2 -1 0 / 3)'), pack(255, 0, 0, 1)));
            it('color(srgb-linear 0.2 0 1)', () =>
                strictEqual(parse('color(srgb-linear 0.2 0 1)'), pack(124, 0, 255, 1)));
            it('color(display-p3 1 0 0)', () => strictEqual(parse('color(display-p3 1 0 0)'), pack(255, 0, 0, 1)));
            it('lab(29.2345% 39.3825 20.0664)', () =>
                strictEqual(parse('lab(29.2345% 39.3825 20.0664)'), pack(125, 35, 41, 1)));
            it('lab(52.2345% 40.1645 59.9971)', () =>
                strictEqual(parse('lab(52.2345% 40.1645 59.9971)'), pack(198, 93, 6, 1)));
            it('lab(60.2345 -5.3654 58.956)', () =>
                strictEqual(parse('lab(60.2345 -5.3654 58.956)'), pack(157, 147, 24, 1)));
            it('lab(67.5345% -8.6911 -41.6019)', () =>
                strictEqual(parse('lab(67.5345% -8.6911 -41.6019)'), pack(98, 172, 239, 1)));
            it('lab(100 0 0)', () => strictEqual(parse('lab(100 0 0)'), pack(255, 255, 255, 1)));
            it('lab(0 0 0)', () => strictEqual(parse('lab(0 0 0)'), pack(0, 0, 0, 1)));
            it('lab(50% 100% -100%)', () => strictEqual(parse('lab(50% 100% -100%)'), pack(214, 0, 255, 1)));
            it('lab(29.2345% 39.3825 20.0664 / 50%)', () =>
                strictEqual(parse('lab(29.2345% 39.3825 20.0664 / 50%)'), pack(125, 35, 41, 0.5)));
            it('lch(29.2345% 44.2 27)', () => strictEqual(parse('lch(29.2345% 44.2 27)'), pack(125, 35, 41, 1)));
            it('lch(52.2345% 72.2 56.2)', () => strictEqual(parse('lch(52.2345% 72.2 56.2)'), pack(198, 93, 6, 1)));
            it('lch(62.2345% 59.2 126.2)', () => strictEqual(parse('lch(62.2345% 59.2 126.2)'), pack(104, 166, 57, 1)));
            it('lch(67.5345% 42.5 258.2)', () => strictEqual(parse('lch(67.5345% 42.5 258.2)'), pack(98, 172, 239, 1)));
            it('lch(29.2345% 44.2 27deg / 0.2)', () =>
                strictEqual(parse('lch(29.2345% 44.2 27deg / 0.2)'), pack(125, 35, 41, 0.2)));
            it('oklab(40.101% 0.1147 0.0453)', () =>
                strictEqual(parse('oklab(40.101% 0.1147 0.0453)'), pack(125, 35, 41, 1)));
            it('oklab(0.65125 -0.0320 0.1274)', () =>
                strictEqual(parse('oklab(0.65125 -0.0320 0.1274)'), pack(157, 147, 24, 1)));
            it('oklab(72.322% -0.0465 -0.1150)', () =>
                strictEqual(parse('oklab(72.322% -0.0465 -0.1150)'), pack(98, 172, 239, 1)));
            it('oklch(40.101% 0.12332 21.555)', () =>
                strictEqual(parse('oklch(40.101% 0.12332 21.555)'), pack(125, 35, 41, 1)));
            it('oklch(0.66016 0.15546 134.231)', () =>
                strictEqual(parse('oklch(0.66016 0.15546 134.231)'), pack(104, 166, 57, 1)));
            it('oklch(72.322% 0.12403 247.996)', () =>
                strictEqual(parse('oklch(72.322% 0.12403 247.996)'), pack(98, 172, 239, 1)));
            it('oklch(63.7% 0.237 25.331)', () =>
                strictEqual(parse('oklch(63.7% 0.237 25.331)'), pack(251, 44, 54, 1)));
            it('oklch(62.3% 0.214 259.815)', () =>
                strictEqual(parse('oklch(62.3% 0.214 259.815)'), pack(43, 127, 255, 1)));
            it('oklch(70% 50% 0.5turn)', () => strictEqual(parse('oklch(70% 50% 0.5turn)'), pack(0, 196, 163, 1)));
            it('oklch(1 0 0)', () => strictEqual(parse('oklch(1 0 0)'), pack(255, 255, 255, 1)));
            it('oklch(0.5 0.4 30)', () => strictEqual(parse('oklch(0.5 0.4 30)'), pack(253, 0, 0, 1)));
            it('oklch(62.3% 0.214 259.815 / 0.5)', () =>
                strictEqual(parse('oklch(62.3% 0.214 259.815 / 0.5)'), pack(43, 127, 255, 0.5)));
            it('oklch(62.3% 0.214 none)', () =>
                strictEqual(parse('oklch(62.3% 0.214 none)'), parse('oklch(62.3% 0.214 0)')));
            it('oklch(none none none / none)', () =>
                strictEqual(parse('oklch(none none none / none)'), pack(0, 0, 0, 0)));
        });
        describe('unsupported values', () => {
            const parseWithWarn = (value: string) => {
                const warn = jest.fn();
                const result = color.parse({logger: {warn}} as unknown as Context, Parser.parseValue(value));
                return {result, warnings: warn.mock.calls.length};
            };
            it('unknown color function', () => {
                const {result, warnings} = parseWithWarn('foo(1 2 3)');
                strictEqual(result, pack(0, 0, 0, 0));
                strictEqual(warnings, 1);
            });
            it('color(xyz 1 1 1)', () => {
                const {result, warnings} = parseWithWarn('color(xyz 1 1 1)');
                strictEqual(result, pack(0, 0, 0, 0));
                strictEqual(warnings, 1);
            });
            it('color(srgb 1)', () => {
                const {result, warnings} = parseWithWarn('color(srgb 1)');
                strictEqual(result, pack(0, 0, 0, 0));
                strictEqual(warnings, 1);
            });
            it('lab(50% 10)', () => {
                const {result, warnings} = parseWithWarn('lab(50% 10)');
                strictEqual(result, pack(0, 0, 0, 0));
                strictEqual(warnings, 1);
            });
            it('oklch(50% 0.1 10px)', () => {
                const {result, warnings} = parseWithWarn('oklch(50% 0.1 10px)');
                strictEqual(result, pack(0, 0, 0, 0));
                strictEqual(warnings, 1);
            });
        });
        describe('util', () => {
            describe('isTransparent', () => {
                it('transparent', () => strictEqual(isTransparent(parse('transparent')), true));
                it('#000', () => strictEqual(isTransparent(parse('#000')), false));
                it('#000f', () => strictEqual(isTransparent(parse('#000f')), false));
                it('#0001', () => strictEqual(isTransparent(parse('#0001')), false));
                it('#0000', () => strictEqual(isTransparent(parse('#0000')), true));
            });

            describe('toString', () => {
                it('transparent', () => strictEqual(asString(parse('transparent')), 'rgba(0,0,0,0)'));
                it('#000', () => strictEqual(asString(parse('#000')), 'rgb(0,0,0)'));
                it('#000f', () => strictEqual(asString(parse('#000f')), 'rgb(0,0,0)'));
                it('#000f', () => strictEqual(asString(parse('#000c')), 'rgba(0,0,0,0.8)'));
                it('#fff', () => strictEqual(asString(parse('#fff')), 'rgb(255,255,255)'));
                it('#ffff', () => strictEqual(asString(parse('#ffff')), 'rgb(255,255,255)'));
                it('#fffc', () => strictEqual(asString(parse('#fffc')), 'rgba(255,255,255,0.8)'));
            });
        });
    });
});
