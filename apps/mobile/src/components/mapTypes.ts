import { Coordinate, WalkingRoute } from '@walkwhile/shared';

export interface UniversalMapProps {
  origin: Coordinate;
  routes?: WalkingRoute[];
  selectedRouteIndex?: number;
  currentPosition?: Coordinate | null;
  returnRoute?: WalkingRoute | null;
  height?: number;
  onSelectRoute?: (index: number) => void;
  /** Keep the camera on the walker instead of framing the whole route. */
  followUser?: boolean;
  /** Direction the walker is facing, in degrees from North. */
  heading?: number | null;
  /**
   * Index of the route coordinate the walker has reached. When set, the part
   * of the selected route already walked is drawn faded.
   */
  progressIndex?: number;
  /** Fill the parent edge to edge instead of a rounded card of `height`. */
  fullScreen?: boolean;
  /** Space covered by UI floating over the map, so the camera centres in what's left. */
  mapPadding?: { top: number; bottom: number };
}
