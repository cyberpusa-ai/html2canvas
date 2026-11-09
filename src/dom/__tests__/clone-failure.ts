import {strictEqual} from 'assert';
import {getCloneFailureReason} from '../clone-failure';

describe('getCloneFailureReason', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    const append = (html: string): HTMLElement => {
        document.body.innerHTML = html;
        return document.getElementById('target') as HTMLElement;
    };

    it('returns null for an element in the document', () => {
        strictEqual(getCloneFailureReason(append('<div><p id="target"></p></div>'), {}), null);
    });

    it('reports a detached element', () => {
        strictEqual(
            getCloneFailureReason(document.createElement('div'), {}),
            'element is not attached to the document'
        );
    });

    it('reports an element in a detached subtree', () => {
        const parent = document.createElement('div');
        const child = document.createElement('span');
        parent.appendChild(child);
        strictEqual(getCloneFailureReason(child, {}), 'element is not attached to the document');
    });

    it('reports an element inside template content', () => {
        const template = document.createElement('template');
        template.innerHTML = '<div></div>';
        const element = template.content.firstChild as HTMLElement;
        strictEqual(getCloneFailureReason(element, {}), 'element is not attached to the document');
    });

    it('reports an element under data-html2canvas-ignore', () => {
        strictEqual(
            getCloneFailureReason(append('<section data-html2canvas-ignore><p id="target"></p></section>'), {}),
            'element or one of its ancestors is ignored (<section>)'
        );
    });

    it('reports an element excluded by ignoreElements', () => {
        const target = append('<article><p id="target"></p></article>');
        strictEqual(
            getCloneFailureReason(target, {ignoreElements: (el) => el.tagName === 'ARTICLE'}),
            'element or one of its ancestors is excluded by ignoreElements'
        );
    });

    it('reports an element inside a video', () => {
        strictEqual(
            getCloneFailureReason(append('<video><p id="target"></p></video>'), {}),
            'element is inside a <video>, whose children are not rendered'
        );
    });

    it('accepts an element inside an open shadow root', () => {
        const host = append('<div id="target"></div>');
        host.attachShadow({mode: 'open'}).innerHTML = '<p></p>';
        const inner = (host.shadowRoot as ShadowRoot).firstChild as HTMLElement;
        strictEqual(getCloneFailureReason(inner, {}), null);
    });

    it('reports an element inside a closed shadow root', () => {
        const host = append('<div id="target"></div>');
        const root = host.attachShadow({mode: 'closed'});
        root.innerHTML = '<p></p>';
        strictEqual(
            getCloneFailureReason(root.firstChild as HTMLElement, {}),
            'element is inside a closed shadow root'
        );
    });

    it('reports a light DOM child of a shadow host that is not slotted', () => {
        const host = append('<div><span id="target"></span></div>').parentElement as HTMLElement;
        host.attachShadow({mode: 'open'}).innerHTML = '<p></p>';
        strictEqual(
            getCloneFailureReason(document.getElementById('target') as HTMLElement, {}),
            'element is a child of a shadow host but is not assigned to a slot'
        );
    });

    it('follows slotted elements through their slot', () => {
        const host = append('<div><span id="target"></span></div>').parentElement as HTMLElement;
        host.attachShadow({mode: 'open'}).innerHTML = '<div data-html2canvas-ignore><slot></slot></div>';
        strictEqual(
            getCloneFailureReason(document.getElementById('target') as HTMLElement, {}),
            'element or one of its ancestors is ignored (<div>)'
        );
    });

    it('reports a non-HTML element', () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(svg);
        strictEqual(getCloneFailureReason(svg as unknown as HTMLElement, {}), 'svg is not an HTML element');
    });
});
