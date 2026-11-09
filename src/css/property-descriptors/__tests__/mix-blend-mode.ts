import {strictEqual} from 'assert';
import {mixBlendMode} from '../mix-blend-mode';
import {Context} from '../../../core/context';
import {CSSParsedDeclaration} from '../../index';

const context = {logger: {debug: jest.fn()}} as unknown as Context;

describe('property-descriptors', () => {
    describe('mix-blend-mode', () => {
        it('normal', () => strictEqual(mixBlendMode.parse(context, 'normal'), 'normal'));
        it('multiply', () => strictEqual(mixBlendMode.parse(context, 'multiply'), 'multiply'));
        it('color-burn', () => strictEqual(mixBlendMode.parse(context, 'color-burn'), 'color-burn'));
        it('luminosity', () => strictEqual(mixBlendMode.parse(context, 'luminosity'), 'luminosity'));
        it('unknown values fall back to normal', () =>
            strictEqual(mixBlendMode.parse(context, 'plus-darker'), 'normal'));
        it('canvas-only composite operations fall back to normal', () =>
            strictEqual(mixBlendMode.parse(context, 'xor'), 'normal'));
    });

    describe('CSSParsedDeclaration mix-blend-mode', () => {
        const parse = (style: Partial<CSSStyleDeclaration>) =>
            new CSSParsedDeclaration(context, style as CSSStyleDeclaration);

        it('keeps the blend mode', () => strictEqual(parse({mixBlendMode: 'screen'}).mixBlendMode, 'screen'));
        it('is blended for non-normal modes', () => strictEqual(parse({mixBlendMode: 'screen'}).isBlended(), true));
        it('is not blended for normal', () => strictEqual(parse({mixBlendMode: 'normal'}).isBlended(), false));
        it('is not blended when the browser has no mix-blend-mode property', () =>
            strictEqual(parse({}).isBlended(), false));
    });
});
