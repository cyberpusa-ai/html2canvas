import {strictEqual} from 'assert';
import {DocumentCloner} from '../document-cloner';
import {Context} from '../../core/context';
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
});
