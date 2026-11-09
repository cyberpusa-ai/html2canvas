export const IGNORE_ATTRIBUTE = 'data-html2canvas-ignore';

const ELEMENT_NODE = 1;
const DOCUMENT_FRAGMENT_NODE = 11;

interface IgnoreOptions {
    ignoreElements?: (element: Element) => boolean;
}

const isShadowRoot = (node: Node): node is ShadowRoot =>
    node.nodeType === DOCUMENT_FRAGMENT_NODE && !!(node as ShadowRoot).host;

// Explains why DocumentCloner could not map the element into the cloned document, mirroring the rules it clones by
export const getCloneFailureReason = (element: Element, options: IgnoreOptions): string | null => {
    if (typeof (element as HTMLElement).style === 'undefined' || typeof element.className === 'object') {
        return `${element.nodeName} is not an HTML element`;
    }

    const ownerDocument = element.ownerDocument;
    const documentElement = ownerDocument ? ownerDocument.documentElement : null;
    let node: Node = element;

    while (node !== documentElement) {
        if (node.nodeType === ELEMENT_NODE) {
            const el = node as Element;
            if (el.tagName === 'SCRIPT' || el.hasAttribute(IGNORE_ATTRIBUTE)) {
                return `element or one of its ancestors is ignored (<${el.nodeName.toLowerCase()}>)`;
            }
            if (typeof options.ignoreElements === 'function' && options.ignoreElements(el)) {
                return `element or one of its ancestors is excluded by ignoreElements`;
            }
            if (node !== element && el.tagName === 'VIDEO') {
                return 'element is inside a <video>, whose children are not rendered';
            }
        }

        const parent: Node | null = node.parentNode;
        if (!parent) {
            return 'element is not attached to the document';
        }

        if (isShadowRoot(parent)) {
            if (parent.mode === 'closed') {
                return 'element is inside a closed shadow root';
            }
            node = parent.host;
            continue;
        }

        if (parent.nodeType === ELEMENT_NODE && (parent as Element).shadowRoot) {
            const slot = (node as Element).assignedSlot;
            if (!slot) {
                return 'element is a child of a shadow host but is not assigned to a slot';
            }
            node = slot;
            continue;
        }

        node = parent;
    }

    return null;
};
