import {deepStrictEqual} from 'assert';
import {Parser} from '../../syntax/parser';
import {backgroundImage} from '../background-image';
import {CSSImageType} from '../../types/image';
import {pack} from '../../types/color';
import {deg} from '../../types/angle';
import {backgroundPosition, getAbsoluteValueForPosition} from '../background-position';

jest.mock('../../../core/context');
import {Context} from '../../../core/context';

jest.mock('../../../core/features');

const backgroundImageParse = (context: Context, value: string) =>
    backgroundImage.parse(context, Parser.parseValues(value));

// resolved against a 200x100 area left for the image to move in
const backgroundPositionResolve = (context: Context, value: string) =>
    backgroundPosition
        .parse(context, Parser.parseValues(value))
        .map((position) => getAbsoluteValueForPosition(position, 200, 100));

describe('property-descriptors', () => {
    let context: Context;
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context = new Context({} as any, {} as any);
    });
    describe('background-image', () => {
        it('none', () => {
            deepStrictEqual(backgroundImageParse(context, 'none'), []);
            expect(context.cache.addImage).not.toHaveBeenCalled();
        });

        it('url(test.jpg), url(test2.jpg)', () => {
            deepStrictEqual(
                backgroundImageParse(context, 'url(http://example.com/test.jpg), url(http://example.com/test2.jpg)'),
                [
                    {url: 'http://example.com/test.jpg', type: CSSImageType.URL},
                    {url: 'http://example.com/test2.jpg', type: CSSImageType.URL}
                ]
            );
            expect(context.cache.addImage).toHaveBeenCalledWith('http://example.com/test.jpg');
            expect(context.cache.addImage).toHaveBeenCalledWith('http://example.com/test2.jpg');
        });

        it(`linear-gradient(to bottom, rgba(255,255,0,0.5), rgba(0,0,255,0.5)), url('https://html2canvas.hertzen.com')`, () =>
            deepStrictEqual(
                backgroundImageParse(
                    context,
                    `linear-gradient(to bottom, rgba(255,255,0,0.5), rgba(0,0,255,0.5)), url('https://html2canvas.hertzen.com')`
                ),
                [
                    {
                        angle: deg(180),
                        type: CSSImageType.LINEAR_GRADIENT,
                        stops: [
                            {color: pack(255, 255, 0, 0.5), stop: null},
                            {color: pack(0, 0, 255, 0.5), stop: null}
                        ]
                    },
                    {url: 'https://html2canvas.hertzen.com', type: CSSImageType.URL}
                ]
            ));
    });
    describe('background-position', () => {
        it('0% 0%', () => deepStrictEqual(backgroundPositionResolve(context, '0% 0%'), [[0, 0]]));
        it('10px 20%', () => deepStrictEqual(backgroundPositionResolve(context, '10px 20%'), [[10, 20]]));
        it('50% 50%, 100% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, '50% 50%, 100% 0%'), [
                [100, 50],
                [200, 0]
            ]));
        it('25%', () => deepStrictEqual(backgroundPositionResolve(context, '25%'), [[50, 50]]));
        it('right', () => deepStrictEqual(backgroundPositionResolve(context, 'right'), [[200, 50]]));
        it('top', () => deepStrictEqual(backgroundPositionResolve(context, 'top'), [[100, 0]]));
        it('center', () => deepStrictEqual(backgroundPositionResolve(context, 'center'), [[100, 50]]));
        it('right bottom', () => deepStrictEqual(backgroundPositionResolve(context, 'right bottom'), [[200, 100]]));
        it('bottom right', () => deepStrictEqual(backgroundPositionResolve(context, 'bottom right'), [[200, 100]]));
        it('top center', () => deepStrictEqual(backgroundPositionResolve(context, 'top center'), [[100, 0]]));
        it('center left', () => deepStrictEqual(backgroundPositionResolve(context, 'center left'), [[0, 50]]));
        it('left 10px', () => deepStrictEqual(backgroundPositionResolve(context, 'left 10px'), [[0, 10]]));
        it('right 30px bottom 40px', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'right 30px bottom 40px'), [[170, 60]]));
        it('bottom 40px right 30px', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'bottom 40px right 30px'), [[170, 60]]));
        it('right 15% top 20%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'right 15% top 20%'), [[170, 20]]));
        it('left bottom -40px', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'left bottom -40px'), [[0, 140]]));
        it('right 20px center', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'right 20px center'), [[180, 50]]));
        it('center bottom 10px', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'center bottom 10px'), [[100, 90]]));
        it('left 10px top', () => deepStrictEqual(backgroundPositionResolve(context, 'left 10px top'), [[10, 0]]));
        it('RIGHT 30px BOTTOM 40px', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'RIGHT 30px BOTTOM 40px'), [[170, 60]]));
        it('calc(100% - 30px) calc(100% - 40px)', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'calc(100% - 30px) calc(100% - 40px)'), [[170, 60]]));
        it('calc(50% + 10px) calc(10px + -5px)', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'calc(50% + 10px) calc(10px + -5px)'), [[110, 5]]));
        it('left right falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'left right'), [[0, 0]]));
        it('top bottom falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'top bottom'), [[0, 0]]));
        it('10px left falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, '10px left'), [[0, 0]]));
        it('top 10px falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'top 10px'), [[0, 0]]));
        it('center 10px top falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'center 10px top'), [[0, 0]]));
        it('left 10px right 20px falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'left 10px right 20px'), [[0, 0]]));
        it('calc(2 * 10px) 0 falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'calc(2 * 10px) 0'), [[0, 0]]));
        it('left 10px top 5px 0 falls back to 0% 0%', () =>
            deepStrictEqual(backgroundPositionResolve(context, 'left 10px top 5px 0'), [[0, 0]]));
    });
});
