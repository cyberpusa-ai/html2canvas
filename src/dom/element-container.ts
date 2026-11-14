import {CSSParsedDeclaration} from '../css/index';
import {TextContainer} from './text-container';
import {Bounds, parseBounds, parseLineBounds} from '../css/layout/bounds';
import {isHTMLElementNode} from './node-parser';
import {Context} from '../core/context';
import {DebuggerType, isDebugging} from '../core/debugger';
import {DISPLAY} from '../css/property-descriptors/display';

export const enum FLAGS {
    CREATES_STACKING_CONTEXT = 1 << 1,
    CREATES_REAL_STACKING_CONTEXT = 1 << 2,
    IS_LIST_OWNER = 1 << 3,
    DEBUG_RENDER = 1 << 4
}

export class ElementContainer {
    readonly styles: CSSParsedDeclaration;
    readonly textNodes: TextContainer[] = [];
    readonly elements: ElementContainer[] = [];
    bounds: Bounds;
    // line box fragments of an inline element that wraps across lines; empty when it fits on one line
    lineBounds: Bounds[] = [];
    flags = 0;

    constructor(protected readonly context: Context, element: Element) {
        if (isDebugging(element, DebuggerType.PARSE)) {
            debugger;
        }

        this.styles = new CSSParsedDeclaration(context, window.getComputedStyle(element, null));

        if (isHTMLElementNode(element)) {
            if (this.styles.animationDuration.some((duration) => duration > 0)) {
                element.style.animationDuration = '0s';
            }

            if (this.styles.transform !== null) {
                // getBoundingClientRect takes transforms into account
                element.style.transform = 'none';
            }
        }

        this.bounds = parseBounds(this.context, element);

        if (this.styles.display === DISPLAY.INLINE) {
            const lineBounds = parseLineBounds(this.context, element);
            if (lineBounds.length > 1) {
                this.lineBounds = lineBounds;
            }
        }

        if (isDebugging(element, DebuggerType.RENDER)) {
            this.flags |= FLAGS.DEBUG_RENDER;
        }
    }
}
