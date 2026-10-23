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
}
