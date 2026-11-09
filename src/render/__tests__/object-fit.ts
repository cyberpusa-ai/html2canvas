import {deepStrictEqual} from 'assert';
import {calculateObjectFitBounds} from '../object-fit';
import {OBJECT_FIT} from '../../css/property-descriptors/object-fit';
import {Bounds} from '../../css/layout/bounds';

// a 200x100 source drawn into the given box
const fit = (objectFit: OBJECT_FIT, width: number, height: number) =>
    calculateObjectFitBounds(objectFit, 200, 100, width, height);

describe('calculateObjectFitBounds', () => {
    it('fill stretches the whole source over the box', () =>
        deepStrictEqual(fit(OBJECT_FIT.FILL, 50, 400), {
            src: new Bounds(0, 0, 200, 100),
            dest: new Bounds(0, 0, 50, 400)
        }));

    it('contain letterboxes a wide source in a tall box', () =>
        deepStrictEqual(fit(OBJECT_FIT.CONTAIN, 100, 100), {
            src: new Bounds(0, 0, 200, 100),
            dest: new Bounds(0, 25, 100, 50)
        }));

    it('contain pillarboxes a wide source in a wider box', () =>
        deepStrictEqual(fit(OBJECT_FIT.CONTAIN, 400, 100), {
            src: new Bounds(0, 0, 200, 100),
            dest: new Bounds(100, 0, 200, 100)
        }));

    it('cover crops the centre of the source to the box ratio', () =>
        deepStrictEqual(fit(OBJECT_FIT.COVER, 100, 100), {
            src: new Bounds(50, 0, 100, 100),
            dest: new Bounds(0, 0, 100, 100)
        }));

    it('cover crops top and bottom when the box is wider than the source', () =>
        deepStrictEqual(fit(OBJECT_FIT.COVER, 400, 100), {
            src: new Bounds(0, 25, 200, 50),
            dest: new Bounds(0, 0, 400, 100)
        }));

    it('none centres the source at its natural size, cropping axes that overflow', () =>
        deepStrictEqual(fit(OBJECT_FIT.NONE, 100, 300), {
            src: new Bounds(50, 0, 100, 100),
            dest: new Bounds(0, 100, 100, 100)
        }));

    it('scale-down behaves as none when the source fits', () =>
        deepStrictEqual(fit(OBJECT_FIT.SCALE_DOWN, 400, 300), {
            src: new Bounds(0, 0, 200, 100),
            dest: new Bounds(100, 100, 200, 100)
        }));

    it('scale-down behaves as contain when the source is larger', () =>
        deepStrictEqual(fit(OBJECT_FIT.SCALE_DOWN, 100, 100), fit(OBJECT_FIT.CONTAIN, 100, 100)));

    it('falls back to fill for zero sizes instead of producing NaN', () => {
        deepStrictEqual(fit(OBJECT_FIT.COVER, 0, 100), {
            src: new Bounds(0, 0, 200, 100),
            dest: new Bounds(0, 0, 0, 100)
        });
        deepStrictEqual(calculateObjectFitBounds(OBJECT_FIT.CONTAIN, 0, 0, 100, 100), {
            src: new Bounds(0, 0, 0, 0),
            dest: new Bounds(0, 0, 100, 100)
        });
    });
});
