export class DocumentCloner {
    static findsReferenceElement = true;
    clonedReferenceElement?: HTMLElement;

    constructor() {
        if (!DocumentCloner.findsReferenceElement) {
            return;
        }
        this.clonedReferenceElement = {
            ownerDocument: {
                defaultView: {
                    pageXOffset: 12,
                    pageYOffset: 34
                }
            }
        } as HTMLElement;
    }

    toIFrame(): Promise<HTMLIFrameElement> {
        return Promise.resolve({} as HTMLIFrameElement);
    }

    static destroy(): boolean {
        return true;
    }
}
