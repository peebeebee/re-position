import { fromEvent, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';

import {
    AngleAndDistance,
    Dimensions,
    Position,
    PositionStrings,
} from '../types';
import {
    angleBetweenPoints,
    corners,
    distanceBetweenPoints,
    positionOfElement,
    rotationOfElement,
    round,
    scaleOfElement,
    snapObjectValues,
    transformMatrixOfElement,
} from '../utils';
import {
    documentMouseMove$,
    documentMouseUp$,
    requestAnimationFramesUntil,
} from './misc';

interface ResizeObservableOptions {
    element: HTMLElement;
    handle: HTMLElement;
    onComplete?: () => void;
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
    shouldConvertToPercent?: boolean;
    snap?: number;
}

/*
 * Create an Obvservable that enables resizing an HTML element
 * and emits a stream of updated size.
 *
 * @param element HTML Element for which to enable resizing
 * @param handle HTML Element of the movable handle
 */
export const createResizeObservable = ({
    element,
    handle,
    onComplete,
    shouldConvertToPercent = true,
    snap,
    top,
    right,
    bottom,
    left,
}: ResizeObservableOptions): Observable<PositionStrings> => {
    const mouseDown$ = fromEvent<MouseEvent>(handle, 'mousedown');

    return mouseDown$.pipe(
        filter((e: MouseEvent) => e.which === 1), // left clicks only
        switchMap((e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const oldPosition = positionOfElement(element);
            const oldRotation = rotationOfElement(element);
            const transformMatrix = transformMatrixOfElement(element);
            const scale = scaleOfElement(element);

            const move$ = documentMouseMove$.pipe(
                map(
                    angleAndDistanceFromPointToMouseEvent(
                        e.clientX,
                        e.clientY,
                        scale
                    )
                ),
                map(horizontalAndVerticalChange(oldRotation)),
                map(
                    applyToOriginalDimensions(
                        oldPosition,
                        top,
                        right,
                        bottom,
                        left
                    )
                ),
                map(limitToTwentyPxMinimum),
                map(snapObjectValues(snap)),
                distinctUntilChanged(),
                map(
                    lockAspectRatio(
                        e.shiftKey,
                        oldPosition.width / oldPosition.height
                    )
                ),
                map(
                    offsetForVisualConsistency(
                        oldPosition,
                        transformMatrix,
                        top,
                        right,
                        bottom,
                        left
                    )
                ),
                map(
                    convertDimensionsToPercent(
                        shouldConvertToPercent,
                        element.parentElement!
                    )
                )
            );

            return requestAnimationFramesUntil(
                move$,
                documentMouseUp$,
                onComplete
            );
        })
    );
};

/**
 * Calculates the distance from an origin point to a mouse event
 */
const angleAndDistanceFromPointToMouseEvent = (
    originX: number,
    originY: number,
    scale: number
) => (e: MouseEvent): AngleAndDistance => ({
    angle: angleBetweenPoints(originX, originY)(e.clientX, e.clientY),
    distance:
        distanceBetweenPoints(originX, originY)(e.clientX, e.clientY) / scale,
});

/**
 * Translate angle and distance change of handle to change in x and y
 * (taking old rotation of the element into account).
 */
const horizontalAndVerticalChange = (oldRotation: number) => (
    angleAndDistanceChange: AngleAndDistance
): Dimensions => {
    const angleRadians =
        ((angleAndDistanceChange.angle - oldRotation) * Math.PI) / 180;

    return {
        width: angleAndDistanceChange.distance * Math.cos(angleRadians),
        height: angleAndDistanceChange.distance * Math.sin(angleRadians),
    };
};

/**
 * Apply horizontal and vertical change to old element's dimensions.
 */
const applyToOriginalDimensions = (
    oldPosition: Position,
    top: boolean | undefined,
    right: boolean | undefined,
    bottom: boolean | undefined,
    left: boolean | undefined
) => (change: Dimensions): Position => {
    const positionLeft = left
        ? oldPosition.left + change.width
        : oldPosition.left;

    const positionTop = top ? oldPosition.top + change.height : oldPosition.top;

    const positionWidth = left
        ? oldPosition.width - change.width
        : right
            ? oldPosition.width + change.width
            : oldPosition.width;

    const positionHeight = top
        ? oldPosition.height - change.height
        : bottom
            ? oldPosition.height + change.height
            : oldPosition.height;

    return {
        left: positionLeft,
        top: positionTop,
        width: positionWidth,
        height: positionHeight,
    };
};

/**
 * Limit the dimensions to a twenty pixel minimum height and width.
 */
const limitToTwentyPxMinimum = (position: Position): Position => ({
    ...position,
    height: Math.max(20, position.height),
    width: Math.max(20, position.width),
});

/**
 * If `shouldLock` is `true`, the new dimensions
 * will be forced into the provided aspect ratio.
 */
const lockAspectRatio = (shouldLock: boolean, aspectRatio: number) => (
    position: Position
): Position => {
    if (!shouldLock) {
        return position;
    }

    if (position.width / position.height > aspectRatio) {
        return {
            ...position,
            height: position.width / aspectRatio,
        };
    }

    if (position.width / position.height < aspectRatio) {
        return {
            ...position,
            width: position.height * aspectRatio,
        };
    }

    return position;
};

/**
 * Fudge the left and top in order to keep
 * the perceived visual position the same.
 */
const offsetForVisualConsistency = (
    oldPosition: Position,
    transformMatrix: Matrix,
    top?: boolean,
    right?: boolean,
    bottom?: boolean,
    left?: boolean
) => (newPosition: Position): Position => {
    const oldCorners = corners(oldPosition, transformMatrix);
    const newCorners = corners(newPosition, transformMatrix);

    let changeX: number;
    let changeY: number;

    if (bottom && left) {
        changeX = newCorners.ne.x - oldCorners.ne.x;
        changeY = newCorners.ne.y - oldCorners.ne.y;
    } else if (top && right) {
        changeX = newCorners.sw.x - oldCorners.sw.x;
        changeY = newCorners.sw.y - oldCorners.sw.y;
    } else if (top || left) {
        changeX = newCorners.se.x - oldCorners.se.x;
        changeY = newCorners.se.y - oldCorners.se.y;
    } else {
        changeX = newCorners.nw.x - oldCorners.nw.x;
        changeY = newCorners.nw.y - oldCorners.nw.y;
    }

    return {
        left: newPosition.left - changeX,
        top: newPosition.top - changeY,
        width: newPosition.width,
        height: newPosition.height,
    };
};

/**
 * Convert pixel dimensions to a percentage of the parent's dimensions.
 */
const convertDimensionsToPercent = (
    shouldConvertToPercent: boolean,
    parent: HTMLElement
) => (position: Position): PositionStrings =>
    shouldConvertToPercent
        ? {
              left: `${round((position.left / parent.offsetWidth) * 100)}%`,
              top: `${round((position.top / parent.offsetHeight) * 100)}%`,
              height: `${round(
                  (position.height / parent.offsetHeight) * 100
              )}%`,
              width: `${round((position.width / parent.offsetWidth) * 100)}%`,
          }
        : {
              left: `${round(position.left)}px`,
              top: `${round(position.top)}px`,
              height: `${round(position.height)}px`,
              width: `${round(position.width)}px`,
          };
