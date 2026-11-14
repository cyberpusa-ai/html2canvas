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

        span.style.display = 'inline';
        span.style.fontFamily = fontFamily;
        span.style.fontSize = fontSize;
        span.style.fontStyle = fontStyle;
        span.style.border = '0';
        span.style.margin = '0';
        span.style.padding = '0';
        span.style.verticalAlign = 'baseline';

        span.appendChild(this._document.createTextNode(SAMPLE_TEXT));
        container.appendChild(span);
        container.appendChild(img);
        // the bottom edge of the 1px image sits on the baseline
        const baseline = img.offsetTop - span.offsetTop + 1;

        container.removeChild(span);
        container.appendChild(this._document.createTextNode(SAMPLE_TEXT));

        container.style.lineHeight = 'normal';
        img.style.verticalAlign = 'super';

        const middle = img.offsetTop - container.offsetTop + 2;

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
