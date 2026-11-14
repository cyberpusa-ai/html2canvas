import {deepStrictEqual, strictEqual} from 'assert';
import '../../../dom/node-parser';
import {CanvasRenderer} from '../canvas-renderer';
import {Context} from '../../../core/context';
import {Bounds} from '../../../css/layout/bounds';
import {ElementPaint, StackingContext} from '../../stacking-context';
import {FontMetrics} from '../../font-metrics';
import {ElementContainer} from '../../../dom/element-container';
import {InputElementContainer} from '../../../dom/replaced-elements/input-element-container';
import {TextareaElementContainer} from '../../../dom/elements/textarea-element-container';
import {TextContainer} from '../../../dom/text-container';
import {TextBounds} from '../../../css/layout/text';
import {CSSParsedDeclaration} from '../../../css';
import {CanvasElementContainer} from '../../../dom/replaced-elements/canvas-element-container';
import {FEATURES} from '../../../core/features';

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

const createRenderer = (canvas: HTMLCanvasElement, scale = 1): {context: Context; renderer: CanvasRenderer} => {
    const context = new Context(
        {logging: false, imageTimeout: 0, useCORS: false, allowTaint: false},
        new Bounds(0, 0, 800, 600)
    );
    const renderer = new CanvasRenderer(context, {
        canvas,
        backgroundColor: null,
        scale,
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
        mockComputedStyle({fontFamily: 'Arial', fontSize: '20px', fontStyle: 'italic', fontVariant: 'small-caps'});

        const {canvas, fonts} = createMockCanvas();
        const {context, renderer} = createRenderer(canvas);
        const container = new InputElementContainer(context, input);
        await renderer.renderNodeContent(new ElementPaint(container, null));

        strictEqual(getMetrics.mock.calls.length, 1);
        strictEqual(getMetrics.mock.calls[0][0], 'Arial');
        strictEqual(getMetrics.mock.calls[0][1], '20px');
        strictEqual(getMetrics.mock.calls[0][2], 'italic');
        strictEqual(fonts[fonts.length - 1], 'italic small-caps 400 20px Arial');
    });

    it('renders textarea values on separate lines, wrapped to the content box', async () => {
        const textarea = document.createElement('textarea');
        textarea.value = 'aa bb\ncc';
        mockComputedStyle({fontFamily: 'Arial', fontSize: '10px', lineHeight: '20px'});

        const {canvas} = createMockCanvas();
        const ctx = canvas.getContext('2d') as unknown as {[key: string]: unknown};
        const fillText = jest.fn();
        ctx.fillText = fillText;
        ctx.measureText = (text: string) => ({width: text.length * 10});
        const {context, renderer} = createRenderer(canvas);
        const container = new TextareaElementContainer(context, textarea);
        container.bounds = new Bounds(0, 0, 40, 100);
        await renderer.renderNodeContent(new ElementPaint(container, null));

        const calls = fillText.mock.calls.map(([text, x, y]) => [text, x, y]);
        strictEqual(
            JSON.stringify(calls),
            JSON.stringify([
                ['aa', 0, 10],
                ['bb', 0, 30],
                ['cc', 0, 50]
            ])
        );
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

    describe('background image resolution', () => {
        const renderAtScale = async (scale: number, size: number) => {
            mockComputedStyle({backgroundImage: 'url(image.png)', backgroundSize: `${size}px ${size}px`});

            const {canvas} = createMockCanvas();
            const {context, renderer} = createRenderer(canvas, scale);
            const container = new ElementContainer(context, document.createElement('div'));
            container.bounds = new Bounds(0, 0, 100, 100);
            jest.spyOn(context.cache, 'match').mockResolvedValue({width: 400, height: 400});
            const drawImage = jest.fn();
            const getContext = jest
                .spyOn(HTMLCanvasElement.prototype, 'getContext')
                .mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D);
            const ctx = canvas.getContext('2d') as unknown as {[key: string]: unknown};
            const calls: [string, number[]][] = [];
            ['translate', 'scale', 'fill'].forEach((name) => {
                ctx[name] = (...args: number[]) => calls.push([name, args]);
            });
            const createPattern = jest.fn();
            ctx.createPattern = createPattern;

            try {
                await renderer.renderBackgroundImage(container);
            } finally {
                getContext.mockRestore();
            }

            strictEqual(createPattern.mock.calls.length, 1);
            const tile = (createPattern.mock.calls[0] as unknown[])[0] as HTMLCanvasElement;
            const fillIndex = calls.findIndex(([name]) => name === 'fill');
            const scaleCall = calls.slice(0, fillIndex).find(([name]) => name === 'scale');
            return {tile, drawImage, fillScale: scaleCall ? scaleCall[1] : [1, 1]};
        };

        it('draws the tile at the canvas scale instead of CSS pixels', async () => {
            const {tile, drawImage, fillScale} = await renderAtScale(2, 50);

            strictEqual(tile.width, 100);
            strictEqual(tile.height, 100);
            strictEqual(drawImage.mock.calls[0].slice(5).join(', '), '0, 0, 100, 100');
            deepStrictEqual(fillScale, [0.5, 0.5]);
        });

        it('rounds the tile at fractional scales and fills by the real ratio so tiles keep their CSS size', async () => {
            // 33 * 1.5 = 49.5 device pixels; canvas sizes are integers
            const {tile, drawImage, fillScale} = await renderAtScale(1.5, 33);

            strictEqual(tile.width, 50);
            strictEqual(tile.height, 50);
            strictEqual(drawImage.mock.calls[0].slice(5).join(', '), '0, 0, 50, 50');
            // one tile must span exactly 33 CSS px: 50 * (33 / 50)
            deepStrictEqual(fillScale, [33 / 50, 33 / 50]);
            strictEqual(tile.width * fillScale[0], 33);
        });

        it('does not change the tile at scale 1', async () => {
            const {tile, fillScale} = await renderAtScale(1, 33);

            strictEqual(tile.width, 33);
            strictEqual(tile.height, 33);
            deepStrictEqual(fillScale, [1, 1]);
        });
    });
    describe('object-fit', () => {
        const renderCanvas = async (objectFit?: string) => {
            mockComputedStyle(objectFit ? {objectFit} : {});
            const source = document.createElement('canvas');
            source.width = 200;
            source.height = 100;

            const {canvas} = createMockCanvas();
            const drawImage = jest.fn();
            (canvas.getContext('2d') as unknown as {[key: string]: unknown}).drawImage = drawImage;
            const {context, renderer} = createRenderer(canvas);
            const container = new CanvasElementContainer(context, source);
            container.bounds = new Bounds(10, 20, 100, 100);
            await renderer.renderNodeContent(new ElementPaint(container, null));

            strictEqual(drawImage.mock.calls.length, 1);
            strictEqual(drawImage.mock.calls[0][0], source);
            return drawImage.mock.calls[0].slice(1).join(', ');
        };

        it('stretches the content over the content box by default', async () =>
            strictEqual(await renderCanvas(), '0, 0, 200, 100, 10, 20, 100, 100'));

        it('letterboxes the content with object-fit: contain', async () =>
            strictEqual(await renderCanvas('contain'), '0, 0, 200, 100, 10, 45, 100, 50'));

        it('crops the content with object-fit: cover', async () =>
            strictEqual(await renderCanvas('cover'), '50, 0, 100, 100, 10, 20, 100, 100'));
    });

    describe('text direction', () => {
        const RLM = '\u200F';

        const renderText = async (text: string, style: {[key: string]: string}) => {
            const {canvas} = createMockCanvas();
            const ctx = canvas.getContext('2d') as unknown as {[key: string]: unknown};
            const fillText = jest.fn();
            const strokeText = jest.fn();
            ctx.fillText = fillText;
            ctx.strokeText = strokeText;
            const {context, renderer} = createRenderer(canvas);
            const styles = new CSSParsedDeclaration(context, {
                fontFamily: 'Arial',
                fontSize: '20px',
                ...style
            } as unknown as CSSStyleDeclaration);
            const container = {textBounds: [new TextBounds(text, new Bounds(5, 0, 100, 20))]} as TextContainer;
            await renderer.renderTextNode(container, styles);
            const texts = (mock: jest.Mock): string => JSON.stringify(mock.mock.calls.map(([value]) => value));
            return {fillText: texts(fillText), strokeText: texts(strokeText), ctx};
        };

        it('wraps rtl text in right-to-left marks so edge punctuation stays on the rtl side', async () => {
            // browsers without CanvasRenderingContext2D.direction (Firefox < 101) lay the text out ltr
            const {fillText, ctx} = await renderText('دنیا!', {direction: 'rtl'});

            strictEqual(fillText, JSON.stringify([`${RLM}دنیا!${RLM}`]));
            strictEqual(ctx.direction, 'rtl');
        });

        it('wraps rtl text drawn for text shadows and strokes', async () => {
            const {fillText, strokeText} = await renderText('!سلام', {
                direction: 'rtl',
                textShadow: '1px 1px red',
                webkitTextStrokeWidth: '1px',
                paintOrder: 'stroke fill'
            });

            strictEqual(fillText, JSON.stringify([`${RLM}!سلام${RLM}`, `${RLM}!سلام${RLM}`]));
            strictEqual(strokeText, JSON.stringify([`${RLM}!سلام${RLM}`]));
        });

        it('leaves ltr text unchanged', async () => {
            const {fillText} = await renderText('world!', {direction: 'ltr'});

            strictEqual(fillText, JSON.stringify(['world!']));
        });

        it('draws rtl graphemes unchanged when letter-spacing is set', async () => {
            const {fillText} = await renderText('ab', {direction: 'rtl', letterSpacing: '2px'});

            strictEqual(fillText, JSON.stringify(['a', 'b']));
        });
    });

    describe('filter', () => {
        type Call = [string, unknown[], unknown];
        let supportsFilter: jest.SpyInstance;
        let getContext: jest.SpyInstance;
        let layers: {canvas: HTMLCanvasElement; calls: Call[]}[];

        // records each call with the filter that was active, and keeps the filter across save()/restore()
        const recordingContext = (calls: Call[], target: {[key: string]: unknown} = {}) => {
            const saved: unknown[] = [];
            target.filter = 'none';
            return new Proxy(target, {
                get: (t, prop: string) =>
                    prop in t && prop !== 'save' && prop !== 'restore'
                        ? t[prop]
                        : (...args: unknown[]) => {
                              calls.push([prop, args, t.filter]);
                              if (prop === 'save') {
                                  saved.push(t.filter);
                              } else if (prop === 'restore') {
                                  t.filter = saved.pop();
                              }
                              return {width: 0};
                          }
            });
        };

        beforeEach(() => {
            supportsFilter = jest.spyOn(FEATURES, 'SUPPORT_CANVAS_FILTER', 'get').mockReturnValue(true);
            layers = [];
            getContext = jest
                .spyOn(HTMLCanvasElement.prototype, 'getContext')
                .mockImplementation(function (this: HTMLCanvasElement) {
                    const calls: Call[] = [];
                    layers.push({canvas: this, calls});
                    return recordingContext(calls);
                } as unknown as typeof HTMLCanvasElement.prototype.getContext);
        });

        afterEach(() => {
            supportsFilter.mockRestore();
            getContext.mockRestore();
        });

        const createStack = (context: Context, filter: string, parent: ElementPaint | null = null) => {
            mockComputedStyle({filter, backgroundColor: 'red'});
            const container = new ElementContainer(context, document.createElement('div'));
            container.bounds = new Bounds(10, 10, 100, 100);
            return new StackingContext(new ElementPaint(container, parent));
        };

        const render = async (filter: string, scale = 1) => {
            const calls: Call[] = [];
            const canvas = {width: 800 * scale, height: 600 * scale} as {[key: string]: unknown};
            const ctx = recordingContext(calls);
            canvas.getContext = () => ctx;
            const {context, renderer} = createRenderer(canvas as unknown as HTMLCanvasElement, scale);
            await renderer.renderStack(createStack(context, filter));
            return {calls, names: calls.map(([name]) => name)};
        };

        it('paints the element into a layer and draws it once with the filter', async () => {
            const {calls} = await render('blur(2px) grayscale(1)');
            strictEqual(layers.length, 1);
            const {canvas, calls: layerCalls} = layers[0];
            strictEqual(canvas.width, 800);
            strictEqual(canvas.height, 600);
            // the background is painted unfiltered, and its clip stays inside the layer
            const fill = layerCalls.find(([name]) => name === 'fill');
            strictEqual(fill && fill[2], 'none');
            const draw = calls.filter(([name]) => name === 'drawImage');
            deepStrictEqual(draw, [['drawImage', [canvas, 0, 0], 'blur(2px) grayscale(1)']]);
            strictEqual(calls.filter(([name]) => name === 'fill').length, 0);
        });

        it('scales blur and drop-shadow lengths by the canvas scale', async () => {
            const {calls} = await render('blur(2px) drop-shadow(rgb(255, 0, 0) 10px 0px 1.5px) grayscale(0.5)', 2);
            const {canvas, calls: layerCalls} = layers[0];
            strictEqual(canvas.width, 1600);
            deepStrictEqual(
                layerCalls.find(([name]) => name === 'scale'),
                ['scale', [2, 2], 'none']
            );
            // the layer is drawn in device pixels
            const drawIndex = calls.findIndex(([name]) => name === 'drawImage');
            deepStrictEqual(
                calls.slice(0, drawIndex).filter(([name]) => name === 'setTransform'),
                [['setTransform', [1, 0, 0, 1, 0, 0], 'none']]
            );
            deepStrictEqual(calls[drawIndex], [
                'drawImage',
                [canvas, 0, 0],
                'blur(4px) drop-shadow(rgb(255, 0, 0) 20px 0px 3px) grayscale(0.5)'
            ]);
            // the main context goes back to its unfiltered state
            strictEqual(calls[drawIndex + 1][0], 'restore');
        });

        it('does not create a layer for filter: none', async () => {
            const {names} = await render('none');
            strictEqual(layers.length, 0);
            strictEqual(names.indexOf('drawImage'), -1);
            strictEqual(names.indexOf('fill') !== -1, true);
        });

        it('does not create a layer when the browser cannot filter canvas drawing', async () => {
            supportsFilter.mockReturnValue(false);
            const {calls} = await render('blur(2px)');
            strictEqual(layers.length, 0);
            deepStrictEqual(
                calls.filter(([name]) => name === 'fill').map(([, , filter]) => filter),
                ['none']
            );
        });

        it('applies a nested filter before its ancestor filter', async () => {
            const calls: Call[] = [];
            const canvas = {width: 800, height: 600, getContext: () => recordingContext(calls)};
            const {context, renderer} = createRenderer(canvas as unknown as HTMLCanvasElement);
            const parent = createStack(context, 'grayscale(1)');
            const child = createStack(context, 'blur(2px)', parent.element);
            parent.zeroOrAutoZIndexOrTransformedOrOpacity.push(child);
            await renderer.renderStack(parent);

            strictEqual(layers.length, 2);
            const [outer, inner] = layers;
            deepStrictEqual(
                outer.calls.filter(([name]) => name === 'drawImage'),
                [['drawImage', [inner.canvas, 0, 0], 'blur(2px)']]
            );
            deepStrictEqual(
                calls.filter(([name]) => name === 'drawImage'),
                [['drawImage', [outer.canvas, 0, 0], 'grayscale(1)']]
            );
        });
    });
    describe('mix-blend-mode', () => {
        type Call = [string, unknown[], unknown];
        let getContext: jest.SpyInstance;
        let layers: {canvas: HTMLCanvasElement; calls: Call[]}[];

        // records each call with the composite operation that was active, and keeps it across save()/restore()
        const recordingContext = (calls: Call[]) => {
            const saved: unknown[] = [];
            const target: {[key: string]: unknown} = {globalCompositeOperation: 'source-over', filter: 'none'};
            return new Proxy(target, {
                get: (t, prop: string) =>
                    prop in t
                        ? t[prop]
                        : (...args: unknown[]) => {
                              calls.push([prop, args, t.globalCompositeOperation]);
                              if (prop === 'save') {
                                  saved.push(t.globalCompositeOperation);
                              } else if (prop === 'restore') {
                                  t.globalCompositeOperation = saved.pop();
                              }
                              return {width: 0};
                          }
            });
        };

        beforeEach(() => {
            layers = [];
            getContext = jest
                .spyOn(HTMLCanvasElement.prototype, 'getContext')
                .mockImplementation(function (this: HTMLCanvasElement) {
                    const calls: Call[] = [];
                    layers.push({canvas: this, calls});
                    return recordingContext(calls);
                } as unknown as typeof HTMLCanvasElement.prototype.getContext);
        });

        afterEach(() => {
            getContext.mockRestore();
        });

        const render = async (mixBlendMode: string) => {
            mockComputedStyle({mixBlendMode, backgroundColor: 'red'});
            const calls: Call[] = [];
            const canvas = {width: 800, height: 600, getContext: () => recordingContext(calls)};
            const {context, renderer} = createRenderer(canvas as unknown as HTMLCanvasElement);
            const container = new ElementContainer(context, document.createElement('div'));
            container.bounds = new Bounds(10, 10, 100, 100);
            await renderer.renderStack(new StackingContext(new ElementPaint(container, null)));
            return calls;
        };

        it('paints the element into a layer and draws it once with the blend mode', async () => {
            const calls = await render('multiply');
            strictEqual(layers.length, 1);
            const {canvas, calls: layerCalls} = layers[0];
            // the element paints normally inside its layer, so its own parts do not blend with each other
            const fill = layerCalls.find(([name]) => name === 'fill');
            strictEqual(fill && fill[2], 'source-over');
            const drawIndex = calls.findIndex(([name]) => name === 'drawImage');
            deepStrictEqual(calls[drawIndex], ['drawImage', [canvas, 0, 0], 'multiply']);
            strictEqual(calls.filter(([name]) => name === 'fill').length, 0);
            // the main context goes back to normal compositing
            strictEqual(calls[drawIndex + 1][0], 'restore');
        });

        it('does not create a layer for mix-blend-mode: normal', async () => {
            const calls = await render('normal');
            strictEqual(layers.length, 0);
            deepStrictEqual(
                calls.filter(([name]) => name === 'fill').map(([, , mode]) => mode),
                ['source-over']
            );
        });

        it('does not create a layer for unsupported blend modes', async () => {
            const calls = await render('plus-darker');
            strictEqual(layers.length, 0);
            strictEqual(calls.filter(([name]) => name === 'drawImage').length, 0);
        });
    });
});
