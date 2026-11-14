import {Context} from '../core/context';

const XLINK_NS = 'http://www.w3.org/1999/xlink';
const SVG_NS = 'http://www.w3.org/2000/svg';
const DATA_URL = /^data:/i;

const getHref = (image: Element): {value: string; xlink: boolean} | null => {
    const href = image.getAttribute('href');
    if (href) {
        return {value: href, xlink: false};
    }
    const xlinkHref = image.getAttributeNS(XLINK_NS, 'href');
    return xlinkHref ? {value: xlinkHref, xlink: true} : null;
};

const toDataURL = (img: HTMLImageElement): string | null => {
    if (DATA_URL.test(img.src)) {
        // proxied images are already data urls
        return img.src;
    }
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
        return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }
    ctx.drawImage(img, 0, 0, width, height);
    // throws a SecurityError if the image tainted the canvas
    return canvas.toDataURL();
};

const inlineSVGImage = async (context: Context, image: Element): Promise<void> => {
    const href = getHref(image);
    if (!href || DATA_URL.test(href.value)) {
        return;
    }
    const key = href.value.substring(0, 256);
    try {
        await context.cache.addImage(href.value);
        const img = await context.cache.match(href.value);
        const dataURL = img ? toDataURL(img) : null;
        if (!dataURL) {
            context.logger.debug(`Unable to inline svg image ${key}`);
            return;
        }
        if (href.xlink) {
            image.setAttributeNS(XLINK_NS, 'xlink:href', dataURL);
        } else {
            image.setAttribute('href', dataURL);
        }
    } catch (e) {
        context.logger.debug(`Unable to inline svg image ${key}: ${e}`);
    }
};

// Inline svg elements are drawn as data url images, which can't load external resources,
// so replace the href of their <image> children with data urls
export const inlineSVGImages = (context: Context, element: Element): Promise<void> => {
    if (typeof element.getElementsByTagNameNS !== 'function') {
        return Promise.resolve();
    }
    const images: Element[] = [].slice.call(element.getElementsByTagNameNS(SVG_NS, 'image'), 0);
    return Promise.all(images.map((image) => inlineSVGImage(context, image))).then(() => undefined);
};
