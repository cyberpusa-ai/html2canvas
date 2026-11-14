import {strictEqual} from 'assert';
import {FontMetrics} from '../font-metrics';

describe('FontMetrics', () => {
    let offsetTop: jest.SpyInstance;
    const probes: HTMLElement[] = [];

    beforeEach(() => {
        probes.length = 0;
        offsetTop = jest
            .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
            .mockImplementation(function (this: HTMLElement) {
                probes.push(this);
                // the 1px image is laid out with its bottom edge on the baseline, 10px below the span top
                return this.tagName === 'IMG' ? 9 : 0;
            });
    });

    afterEach(() => offsetTop.mockRestore());

    it('measures the baseline at the bottom edge of the 1px probe image', () => {
        strictEqual(new FontMetrics(document).getMetrics('Arial', '16px').baseline, 10);
    });

    it('isolates the probe elements from page css', () => {
        new FontMetrics(document).getMetrics('Arial', '16px');
        const img = probes.filter((e) => e.tagName === 'IMG')[0];
        const span = probes.filter((e) => e.tagName === 'SPAN')[0];
        strictEqual(img.style.display, 'inline');
        strictEqual(img.style.height, '1px');
        strictEqual(img.style.border, '0px');
        strictEqual(span.style.display, 'inline');
        strictEqual(span.style.border, '0px');
        strictEqual(span.style.verticalAlign, 'baseline');
        strictEqual(span.style.lineHeight, 'normal');
        strictEqual(span.style.position, 'static');
        strictEqual(span.style.float, 'none');
        strictEqual(img.style.position, 'static');
        strictEqual(img.style.float, 'none');
    });

    it('isolates the measuring container from page css', () => {
        new FontMetrics(document).getMetrics('Arial', '16px');
        const container = probes.filter((e) => e.tagName === 'IMG')[0].parentElement as HTMLElement;
        strictEqual(container.style.display, 'block');
        strictEqual(container.style.position, 'absolute');
        strictEqual(container.style.float, 'none');
        strictEqual(container.style.height, 'auto');
        strictEqual(container.style.border, '0px');
        strictEqual(container.style.lineHeight, 'normal');
    });

    it('measures the middle relative to the positioned container', () => {
        // the image is offset 9px within its container (its offsetParent)
        strictEqual(new FontMetrics(document).getMetrics('Arial', '16px').middle, 11);
    });

    it('measures with the font style applied to the probe elements', () => {
        new FontMetrics(document).getMetrics('Arial', '16px', 'italic');
        const span = probes.filter((e) => e.tagName === 'SPAN')[0];
        strictEqual(span.style.fontStyle, 'italic');
        const container = probes.filter((e) => e.tagName === 'IMG')[0].parentElement as HTMLElement;
        strictEqual(container.style.fontStyle, 'italic');
    });

    it('caches metrics separately per font style', () => {
        const metrics = new FontMetrics(document);
        const normal = metrics.getMetrics('Arial', '16px', 'normal');
        const italic = metrics.getMetrics('Arial', '16px', 'italic');
        strictEqual(normal === italic, false);
        strictEqual(metrics.getMetrics('Arial', '16px', 'italic'), italic);
    });
});
