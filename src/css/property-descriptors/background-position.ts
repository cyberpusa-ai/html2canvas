import {PropertyDescriptorParsingType, IPropertyListDescriptor} from '../IPropertyDescriptor';
import {CSSValue, isIdentToken, nonWhiteSpace, parseFunctionArgs} from '../syntax/parser';
import {TokenType} from '../syntax/tokenizer';
import {
    FIFTY_PERCENT,
    getAbsoluteValue,
    HUNDRED_PERCENT,
    isLengthPercentage,
    LengthPercentage,
    ZERO_LENGTH
} from '../types/length-percentage';
import {Context} from '../../core/context';
export type BackgroundPosition = BackgroundImagePosition[];

// each offset is the sum of its terms, e.g. `right 10px` is [100%, -10px]
export type BackgroundPositionOffset = LengthPercentage[];
export type BackgroundImagePosition = [BackgroundPositionOffset, BackgroundPositionOffset];

const enum AXIS {
    X,
    Y,
    EITHER
}

interface PositionComponent {
    axis: AXIS;
    start: BackgroundPositionOffset;
    fromEnd: boolean;
}

const KEYWORDS: {[keyword: string]: PositionComponent} = {
    left: {axis: AXIS.X, start: [ZERO_LENGTH], fromEnd: false},
    right: {axis: AXIS.X, start: [HUNDRED_PERCENT], fromEnd: true},
    top: {axis: AXIS.Y, start: [ZERO_LENGTH], fromEnd: false},
    bottom: {axis: AXIS.Y, start: [HUNDRED_PERCENT], fromEnd: true},
    center: {axis: AXIS.EITHER, start: [FIFTY_PERCENT], fromEnd: false}
};

const DEFAULT_POSITION: BackgroundImagePosition = [[ZERO_LENGTH], [ZERO_LENGTH]];

const negate = (token: LengthPercentage): LengthPercentage =>
    token.type === TokenType.DIMENSION_TOKEN
        ? {type: token.type, flags: token.flags, unit: token.unit, number: -token.number}
        : {type: token.type, flags: token.flags, number: -token.number};

// a length-percentage, or a calc() made only of length-percentages added or subtracted, as Firefox computes them
const parseOffset = (value: CSSValue): BackgroundPositionOffset | null => {
    if (isLengthPercentage(value)) {
        return [value];
    }

    if (value.type !== TokenType.FUNCTION || value.name !== 'calc') {
        return null;
    }

    const terms: BackgroundPositionOffset = [];
    let sign = 1;
    const values = value.values.filter(nonWhiteSpace);
    for (let i = 0; i < values.length; i++) {
        const token = values[i];
        if (i % 2 === 1) {
            if (token.type !== TokenType.DELIM_TOKEN || (token.value !== '+' && token.value !== '-')) {
                return null;
            }
            sign = token.value === '-' ? -1 : 1;
        } else if (isLengthPercentage(token)) {
            terms.push(sign < 0 ? negate(token) : token);
        } else {
            return null;
        }
    }

    return terms.length > 0 && values.length % 2 === 1 ? terms : null;
};

const resolveComponent = (component: PositionComponent, offset: BackgroundPositionOffset): BackgroundPositionOffset =>
    component.fromEnd ? component.start.concat(offset.map(negate)) : offset;

const parsePosition = (values: CSSValue[]): BackgroundImagePosition | null => {
    const keywords: (PositionComponent | null)[] = [];
    const offsets: (BackgroundPositionOffset | null)[] = [];
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        const keyword = isIdentToken(value) ? KEYWORDS[value.value.toLowerCase()] : undefined;
        const offset = keyword ? null : parseOffset(value);
        if (!keyword && !offset) {
            return null;
        }
        keywords.push(keyword || null);
        offsets.push(offset);
    }

    if (values.length === 1) {
        const keyword = keywords[0];
        if (keyword && keyword.axis === AXIS.Y) {
            return [[FIFTY_PERCENT], keyword.start];
        }
        return [keyword ? keyword.start : (offsets[0] as BackgroundPositionOffset), [FIFTY_PERCENT]];
    }

    if (values.length === 2) {
        // two keywords may come in either order, otherwise the first value is horizontal
        const swap = keywords[0] && keywords[1] && (keywords[0].axis === AXIS.Y || keywords[1].axis === AXIS.X);
        const [x, y] = swap ? [1, 0] : [0, 1];
        const xKeyword = keywords[x];
        const yKeyword = keywords[y];
        if ((xKeyword && xKeyword.axis === AXIS.Y) || (yKeyword && yKeyword.axis === AXIS.X)) {
            return null;
        }
        return [
            xKeyword ? xKeyword.start : (offsets[x] as BackgroundPositionOffset),
            yKeyword ? yKeyword.start : (offsets[y] as BackgroundPositionOffset)
        ];
    }

    if (values.length > 4) {
        return null;
    }

    // 3 and 4 value syntax: two keywords, each optionally followed by an offset from that edge
    const pairs: [PositionComponent, BackgroundPositionOffset | null][] = [];
    for (let i = 0; i < values.length; i++) {
        const keyword = keywords[i];
        if (!keyword) {
            return null;
        }
        const offset = i + 1 < values.length ? offsets[i + 1] : null;
        if (offset) {
            if (keyword.axis === AXIS.EITHER) {
                return null;
            }
            i++;
        }
        pairs.push([keyword, offset]);
    }

    if (pairs.length !== 2) {
        return null;
    }

    const [[a, aOffset], [b, bOffset]] = pairs;
    const aAxis = a.axis === AXIS.EITHER ? (b.axis === AXIS.X ? AXIS.Y : AXIS.X) : a.axis;
    const bAxis = b.axis === AXIS.EITHER ? (aAxis === AXIS.X ? AXIS.Y : AXIS.X) : b.axis;
    if (aAxis === bAxis) {
        return null;
    }

    const aValue = aOffset ? resolveComponent(a, aOffset) : a.start;
    const bValue = bOffset ? resolveComponent(b, bOffset) : b.start;
    return aAxis === AXIS.X ? [aValue, bValue] : [bValue, aValue];
};

export const getAbsoluteValueForPosition = (
    position: BackgroundImagePosition,
    width: number,
    height: number
): [number, number] => [
    position[0].reduce((sum, token) => sum + getAbsoluteValue(token, width), 0),
    position[1].reduce((sum, token) => sum + getAbsoluteValue(token, height), 0)
];

export const backgroundPosition: IPropertyListDescriptor<BackgroundPosition> = {
    name: 'background-position',
    initialValue: '0% 0%',
    type: PropertyDescriptorParsingType.LIST,
    prefix: false,
    parse: (context: Context, tokens: CSSValue[]): BackgroundPosition => {
        return parseFunctionArgs(tokens).map((values: CSSValue[]) => {
            const position = parsePosition(values);
            if (position === null) {
                context.logger.debug(`Unsupported background-position value, using 0% 0%`);
                return DEFAULT_POSITION;
            }
            return position;
        });
    }
};
