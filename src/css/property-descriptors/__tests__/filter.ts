import {strictEqual} from 'assert';
import {filter, scaleFilter} from '../filter';
import {Parser} from '../../syntax/parser';
import {Context} from '../../../core/context';
import {CSSParsedDeclaration} from '../../index';

const context = {logger: {debug: jest.fn()}} as unknown as Context;
const filterParse = (value: string) => filter.parse(context, Parser.parseValues(value));

describe('property-descriptors', () => {
    describe('filter', () => {
        it('none', () => strictEqual(filterParse('none'), false));
        it('blur(2px)', () => strictEqual(filterParse('blur(2px)'), true));
        it('drop-shadow(rgb(0, 0, 0) 2px 2px 4px)', () =>
            strictEqual(filterParse('drop-shadow(rgb(0, 0, 0) 2px 2px 4px)'), true));
        it('grayscale(1) hue-rotate(90deg) opacity(0.5)', () =>
            strictEqual(filterParse('grayscale(1) hue-rotate(90deg) opacity(0.5)'), true));
        it('url(#svg-filter)', () => strictEqual(filterParse('url(#svg-filter)'), false));
        it('blur(2px) url(#svg-filter)', () => strictEqual(filterParse('blur(2px) url(#svg-filter)'), false));
        it('unknown functions', () => strictEqual(filterParse('glow(2px)'), false));
    });

    describe('CSSParsedDeclaration filter', () => {
        const parse = (style: Partial<CSSStyleDeclaration>) =>
            new CSSParsedDeclaration(context, style as CSSStyleDeclaration).filter;

        it('keeps the computed filter string', () =>
            strictEqual(parse({filter: 'blur(2px) sepia(1)'}), 'blur(2px) sepia(1)'));
        it('is null for none', () => strictEqual(parse({filter: 'none'}), null));
        it('is null when the browser has no filter property', () => strictEqual(parse({}), null));
        it('is null for filters the canvas cannot draw', () => strictEqual(parse({filter: 'url(#f)'}), null));
    });

    describe('scaleFilter', () => {
        it('keeps the string at scale 1', () => strictEqual(scaleFilter('blur(2.5px)', 1), 'blur(2.5px)'));
        it('scales blur', () => strictEqual(scaleFilter('blur(2.5px)', 2), 'blur(5px)'));
        it('scales every drop-shadow length but not the color', () =>
            strictEqual(
                scaleFilter('drop-shadow(rgba(0, 0, 0, 0.5) -4px .5px 3px)', 1.5),
                'drop-shadow(rgba(0, 0, 0, 0.5) -6px 0.75px 4.5px)'
            ));
        it('leaves functions without lengths alone', () =>
            strictEqual(
                scaleFilter('hue-rotate(90deg) opacity(0.5) brightness(150%)', 3),
                'hue-rotate(90deg) opacity(0.5) brightness(150%)'
            ));
    });
});
