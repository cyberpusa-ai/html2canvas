import {strictEqual} from 'assert';
import {inlineSVGImages} from '../svg-images';
import {Context} from '../../core/context';
import {Cache} from '../../core/cache-storage';
import {Bounds} from '../../css/layout/bounds';

const XLINK_NS = 'http://www.w3.org/1999/xlink';
const PROXIED = 'data:image/png;base64,cHJveGllZA==';

const createContext = (match: (src: string) => Promise<unknown>) => {
    const cache = {
        addImage: jest.fn(() => Promise.resolve()),
        match: jest.fn(match)
    } as unknown as Cache;
    return new Context(
        {logging: false, imageTimeout: 0, useCORS: false, allowTaint: false, cache},
        new Bounds(0, 0, 800, 600)
    );
};

const createSVG = (images: string): HTMLDivElement => {
    const container = document.createElement('div');
    container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="${XLINK_NS}">${images}</svg>`;
    return container;
};

describe('inlineSVGImages', () => {
    afterEach(() => jest.restoreAllMocks());

    it('replaces href and xlink:href with data urls', async () => {
        const context = createContext(() => Promise.resolve({src: PROXIED}));
        const container = createSVG(
            '<image href="http://example.com/a.png"></image><image xlink:href="http://example.com/b.png"></image>'
        );
        await inlineSVGImages(context, container);
        const images = container.getElementsByTagName('image');
        strictEqual(images[0].getAttribute('href'), PROXIED);
        strictEqual(images[1].getAttributeNS(XLINK_NS, 'href'), PROXIED);
        strictEqual(images[1].hasAttribute('href'), false);
        strictEqual((context.cache.addImage as jest.Mock).mock.calls.length, 2);
    });

    it('draws loaded images to a canvas to create the data url', async () => {
        const drawImage = jest.fn();
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage
        } as unknown as CanvasRenderingContext2D);
        jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,Y2FudmFz');
        const context = createContext(() =>
            Promise.resolve({src: 'http://example.com/a.png', naturalWidth: 20, naturalHeight: 10})
        );
        const container = createSVG('<image href="http://example.com/a.png"></image>');
        await inlineSVGImages(context, container);
        strictEqual(container.getElementsByTagName('image')[0].getAttribute('href'), 'data:image/png;base64,Y2FudmFz');
        strictEqual(drawImage.mock.calls[0].slice(1).join(', '), '0, 0, 20, 10');
    });

    it('leaves data urls alone', async () => {
        const context = createContext(() => Promise.resolve({src: PROXIED}));
        const container = createSVG('<image href="data:image/png;base64,AAAA"></image>');
        await inlineSVGImages(context, container);
        strictEqual(container.getElementsByTagName('image')[0].getAttribute('href'), 'data:image/png;base64,AAAA');
        strictEqual((context.cache.addImage as jest.Mock).mock.calls.length, 0);
    });

    it('keeps the original href when the image cannot be loaded or read', async () => {
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage: jest.fn()
        } as unknown as CanvasRenderingContext2D);
        jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
            throw new Error('SecurityError: tainted canvas');
        });
        const context = createContext((src) =>
            src.indexOf('reject') !== -1
                ? Promise.reject('Timed out')
                : src.indexOf('taint') !== -1
                ? Promise.resolve({src, naturalWidth: 1, naturalHeight: 1})
                : Promise.resolve(undefined)
        );
        const container = createSVG(
            '<image href="http://example.com/reject.png"></image>' +
                '<image href="http://example.com/taint.png"></image>' +
                '<image href="http://example.com/blocked.png"></image>'
        );
        await inlineSVGImages(context, container);
        const images = container.getElementsByTagName('image');
        strictEqual(images[0].getAttribute('href'), 'http://example.com/reject.png');
        strictEqual(images[1].getAttribute('href'), 'http://example.com/taint.png');
        strictEqual(images[2].getAttribute('href'), 'http://example.com/blocked.png');
    });
});
