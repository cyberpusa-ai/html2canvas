import {strictEqual} from 'assert';
import {objectFit, OBJECT_FIT} from '../object-fit';
import {Context} from '../../../core/context';

const objectFitParse = (value: string) => objectFit.parse({} as Context, value);

describe('property-descriptors', () => {
    describe('object-fit', () => {
        it('fill', () => strictEqual(objectFitParse('fill'), OBJECT_FIT.FILL));
        it('contain', () => strictEqual(objectFitParse('contain'), OBJECT_FIT.CONTAIN));
        it('cover', () => strictEqual(objectFitParse('cover'), OBJECT_FIT.COVER));
        it('none', () => strictEqual(objectFitParse('none'), OBJECT_FIT.NONE));
        it('scale-down', () => strictEqual(objectFitParse('scale-down'), OBJECT_FIT.SCALE_DOWN));
        it('unknown values fall back to fill', () => strictEqual(objectFitParse('inherit'), OBJECT_FIT.FILL));
    });
});
