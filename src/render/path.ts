import {BezierCurve} from './bezier-curve';
import {Vector} from './vector';
export const enum PathType {
    VECTOR = 0,
    BEZIER_CURVE = 1
}

export interface IPath {
    type: PathType;
    add(deltaX: number, deltaY: number): IPath;
    reverse(): IPath;
}

export const equalPath = (a: Path[], b: Path[]): boolean => {
    if (a.length === b.length) {
        return a.some((v, i) => v === b[i]);
    }

    return false;
};

export const transformPath = (path: Path[], deltaX: number, deltaY: number, deltaW: number, deltaH: number): Path[] => {
    return path.map((point, index) => {
        switch (index) {
            case 0:
                return point.add(deltaX, deltaY);
            case 1:
                return point.add(deltaX + deltaW, deltaY);
            case 2:
                return point.add(deltaX + deltaW, deltaY + deltaH);
            case 3:
                return point.add(deltaX, deltaY + deltaH);
        }
        return point;
    });
};

// the same outline traced in the opposite direction, so it can cut a hole into an enclosing path
export const reversePath = (path: Path[]): Path[] => path.map((point) => point.reverse()).reverse();

export type Path = Vector | BezierCurve;
