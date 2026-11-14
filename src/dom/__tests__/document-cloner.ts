import {strictEqual} from 'assert';
import {CloneOptions, copyCSSStyles, DocumentCloner} from '../document-cloner';
import {Context} from '../../core/context';
import {Cache} from '../../core/cache-storage';
import {Bounds} from '../../css/layout/bounds';

type MockFontFaceSet = {status: string; ready: Promise<unknown>};

// jsdom has no FontFaceSet, so attach one to the cloned iframe document as soon as the iframe is inserted
const mockFonts = (fonts: MockFontFaceSet) => {
    const appendChild = document.body.appendChild;
    jest.spyOn(document.body, 'appendChild').mockImplementation(function <T extends Node>(this: HTMLElement, node: T) {
        const result = appendChild.call(this, node) as T;
        const cloneWindow = (node as unknown as HTMLIFrameElement).contentWindow;
        if (cloneWindow) {
            Object.defineProperty(cloneWindow.document, 'fonts', {configurable: true, value: fonts});
        }
        return result;
    });
};

const cloneDocument = (imageTimeout: number, onclone?: () => void) => {
    const windowBounds = new Bounds(0, 0, 800, 600);
    const context = new Context({logging: false, imageTimeout, useCORS: false, allowTaint: false}, windowBounds);
    const cloner = new DocumentCloner(context, document.body, {
        inlineImages: false,
        copyStyles: false,
        imageTimeout,
        onclone
    });
    return {context, iframe: cloner.toIFrame(document, windowBounds)};
};

describe('DocumentCloner', () => {
    beforeEach(() => {
        // jsdom logs "Not implemented" for getComputedStyle with pseudo elements and scrollTo
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.querySelectorAll('iframe').forEach((iframe) => DocumentCloner.destroy(iframe));
    });

    describe('video snapshots', () => {
        const snapshotVideo = (objectFit: string) => {
            const video = document.createElement('video');
            video.style.objectFit = objectFit;
            Object.defineProperties(video, {
                offsetWidth: {value: 100},
                offsetHeight: {value: 100},
                videoWidth: {value: 200},
                videoHeight: {value: 100}
            });
            const drawImage = jest.fn();
            jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
                drawImage,
                getImageData: jest.fn()
            } as unknown as CanvasRenderingContext2D);
            const context = new Context(
                {logging: false, imageTimeout: 0, useCORS: false, allowTaint: false},
                new Bounds(0, 0, 800, 600)
            );
            const cloner = new DocumentCloner(context, document.body, {
                inlineImages: false,
                copyStyles: false,
                imageTimeout: 0
            });
            const canvas = cloner.createVideoClone(video);
            strictEqual(canvas.width, 100);
            strictEqual(canvas.height, 100);
            strictEqual(drawImage.mock.calls.length, 1);
            return drawImage.mock.calls[0].slice(1).join(', ');
        };

        it('applies the object-fit of the video to the snapshot', () => {
            strictEqual(snapshotVideo('contain'), '0, 0, 200, 100, 0, 25, 100, 50');
            strictEqual(snapshotVideo('cover'), '50, 0, 100, 100, 0, 0, 100, 100');
        });

        it('stretches the video with object-fit: fill', () =>
            strictEqual(snapshotVideo('fill'), '0, 0, 200, 100, 0, 0, 100, 100'));
    });

    it('does not wait for fonts.ready when fonts are already loaded', async () => {
        // iOS 13+ can report status "loaded" while fonts.ready stays pending forever (#2191)
        mockFonts({status: 'loaded', ready: new Promise(() => undefined)});
        const {iframe} = cloneDocument(0);
        strictEqual((await iframe).className, 'html2canvas-container');
    });

    it('stops waiting for fonts.ready after imageTimeout', async () => {
        mockFonts({status: 'loading', ready: new Promise(() => undefined)});
        const onclone = jest.fn();
        const {context, iframe} = cloneDocument(100, onclone);
        const warn = jest.spyOn(context.logger, 'warn');
        strictEqual((await iframe).className, 'html2canvas-container');
        strictEqual(warn.mock.calls.length, 1);
        strictEqual(onclone.mock.calls.length, 1);
    });

    it('waits for fonts.ready while fonts are loading', async () => {
        let resolveFonts: () => void = () => undefined;
        const ready = new Promise<void>((resolve) => (resolveFonts = resolve));
        const fonts = {status: 'loading', ready};
        mockFonts(fonts);
        const {context, iframe} = cloneDocument(10000);
        const warn = jest.spyOn(context.logger, 'warn');
        let done = false;
        const result = iframe.then((value) => {
            done = true;
            return value;
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        strictEqual(done, false);
        fonts.status = 'loaded';
        resolveFonts();
        await result;
        strictEqual(warn.mock.calls.length, 0);
    });

    it('inlines svg <image> hrefs in the clone after onclone, without touching the document (#2054)', async () => {
        document.body.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://example.com/a.png"></image></svg>';
        const windowBounds = new Bounds(0, 0, 800, 600);
        const cache = {
            addImage: jest.fn(() => Promise.resolve()),
            match: jest.fn(() => Promise.resolve({src: 'data:image/png;base64,AAAA'}))
        } as unknown as Cache;
        const context = new Context(
            {logging: false, imageTimeout: 0, useCORS: false, allowTaint: false, cache},
            windowBounds
        );
        const onclone = jest.fn((doc: Document) => {
            strictEqual(doc.getElementsByTagName('image')[0].getAttribute('href'), 'http://example.com/a.png');
        });
        const cloner = new DocumentCloner(context, document.body, {inlineImages: false, copyStyles: false, onclone});
        const iframe = await cloner.toIFrame(document, windowBounds);
        const clonedImage = (iframe.contentWindow as Window).document.getElementsByTagName('image')[0];
        strictEqual(onclone.mock.calls.length, 1);
        strictEqual(clonedImage.getAttribute('href'), 'data:image/png;base64,AAAA');
        strictEqual(document.getElementsByTagName('image')[0].getAttribute('href'), 'http://example.com/a.png');
        document.body.innerHTML = '';
    });

    it('waits for a promise returned by onclone before resolving (#3162)', async () => {
        document.body.innerHTML = '<div id="target"></div>';
        let resolveOnclone: () => void = () => undefined;
        const pending = new Promise<void>((resolve) => (resolveOnclone = resolve));
        let done = false;
        // the declared return type must accept a promise, so linters don't flag async callbacks
        const onclone: CloneOptions['onclone'] = (doc): ReturnType<NonNullable<CloneOptions['onclone']>> =>
            pending.then(() => {
                (doc.getElementById('target') as HTMLElement).setAttribute('data-onclone', 'done');
            });
        const windowBounds = new Bounds(0, 0, 800, 600);
        const context = new Context({logging: false, imageTimeout: 0, useCORS: false, allowTaint: false}, windowBounds);
        const cloner = new DocumentCloner(context, document.body, {inlineImages: false, copyStyles: false, onclone});
        const result = cloner.toIFrame(document, windowBounds).then((iframe) => {
            done = true;
            return iframe;
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        strictEqual(done, false);
        resolveOnclone();
        const iframe = await result;
        const target = (iframe.contentWindow as Window).document.getElementById('target') as HTMLElement;
        strictEqual(target.getAttribute('data-onclone'), 'done');
        strictEqual(document.getElementById('target')?.hasAttribute('data-onclone'), false);
        document.body.innerHTML = '';
    });

    describe('clonedReferenceElement', () => {
        const findClone = (element: HTMLElement) => {
            const context = new Context(
                {logging: false, imageTimeout: 0, useCORS: false, allowTaint: false},
                new Bounds(0, 0, 800, 600)
            );
            return new DocumentCloner(context, element, {inlineImages: false, copyStyles: false})
                .clonedReferenceElement;
        };

        const createShadowHost = (html: string) => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            host.attachShadow({mode: 'open'}).innerHTML = html;
            return host;
        };

        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('finds an element inside an open shadow root', () => {
            const host = createShadowHost('<p id="target"></p>');
            const target = (host.shadowRoot as ShadowRoot).getElementById('target') as HTMLElement;
            strictEqual(findClone(target)?.id, 'target');
        });

        it('finds slot fallback content when nothing is assigned (#2929)', () => {
            const host = createShadowHost('<slot><span id="fallback"></span></slot>');
            const fallback = (host.shadowRoot as ShadowRoot).getElementById('fallback') as HTMLElement;
            strictEqual(findClone(fallback)?.id, 'fallback');
        });

        it('finds content assigned through nested slots', () => {
            const inner = document.createElement('inner-el');
            inner.attachShadow({mode: 'open'}).innerHTML = '<slot></slot>';
            inner.innerHTML = '<slot></slot>';
            const outer = createShadowHost('');
            (outer.shadowRoot as ShadowRoot).appendChild(inner);
            const target = document.createElement('b');
            outer.appendChild(target);
            strictEqual(findClone(target)?.tagName, 'B');
        });

        it('finds children of a slot outside a shadow tree', () => {
            document.body.innerHTML = '<slot><i id="target"></i></slot>';
            strictEqual(findClone(document.getElementById('target') as HTMLElement)?.id, 'target');
        });

        it('does not find a detached element', () => {
            strictEqual(findClone(document.createElement('div')), undefined);
        });
    });
    describe('copyCSSStyles', () => {
        const computedStyle = (values: {[property: string]: string}): CSSStyleDeclaration => {
            const properties = Object.keys(values);
            return {
                length: properties.length,
                item: (i: number) => properties[i],
                getPropertyValue: (property: string) => values[property] || ''
            } as unknown as CSSStyleDeclaration;
        };

        it('copies regular properties but skips custom properties (#3249)', () => {
            const target = document.createElement('div');
            const setProperty = jest.spyOn(target.style, 'setProperty');
            copyCSSStyles(
                computedStyle({
                    color: 'rgb(255, 0, 0)',
                    '--tw-ring-color': 'blue',
                    'padding-top': '2px',
                    '--x': '1px',
                    content: '"x"'
                }),
                target
            );
            strictEqual(target.style.getPropertyValue('color'), 'rgb(255, 0, 0)');
            strictEqual(target.style.getPropertyValue('padding-top'), '2px');
            strictEqual(
                setProperty.mock.calls.some(([property]) => property.indexOf('--') === 0 || property === 'content'),
                false
            );
            strictEqual(setProperty.mock.calls.length, 2);
        });
    });
});
