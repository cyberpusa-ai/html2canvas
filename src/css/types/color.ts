import {CSSValue, isIdentWithValue, nonFunctionArgSeparator, Parser} from '../syntax/parser';
import {TokenType} from '../syntax/tokenizer';
import {ITypeDescriptor} from '../ITypeDescriptor';
import {angle, deg, isAngle} from './angle';
import {getAbsoluteValue, isLengthPercentage} from './length-percentage';
import {Context} from '../../core/context';
export type Color = number;

export const color: ITypeDescriptor<Color> = {
    name: 'color',
    parse: (context: Context, value: CSSValue): Color => {
        if (value.type === TokenType.FUNCTION) {
            const colorFunction = SUPPORTED_COLOR_FUNCTIONS[value.name];
            if (typeof colorFunction === 'undefined') {
                context.logger.warn(`Attempting to parse an unsupported color function "${value.name}"`);
                return COLORS.TRANSPARENT;
            }
            return colorFunction(context, value.values);
        }

        if (value.type === TokenType.HASH_TOKEN) {
            if (value.value.length === 3) {
                const r = value.value.substring(0, 1);
                const g = value.value.substring(1, 2);
                const b = value.value.substring(2, 3);
                return pack(parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), 1);
            }

            if (value.value.length === 4) {
                const r = value.value.substring(0, 1);
                const g = value.value.substring(1, 2);
                const b = value.value.substring(2, 3);
                const a = value.value.substring(3, 4);
                return pack(parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), parseInt(a + a, 16) / 255);
            }

            if (value.value.length === 6) {
                const r = value.value.substring(0, 2);
                const g = value.value.substring(2, 4);
                const b = value.value.substring(4, 6);
                return pack(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), 1);
            }

            if (value.value.length === 8) {
                const r = value.value.substring(0, 2);
                const g = value.value.substring(2, 4);
                const b = value.value.substring(4, 6);
                const a = value.value.substring(6, 8);
                return pack(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16) / 255);
            }
        }

        if (value.type === TokenType.IDENT_TOKEN) {
            const namedColor = COLORS[value.value.toUpperCase()];
            if (typeof namedColor !== 'undefined') {
                return namedColor;
            }
        }

        return COLORS.TRANSPARENT;
    }
};

export const isTransparent = (color: Color): boolean => (0xff & color) === 0;

export const asString = (color: Color): string => {
    const alpha = 0xff & color;
    const blue = 0xff & (color >> 8);
    const green = 0xff & (color >> 16);
    const red = 0xff & (color >> 24);
    return alpha < 255 ? `rgba(${red},${green},${blue},${alpha / 255})` : `rgb(${red},${green},${blue})`;
};

export const pack = (r: number, g: number, b: number, a: number): Color =>
    ((r << 24) | (g << 16) | (b << 8) | (Math.round(a * 255) << 0)) >>> 0;

const getTokenColorValue = (token: CSSValue, i: number): number => {
    if (token.type === TokenType.NUMBER_TOKEN) {
        return token.number;
    }

    if (token.type === TokenType.PERCENTAGE_TOKEN) {
        const max = i === 3 ? 1 : 255;
        return i === 3 ? (token.number / 100) * max : Math.round((token.number / 100) * max);
    }

    return 0;
};

const rgb = (_context: Context, args: CSSValue[]): number => {
    const tokens = args.filter(nonFunctionArgSeparator);

    if (tokens.length === 3) {
        const [r, g, b] = tokens.map(getTokenColorValue);
        return pack(r, g, b, 1);
    }

    if (tokens.length === 4) {
        const [r, g, b, a] = tokens.map(getTokenColorValue);
        return pack(r, g, b, a);
    }

    return 0;
};

function hue2rgb(t1: number, t2: number, hue: number): number {
    if (hue < 0) {
        hue += 1;
    }
    if (hue >= 1) {
        hue -= 1;
    }

    if (hue < 1 / 6) {
        return (t2 - t1) * hue * 6 + t1;
    } else if (hue < 1 / 2) {
        return t2;
    } else if (hue < 2 / 3) {
        return (t2 - t1) * 6 * (2 / 3 - hue) + t1;
    } else {
        return t1;
    }
}

const hsl = (context: Context, args: CSSValue[]): number => {
    const tokens = args.filter(nonFunctionArgSeparator);
    const [hue, saturation, lightness, alpha] = tokens;

    const h = (hue.type === TokenType.NUMBER_TOKEN ? deg(hue.number) : angle.parse(context, hue)) / (Math.PI * 2);
    const s = isLengthPercentage(saturation) ? saturation.number / 100 : 0;
    const l = isLengthPercentage(lightness) ? lightness.number / 100 : 0;
    const a = typeof alpha !== 'undefined' && isLengthPercentage(alpha) ? getAbsoluteValue(alpha, 1) : 1;

    if (s === 0) {
        return pack(l * 255, l * 255, l * 255, 1);
    }

    const t2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;

    const t1 = l * 2 - t2;
    const r = hue2rgb(t1, t2, h + 1 / 3);
    const g = hue2rgb(t1, t2, h);
    const b = hue2rgb(t1, t2, h - 1 / 3);
    return pack(r * 255, g * 255, b * 255, a);
};

const getColorSpaceValue = (token: CSSValue): number => {
    if (token.type === TokenType.NUMBER_TOKEN) {
        return token.number;
    }

    if (token.type === TokenType.PERCENTAGE_TOKEN) {
        return token.number / 100;
    }

    return 0;
};

const linearToSrgb = (value: number): number =>
    value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

// color(<colorspace> c1 c2 c3 [/ alpha]), see https://www.w3.org/TR/css-color-4/#color-function
// Wide-gamut RGB spaces are approximated as sRGB rather than converted.
const RGB_COLOR_SPACES = ['srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020'];

const colorFunction = (context: Context, args: CSSValue[]): number => {
    const tokens = args.filter(nonFunctionArgSeparator);
    const [colorSpace, c1, c2, c3, separator, alpha] = tokens;

    if (
        tokens.length < 4 ||
        colorSpace.type !== TokenType.IDENT_TOKEN ||
        RGB_COLOR_SPACES.indexOf(colorSpace.value.toLowerCase()) === -1
    ) {
        context.logger.warn(`Attempting to parse an unsupported color function value`);
        return COLORS.TRANSPARENT;
    }

    const toSrgb = colorSpace.value.toLowerCase() === 'srgb-linear' ? linearToSrgb : (value: number) => value;
    const [r, g, b] = [c1, c2, c3].map((token) => Math.round(clamp(toSrgb(getColorSpaceValue(token)), 0, 1) * 255));
    const a =
        tokens.length === 6 && separator.type === TokenType.DELIM_TOKEN && separator.value === '/'
            ? clamp(getColorSpaceValue(alpha), 0, 1)
            : 1;

    return pack(r, g, b, a);
};

// lab(), lch(), oklab() and oklch(), see https://www.w3.org/TR/css-color-4/#lab-colors
// Matrices are from the CSS Color 4 sample code. Out of gamut colors are clamped per channel.
type Matrix = [number, number, number][];

const multiplyMatrix = (m: Matrix, [x, y, z]: number[]): number[] => m.map(([a, b, c]) => a * x + b * y + c * z);

const D50_TO_D65: Matrix = [
    [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
    [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
    [0.012314014864481998, -0.020507649298898964, 1.330365926242124]
];

const XYZ_D65_TO_LINEAR_SRGB: Matrix = [
    [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
    [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
    [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]
];

const OKLAB_TO_LMS: Matrix = [
    [1, 0.3963377773761749, 0.2158037573099136],
    [1, -0.1055613458156586, -0.0638541728258133],
    [1, -0.0894841775298119, -1.2914855480194092]
];

const LMS_TO_LINEAR_SRGB: Matrix = [
    [4.0767416360759583, -3.3077115392580629, 0.2309699031821043],
    [-1.2684379732850315, 2.6097573492876882, -0.341319376002657],
    [-0.0041960761386756, -0.7034186179359363, 1.7076146940746117]
];

const D50_WHITE = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const LAB_KAPPA = 24389 / 27;
const LAB_EPSILON = 216 / 24389;

const labToLinearSrgb = ([l, a, b]: number[]): number[] => {
    const f1 = (l + 16) / 116;
    const f0 = a / 500 + f1;
    const f2 = f1 - b / 200;
    const xyz = [
        Math.pow(f0, 3) > LAB_EPSILON ? Math.pow(f0, 3) : (116 * f0 - 16) / LAB_KAPPA,
        l > LAB_KAPPA * LAB_EPSILON ? Math.pow(f1, 3) : l / LAB_KAPPA,
        Math.pow(f2, 3) > LAB_EPSILON ? Math.pow(f2, 3) : (116 * f2 - 16) / LAB_KAPPA
    ].map((value, i) => value * D50_WHITE[i]);
    return multiplyMatrix(XYZ_D65_TO_LINEAR_SRGB, multiplyMatrix(D50_TO_D65, xyz));
};

const oklabToLinearSrgb = (lab: number[]): number[] =>
    multiplyMatrix(
        LMS_TO_LINEAR_SRGB,
        multiplyMatrix(OKLAB_TO_LMS, lab).map((value) => Math.pow(value, 3))
    );

const polarToRectangular = ([l, c, h]: number[]): number[] => [l, c * Math.cos(h), c * Math.sin(h)];

// percentage reference ranges per component, 'hue' marks a hue component (converted to radians)
type LabComponents = [number, number, number | 'hue'];

const createLabFunction =
    (components: LabComponents, toLab: (values: number[]) => number[], toLinearSrgb: (lab: number[]) => number[]) =>
    (context: Context, args: CSSValue[]): number => {
        const tokens = args.filter(nonFunctionArgSeparator);
        const [c1, c2, c3, separator, alpha] = tokens;
        const hasAlpha = tokens.length === 5 && separator.type === TokenType.DELIM_TOKEN && separator.value === '/';

        if (tokens.length !== 3 && !hasAlpha) {
            context.logger.warn(`Attempting to parse an unsupported color function value`);
            return COLORS.TRANSPARENT;
        }

        const values: number[] = [];
        for (let i = 0; i < 3; i++) {
            const token = [c1, c2, c3][i];
            const range = components[i];
            if (isIdentWithValue(token, 'none')) {
                values.push(0);
            } else if (token.type === TokenType.NUMBER_TOKEN) {
                values.push(range === 'hue' ? deg(token.number) : token.number);
            } else if (token.type === TokenType.PERCENTAGE_TOKEN && range !== 'hue') {
                values.push((token.number / 100) * range);
            } else if (range === 'hue' && isAngle(token)) {
                values.push(angle.parse(context, token));
            } else {
                context.logger.warn(`Attempting to parse an unsupported color function value`);
                return COLORS.TRANSPARENT;
            }
        }

        const [r, g, b] = toLinearSrgb(toLab(values)).map((value) =>
            Math.round(linearToSrgb(clamp(value, 0, 1)) * 255)
        );
        const a = hasAlpha ? (isIdentWithValue(alpha, 'none') ? 0 : clamp(getColorSpaceValue(alpha), 0, 1)) : 1;

        return pack(r, g, b, a);
    };

const identity = (values: number[]): number[] => values;

const lab = createLabFunction([100, 125, 125], identity, labToLinearSrgb);
const lch = createLabFunction([100, 150, 'hue'], polarToRectangular, labToLinearSrgb);
const oklab = createLabFunction([1, 0.4, 0.4], identity, oklabToLinearSrgb);
const oklch = createLabFunction([1, 0.4, 'hue'], polarToRectangular, oklabToLinearSrgb);

const SUPPORTED_COLOR_FUNCTIONS: {
    [key: string]: (context: Context, args: CSSValue[]) => number;
} = {
    hsl: hsl,
    hsla: hsl,
    rgb: rgb,
    rgba: rgb,
    color: colorFunction,
    lab: lab,
    lch: lch,
    oklab: oklab,
    oklch: oklch
};

export const parseColor = (context: Context, value: string): Color =>
    color.parse(context, Parser.create(value).parseComponentValue());

export const COLORS: {[key: string]: Color} = {
    ALICEBLUE: 0xf0f8ffff,
    ANTIQUEWHITE: 0xfaebd7ff,
    AQUA: 0x00ffffff,
    AQUAMARINE: 0x7fffd4ff,
    AZURE: 0xf0ffffff,
    BEIGE: 0xf5f5dcff,
    BISQUE: 0xffe4c4ff,
    BLACK: 0x000000ff,
    BLANCHEDALMOND: 0xffebcdff,
    BLUE: 0x0000ffff,
    BLUEVIOLET: 0x8a2be2ff,
    BROWN: 0xa52a2aff,
    BURLYWOOD: 0xdeb887ff,
    CADETBLUE: 0x5f9ea0ff,
    CHARTREUSE: 0x7fff00ff,
    CHOCOLATE: 0xd2691eff,
    CORAL: 0xff7f50ff,
    CORNFLOWERBLUE: 0x6495edff,
    CORNSILK: 0xfff8dcff,
    CRIMSON: 0xdc143cff,
    CYAN: 0x00ffffff,
    DARKBLUE: 0x00008bff,
    DARKCYAN: 0x008b8bff,
    DARKGOLDENROD: 0xb886bbff,
    DARKGRAY: 0xa9a9a9ff,
    DARKGREEN: 0x006400ff,
    DARKGREY: 0xa9a9a9ff,
    DARKKHAKI: 0xbdb76bff,
    DARKMAGENTA: 0x8b008bff,
    DARKOLIVEGREEN: 0x556b2fff,
    DARKORANGE: 0xff8c00ff,
    DARKORCHID: 0x9932ccff,
    DARKRED: 0x8b0000ff,
    DARKSALMON: 0xe9967aff,
    DARKSEAGREEN: 0x8fbc8fff,
    DARKSLATEBLUE: 0x483d8bff,
    DARKSLATEGRAY: 0x2f4f4fff,
    DARKSLATEGREY: 0x2f4f4fff,
    DARKTURQUOISE: 0x00ced1ff,
    DARKVIOLET: 0x9400d3ff,
    DEEPPINK: 0xff1493ff,
    DEEPSKYBLUE: 0x00bfffff,
    DIMGRAY: 0x696969ff,
    DIMGREY: 0x696969ff,
    DODGERBLUE: 0x1e90ffff,
    FIREBRICK: 0xb22222ff,
    FLORALWHITE: 0xfffaf0ff,
    FORESTGREEN: 0x228b22ff,
    FUCHSIA: 0xff00ffff,
    GAINSBORO: 0xdcdcdcff,
    GHOSTWHITE: 0xf8f8ffff,
    GOLD: 0xffd700ff,
    GOLDENROD: 0xdaa520ff,
    GRAY: 0x808080ff,
    GREEN: 0x008000ff,
    GREENYELLOW: 0xadff2fff,
    GREY: 0x808080ff,
    HONEYDEW: 0xf0fff0ff,
    HOTPINK: 0xff69b4ff,
    INDIANRED: 0xcd5c5cff,
    INDIGO: 0x4b0082ff,
    IVORY: 0xfffff0ff,
    KHAKI: 0xf0e68cff,
    LAVENDER: 0xe6e6faff,
    LAVENDERBLUSH: 0xfff0f5ff,
    LAWNGREEN: 0x7cfc00ff,
    LEMONCHIFFON: 0xfffacdff,
    LIGHTBLUE: 0xadd8e6ff,
    LIGHTCORAL: 0xf08080ff,
    LIGHTCYAN: 0xe0ffffff,
    LIGHTGOLDENRODYELLOW: 0xfafad2ff,
    LIGHTGRAY: 0xd3d3d3ff,
    LIGHTGREEN: 0x90ee90ff,
    LIGHTGREY: 0xd3d3d3ff,
    LIGHTPINK: 0xffb6c1ff,
    LIGHTSALMON: 0xffa07aff,
    LIGHTSEAGREEN: 0x20b2aaff,
    LIGHTSKYBLUE: 0x87cefaff,
    LIGHTSLATEGRAY: 0x778899ff,
    LIGHTSLATEGREY: 0x778899ff,
    LIGHTSTEELBLUE: 0xb0c4deff,
    LIGHTYELLOW: 0xffffe0ff,
    LIME: 0x00ff00ff,
    LIMEGREEN: 0x32cd32ff,
    LINEN: 0xfaf0e6ff,
    MAGENTA: 0xff00ffff,
    MAROON: 0x800000ff,
    MEDIUMAQUAMARINE: 0x66cdaaff,
    MEDIUMBLUE: 0x0000cdff,
    MEDIUMORCHID: 0xba55d3ff,
    MEDIUMPURPLE: 0x9370dbff,
    MEDIUMSEAGREEN: 0x3cb371ff,
    MEDIUMSLATEBLUE: 0x7b68eeff,
    MEDIUMSPRINGGREEN: 0x00fa9aff,
    MEDIUMTURQUOISE: 0x48d1ccff,
    MEDIUMVIOLETRED: 0xc71585ff,
    MIDNIGHTBLUE: 0x191970ff,
    MINTCREAM: 0xf5fffaff,
    MISTYROSE: 0xffe4e1ff,
    MOCCASIN: 0xffe4b5ff,
    NAVAJOWHITE: 0xffdeadff,
    NAVY: 0x000080ff,
    OLDLACE: 0xfdf5e6ff,
    OLIVE: 0x808000ff,
    OLIVEDRAB: 0x6b8e23ff,
    ORANGE: 0xffa500ff,
    ORANGERED: 0xff4500ff,
    ORCHID: 0xda70d6ff,
    PALEGOLDENROD: 0xeee8aaff,
    PALEGREEN: 0x98fb98ff,
    PALETURQUOISE: 0xafeeeeff,
    PALEVIOLETRED: 0xdb7093ff,
    PAPAYAWHIP: 0xffefd5ff,
    PEACHPUFF: 0xffdab9ff,
    PERU: 0xcd853fff,
    PINK: 0xffc0cbff,
    PLUM: 0xdda0ddff,
    POWDERBLUE: 0xb0e0e6ff,
    PURPLE: 0x800080ff,
    REBECCAPURPLE: 0x663399ff,
    RED: 0xff0000ff,
    ROSYBROWN: 0xbc8f8fff,
    ROYALBLUE: 0x4169e1ff,
    SADDLEBROWN: 0x8b4513ff,
    SALMON: 0xfa8072ff,
    SANDYBROWN: 0xf4a460ff,
    SEAGREEN: 0x2e8b57ff,
    SEASHELL: 0xfff5eeff,
    SIENNA: 0xa0522dff,
    SILVER: 0xc0c0c0ff,
    SKYBLUE: 0x87ceebff,
    SLATEBLUE: 0x6a5acdff,
    SLATEGRAY: 0x708090ff,
    SLATEGREY: 0x708090ff,
    SNOW: 0xfffafaff,
    SPRINGGREEN: 0x00ff7fff,
    STEELBLUE: 0x4682b4ff,
    TAN: 0xd2b48cff,
    TEAL: 0x008080ff,
    THISTLE: 0xd8bfd8ff,
    TOMATO: 0xff6347ff,
    TRANSPARENT: 0x00000000,
    TURQUOISE: 0x40e0d0ff,
    VIOLET: 0xee82eeff,
    WHEAT: 0xf5deb3ff,
    WHITE: 0xffffffff,
    WHITESMOKE: 0xf5f5f5ff,
    YELLOW: 0xffff00ff,
    YELLOWGREEN: 0x9acd32ff
};
