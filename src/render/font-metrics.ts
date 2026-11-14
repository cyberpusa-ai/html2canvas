import {SMALL_IMAGE} from '../core/util';
export interface FontMetric {
    baseline: number;
    middle: number;
}

const SAMPLE_TEXT = 'Hidden Text';

export class FontMetrics {
    private readonly _data: {[key: string]: FontMetric};
    private readonly _document: Document;

    constructor(document: Document) {
        this._data = {};
        this._document = document;
    }

    private parseMetrics(fontFamily: string, fontSize: string, fontStyle: string): FontMetric {
        const container = this._document.createElement('div');
        const img = this._document.createElement('img');
        const span = this._document.createElement('span');

        const body = this._document.body as HTMLBodyElement;

        container.style.visibility = 'hidden';
        container.style.fontFamily = fontFamily;
        container.style.fontSize = fontSize;
        container.style.fontStyle = fontStyle;
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.whiteSpace = 'nowrap';
        // page css (e.g. body {display: flex} or div {float: left}) must not change the measuring context
        container.style.display = 'block';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.float = 'none';
        container.style.width = 'auto';
        container.style.height = 'auto';
        container.style.border = '0';
        container.style.lineHeight = 'normal';
        container.style.verticalAlign = 'baseline';

        body.appendChild(container);

        img.src = SMALL_IMAGE;
        img.width = 1;
        img.height = 1;

        // page css (e.g. img {display: block} from css resets) must not move the probe elements
        img.style.display = 'inline';
        img.style.width = '1px';
        img.style.height = '1px';
        img.style.border = '0';
        img.style.margin = '0';
        img.style.padding = '0';
        img.style.verticalAlign = 'baseline';
        img.style.position = 'static';
        img.style.float = 'none';

        span.style.display = 'inline';
        span.style.fontFamily = fontFamily;
        span.style.fontSize = fontSize;
        span.style.fontStyle = fontStyle;
        span.style.border = '0';
        span.style.margin = '0';
        span.style.padding = '0';
        span.style.verticalAlign = 'baseline';
        span.style.position = 'static';
        span.style.float = 'none';
        span.style.height = 'auto';
        span.style.lineHeight = 'normal';

        span.appendChild(this._document.createTextNode(SAMPLE_TEXT));
        container.appendChild(span);
        container.appendChild(img);
        // the bottom edge of the 1px image sits on the baseline
        const baseline = img.offsetTop - span.offsetTop + 1;

        container.removeChild(span);
        container.appendChild(this._document.createTextNode(SAMPLE_TEXT));

        container.style.lineHeight = 'normal';
        img.style.verticalAlign = 'super';

        // the container is positioned, so it is the offsetParent of the image
        const middle = img.offsetTop + 2;

        body.removeChild(container);

        return {baseline, middle};
    }
    getMetrics(fontFamily: string, fontSize: string, fontStyle = 'normal'): FontMetric {
        const key = `${fontStyle} ${fontFamily} ${fontSize}`;
        if (typeof this._data[key] === 'undefined') {
            this._data[key] = this.parseMetrics(fontFamily, fontSize, fontStyle);
        }

        return this._data[key];
    }
}
