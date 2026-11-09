import {IPropertyListDescriptor, PropertyDescriptorParsingType} from '../IPropertyDescriptor';
import {CSSValue, isIdentToken, nonWhiteSpace} from '../syntax/parser';
import {TokenType} from '../syntax/tokenizer';
import {Context} from '../../core/context';

const FILTER_FUNCTIONS = [
    'blur',
    'brightness',
    'contrast',
    'drop-shadow',
    'grayscale',
    'hue-rotate',
    'invert',
    'opacity',
    'saturate',
    'sepia'
];

// The computed filter string is handed to ctx.filter as is, which takes the same syntax.
// This only checks that every function in the list can be drawn by the canvas renderer.
export const filter: IPropertyListDescriptor<boolean> = {
    name: 'filter',
    initialValue: 'none',
    prefix: true,
    type: PropertyDescriptorParsingType.LIST,
    parse: (context: Context, tokens: CSSValue[]): boolean => {
        const values = tokens.filter(nonWhiteSpace);
        if (values.length === 0 || (values.length === 1 && isIdentToken(values[0]) && values[0].value === 'none')) {
            return false;
        }

        const supported = values.every(
            (value) => value.type === TokenType.FUNCTION && FILTER_FUNCTIONS.indexOf(value.name) !== -1
        );
        if (!supported) {
            // url() references resolve against the cloned document, which the canvas cannot see
            context.logger.debug(`Unsupported filter, rendering without it`);
        }
        return supported;
    }
};
