import {Bounds} from '../css/layout/bounds';
import {CSSParsedDeclaration} from '../css/index';
import {BACKGROUND_CLIP} from '../css/property-descriptors/background-clip';
import {DIRECTION} from '../css/property-descriptors/direction';
import {Color} from '../css/types/color';
import {getAbsoluteValue} from '../css/types/length-percentage';
import {BORDER_STYLE} from '../css/property-descriptors/border-style';
import {isTransparent} from '../css/types/color';

export interface InlineFragmentBorder {
    color: Color;
    bounds: Bounds;
}

// with box-decoration-break: slice, the start edge only exists on the first line box and the end edge on the last
const fragmentEdges = (index: number, count: number, direction: DIRECTION): {hasLeft: boolean; hasRight: boolean} => {
    const isFirst = index === 0;
    const isLast = index === count - 1;
    return direction === DIRECTION.RTL ? {hasLeft: isLast, hasRight: isFirst} : {hasLeft: isFirst, hasRight: isLast};
};

export const calculateInlineFragmentClipBoxes = (
    fragments: Bounds[],
    styles: CSSParsedDeclaration,
    clip: BACKGROUND_CLIP
): Bounds[] => {
    return fragments.map((fragment, index) => {
        if (clip === BACKGROUND_CLIP.BORDER_BOX) {
            return fragment;
        }
        const {hasLeft, hasRight} = fragmentEdges(index, fragments.length, styles.direction);
        // percentages on inline padding resolve against the containing block, which isn't known here
        const content = clip === BACKGROUND_CLIP.CONTENT_BOX;
        const left = hasLeft ? styles.borderLeftWidth + (content ? getAbsoluteValue(styles.paddingLeft, 0) : 0) : 0;
        const right = hasRight ? styles.borderRightWidth + (content ? getAbsoluteValue(styles.paddingRight, 0) : 0) : 0;
        const top = styles.borderTopWidth + (content ? getAbsoluteValue(styles.paddingTop, 0) : 0);
        const bottom = styles.borderBottomWidth + (content ? getAbsoluteValue(styles.paddingBottom, 0) : 0);
        return new Bounds(
            fragment.left + left,
            fragment.top + top,
            Math.max(0, fragment.width - left - right),
            Math.max(0, fragment.height - top - bottom)
        );
    });
};

export const calculateInlineFragmentBorders = (
    fragments: Bounds[],
    styles: CSSParsedDeclaration
): InlineFragmentBorder[] => {
    const sides = [
        {style: styles.borderTopStyle, color: styles.borderTopColor, width: styles.borderTopWidth},
        {style: styles.borderRightStyle, color: styles.borderRightColor, width: styles.borderRightWidth},
        {style: styles.borderBottomStyle, color: styles.borderBottomColor, width: styles.borderBottomWidth},
        {style: styles.borderLeftStyle, color: styles.borderLeftColor, width: styles.borderLeftWidth}
    ];
    const borders: InlineFragmentBorder[] = [];
    fragments.forEach((fragment, index) => {
        const {hasLeft, hasRight} = fragmentEdges(index, fragments.length, styles.direction);
        sides.forEach(({style, color, width}, side) => {
            if (style === BORDER_STYLE.NONE || isTransparent(color) || !(width > 0)) {
                return;
            }
            switch (side) {
                case 0:
                    borders.push({color, bounds: new Bounds(fragment.left, fragment.top, fragment.width, width)});
                    break;
                case 1:
                    if (hasRight) {
                        borders.push({
                            color,
                            bounds: new Bounds(
                                fragment.left + fragment.width - width,
                                fragment.top,
                                width,
                                fragment.height
                            )
                        });
                    }
                    break;
                case 2:
                    borders.push({
                        color,
                        bounds: new Bounds(fragment.left, fragment.top + fragment.height - width, fragment.width, width)
                    });
                    break;
                case 3:
                    if (hasLeft) {
                        borders.push({color, bounds: new Bounds(fragment.left, fragment.top, width, fragment.height)});
                    }
                    break;
            }
        });
    });
    return borders;
};
