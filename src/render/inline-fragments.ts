import {Bounds} from '../css/layout/bounds';
import {CSSParsedDeclaration} from '../css/index';
import {DIRECTION} from '../css/property-descriptors/direction';
import {BORDER_STYLE} from '../css/property-descriptors/border-style';
import {ZERO_LENGTH} from '../css/types/length-percentage';

export interface InlineFragment {
    bounds: Bounds;
    styles: CSSParsedDeclaration;
}

// With box-decoration-break: slice (the default), an inline element that wraps is cut into one box per line.
// The start edge (border, padding, corner radii) only exists on the first box and the end edge only on the last.
// Each fragment gets a copy of the styles with the cut edges removed, so the regular background, box-shadow
// and border renderers (dashed, dotted, double, radius) can paint it like any other box.
export const calculateInlineFragments = (lineBounds: Bounds[], styles: CSSParsedDeclaration): InlineFragment[] => {
    const count = lineBounds.length;
    return lineBounds.map((bounds, index) => {
        const isFirst = index === 0;
        const isLast = index === count - 1;
        const rtl = styles.direction === DIRECTION.RTL;
        const hasLeft = rtl ? isLast : isFirst;
        const hasRight = rtl ? isFirst : isLast;
        if (hasLeft && hasRight) {
            return {bounds, styles};
        }

        const fragmentStyles = Object.create(styles) as CSSParsedDeclaration;
        if (!hasLeft) {
            fragmentStyles.borderLeftWidth = 0;
            fragmentStyles.borderLeftStyle = BORDER_STYLE.NONE;
            fragmentStyles.paddingLeft = ZERO_LENGTH;
            fragmentStyles.borderTopLeftRadius = [ZERO_LENGTH];
            fragmentStyles.borderBottomLeftRadius = [ZERO_LENGTH];
        }
        if (!hasRight) {
            fragmentStyles.borderRightWidth = 0;
            fragmentStyles.borderRightStyle = BORDER_STYLE.NONE;
            fragmentStyles.paddingRight = ZERO_LENGTH;
            fragmentStyles.borderTopRightRadius = [ZERO_LENGTH];
            fragmentStyles.borderBottomRightRadius = [ZERO_LENGTH];
        }
        return {bounds, styles: fragmentStyles};
    });
};
