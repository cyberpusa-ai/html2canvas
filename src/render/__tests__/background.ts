import {deepStrictEqual} from 'assert';
import '../../dom/node-parser';
import {calculateBackgroundRendering} from '../background';
import {Context} from '../../core/context';
import {Bounds} from '../../css/layout/bounds';
import {ElementContainer} from '../../dom/element-container';

const createContainer = (style: {[key: string]: string}): ElementContainer => {
    const context = new Context(
        {logging: false, imageTimeout: 0, useCORS: false, allowTaint: false},
        new Bounds(0, 0, 800, 600)
    );
    const getComputedStyle = jest
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue(style as unknown as CSSStyleDeclaration);
    const container = new ElementContainer(context, document.createElement('div'));
    getComputedStyle.mockRestore();
    container.bounds = new Bounds(0, 0, 100, 100);
    return container;
};

const backgroundSize = (style: {[key: string]: string}, intrinsicSize: [number | null, number | null, number | null]) => {
    const [, , , width, height] = calculateBackgroundRendering(createContainer(style), 0, intrinsicSize);
    return [width, height];
};

describe('calculateBackgroundRendering', () => {
    it('clamps sub-pixel background sizes to at least 1px', () => {
        deepStrictEqual(backgroundSize({backgroundSize: '0.4px 0.4px'}, [null, null, null]), [1, 1]);
        deepStrictEqual(backgroundSize({backgroundSize: '0.4px'}, [10, 10, 1]), [1, 1]);
        deepStrictEqual(backgroundSize({backgroundSize: '50px 0.5px'}, [null, null, null]), [50, 1]);
    });

    it('keeps zero background sizes at zero', () => {
        deepStrictEqual(backgroundSize({backgroundSize: '0 100%'}, [null, null, null]), [0, 100]);
        deepStrictEqual(backgroundSize({backgroundSize: '100% 0'}, [null, null, null]), [100, 0]);
        deepStrictEqual(backgroundSize({backgroundSize: 'auto'}, [0, 0, NaN]), [0, 0]);
    });

    it('keeps sizes of 1px and above unchanged', () => {
        deepStrictEqual(backgroundSize({backgroundSize: '1px 2.5px'}, [null, null, null]), [1, 2.5]);
        deepStrictEqual(backgroundSize({backgroundSize: 'auto'}, [20, 10, 2]), [20, 10]);
    });
});
