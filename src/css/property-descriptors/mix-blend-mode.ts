import {IPropertyIdentValueDescriptor, PropertyDescriptorParsingType} from '../IPropertyDescriptor';
import {Context} from '../../core/context';

// The CSS blend modes that globalCompositeOperation accepts under the same name
const BLEND_MODES = [
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity'
];

export const mixBlendMode: IPropertyIdentValueDescriptor<string> = {
    name: 'mix-blend-mode',
    initialValue: 'normal',
    prefix: false,
    type: PropertyDescriptorParsingType.IDENT_VALUE,
    parse: (context: Context, mode: string): string => {
        if (mode === 'normal' || BLEND_MODES.indexOf(mode) !== -1) {
            return mode;
        }

        context.logger.debug(`Unsupported mix-blend-mode "${mode}", rendering without it`);
        return 'normal';
    }
};
