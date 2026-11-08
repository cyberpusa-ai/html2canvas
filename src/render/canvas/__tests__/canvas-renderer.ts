import {strictEqual} from 'assert';
import '../../../dom/node-parser';
import {CanvasRenderer} from '../canvas-renderer';
import {Context} from '../../../core/context';
import {Bounds} from '../../../css/layout/bounds';
import {ElementPaint} from '../../stacking-context';
import {FontMetrics} from '../../font-metrics';
import {ElementContainer} from '../../../dom/element-container';
import {InputElementContainer} from '../../../dom/replaced-elements/input-element-container';

const createMockCanvas = (): {canvas: HTMLCanvasElement; fonts: string[]} => {
    const fonts: string[] = [];
    const ctx = new Proxy({} as {[key: string]: unknown}, {
        get: (target, prop: string) => (prop in target ? target[prop] : () => ({width: 0})),
        set: (target, prop: string, value) => {
            if (prop === 'font') {
                fonts.push(value);
            }
            target[prop] = value;
            return true;
        }
    });
    const canvas = {getContext: () => ctx} as unknown as HTMLCanvasElement;
    return {canvas, fonts};
};

const createRenderer = (canvas: HTMLCanvasElement): {context: Context; renderer: CanvasRenderer} => {
    const context = new Context(
        {logging: false, imageTimeout: 0, useCORS: false, allowTaint: false},
        new Bounds(0, 0, 800, 600)
    );
    const renderer = new CanvasRenderer(context, {
        canvas,
        backgroundColor: null,
        scale: 1,
        x: 0,
        y: 0,
        width: 800,
        height: 600
    });
    return {context, renderer};
};

describe('CanvasRenderer', () => {
    let getMetrics: jest.SpyInstance;
    let getComputedStyle: jest.SpyInstance;

    // jsdom's computed styles are mostly empty strings; undefined properties fall back to their initial values
    const mockComputedStyle = (style: {[key: string]: string}) => {
        getComputedStyle.mockReturnValue(style as unknown as CSSStyleDeclaration);
    };

    beforeEach(() => {
        getMetrics = jest.spyOn(FontMetrics.prototype, 'getMetrics').mockReturnValue({baseline: 10, middle: 5});
        getComputedStyle = jest.spyOn(window, 'getComputedStyle');
    });

    afterEach(() => {
        getMetrics.mockRestore();
        getComputedStyle.mockRestore();
    });

    it('renders input text with the full font string and measures metrics by family and size', async () => {
        const input = document.createElement('input');
        input.value = 'hello';
        mockComputedStyle({fontFamily: 'Arial', fontSize: '20px', fontVariant: 'small-caps'});

        const {canvas, fonts} = createMockCanvas();
        const {context, renderer} = createRenderer(canvas);
        const container = new InputElementContainer(context, input);
        await renderer.renderNodeContent(new ElementPaint(container, null));

        strictEqual(getMetrics.mock.calls.length, 1);
        strictEqual(getMetrics.mock.calls[0][0], 'Arial');
        strictEqual(getMetrics.mock.calls[0][1], '20px');
        strictEqual(fonts[fonts.length - 1], 'normal small-caps 400 20px Arial');
    });

    it('renders list markers with the full font string', async () => {
        const li = document.createElement('li');
        mockComputedStyle({
            fontFamily: 'Arial',
            fontSize: '20px',
            fontVariant: 'small-caps',
            display: 'list-item',
            listStyleType: 'decimal'
        });

        const {canvas, fonts} = createMockCanvas();
        const {context, renderer} = createRenderer(canvas);
        const container = new ElementContainer(context, li);
        const paint = new ElementPaint(container, null);
        paint.listValue = '1.';
        await renderer.renderNodeContent(paint);

        strictEqual(fonts[fonts.length - 1], 'normal small-caps 400 20px Arial');
    });

    it('skips background images whose rendered size is zero', async () => {
        mockComputedStyle({backgroundImage: 'url(empty.svg)'});

        const {canvas} = createMockCanvas();
        const {context, renderer} = createRenderer(canvas);
        const container = new ElementContainer(context, document.createElement('div'));
        container.bounds = new Bounds(0, 0, 100, 100);
        jest.spyOn(context.cache, 'match').mockResolvedValue({width: 0, height: 0});
        const createPattern = jest.fn(() => {
            throw new Error('InvalidStateError');
        });
        (canvas.getContext('2d') as unknown as {[key: string]: unknown}).createPattern = createPattern;

        await renderer.renderBackgroundImage(container);

        strictEqual(createPattern.mock.calls.length, 0);
    });

    it('passes a canvas, not the source image, to createPattern when no resize is needed', async () => {
        // Safari throws "SecurityError: The operation is insecure" from createPattern with SVG images
        mockComputedStyle({backgroundImage: 'url(image.svg)', backgroundSize: '100px 100px'});

        const {canvas} = createMockCanvas();
        const {context, renderer} = createRenderer(canvas);
        const container = new ElementContainer(context, document.createElement('div'));
        container.bounds = new Bounds(0, 0, 100, 100);
        const image = {width: 100, height: 100};
        jest.spyOn(context.cache, 'match').mockResolvedValue(image);
        const drawImage = jest.fn();
        const getContext = jest
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D);
        const createPattern = jest.fn();
        (canvas.getContext('2d') as unknown as {[key: string]: unknown}).createPattern = createPattern;

        try {
            await renderer.renderBackgroundImage(container);
        } finally {
            getContext.mockRestore();
        }

        strictEqual(createPattern.mock.calls.length, 1);
        const source = (createPattern.mock.calls[0] as unknown[])[0] as HTMLCanvasElement;
        strictEqual(source instanceof HTMLCanvasElement, true);
        strictEqual(source.width, 100);
        strictEqual(source.height, 100);
        strictEqual(drawImage.mock.calls[0][0], image);
    });
});
