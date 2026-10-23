import { create } from 'zustand';
import {
  ActiveWalkState,
  Coordinate,
  DEFAULTS,
  RecommendedReturnAction,
  ReturnRouteStatus,
  WalkingRoute,
} from '@walkwhile/shared';
import { PRESET_LOCATIONS } from '../utils/location';

interface WalkStoreState {
  // Input settings
  origin: Coordinate;
  availableMinutes: number;
  walkingSpeedKmh: number;
  safetyBufferMinutes: number;

  // Generated options
  generatedRoutes: WalkingRoute[];
  selectedRouteIndex: number;

  // Active walk state machine
  activeState: ActiveWalkState;
  startTime: number | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  distanceWalkedMeters: number;

  // Tracking & Return
  currentPosition: Coordinate | null;
  returnRoute: WalkingRoute | null;
  returnSafetyStatus: ReturnRouteStatus;
  recommendedReturnAction: RecommendedReturnAction;
  returnSafetyMessage: string;

  // Actions
  setOrigin: (origin: Coordinate) => void;
  setAvailableMinutes: (minutes: number) => void;
  setWalkingSpeedKmh: (speed: number) => void;
  setSafetyBufferMinutes: (buffer: number) => void;
  setGeneratedRoutes: (routes: WalkingRoute[]) => void;
  setSelectedRouteIndex: (index: number) => void;
  startWalk: () => void;
  tickSecond: () => void;
  triggerReturn: (returnRoute?: WalkingRoute) => void;
  completeWalk: () => void;
  interruptWalk: () => void;
  resetWalk: () => void;
  updateCurrentPosition: (pos: Coordinate) => void;
  updateReturnAssessment: (assessment: {
    route: WalkingRoute;
    status: ReturnRouteStatus;
    action: RecommendedReturnAction;
    message: string;
  }) => void;
}

export const useWalkStore = create<WalkStoreState>((set, get) => ({
  // Defaults to DIFC Dubai
  origin: PRESET_LOCATIONS[0].coordinate,
  availableMinutes: DEFAULTS.AVAILABLE_MINUTES,
  walkingSpeedKmh: DEFAULTS.WALKING_SPEED_KMH,
  safetyBufferMinutes: DEFAULTS.SAFETY_BUFFER_MINUTES,

  generatedRoutes: [],
  selectedRouteIndex: 0,

  activeState: 'idle',
  startTime: null,
  elapsedSeconds: 0,
  remainingSeconds: DEFAULTS.AVAILABLE_MINUTES * 60,
  distanceWalkedMeters: 0,

  currentPosition: null,
  returnRoute: null,
  returnSafetyStatus: 'safe',
  recommendedReturnAction: 'continue',
  returnSafetyMessage: 'On schedule. Keep walking!',

  setOrigin: (origin) => set({ origin }),
  setAvailableMinutes: (availableMinutes) =>
    set({
      availableMinutes,
      remainingSeconds: availableMinutes * 60,
    }),
  setWalkingSpeedKmh: (walkingSpeedKmh) => set({ walkingSpeedKmh }),
  setSafetyBufferMinutes: (safetyBufferMinutes) => set({ safetyBufferMinutes }),

  setGeneratedRoutes: (generatedRoutes) =>
    set({
      generatedRoutes,
      selectedRouteIndex: 0,
      activeState: generatedRoutes.length > 0 ? 'ready' : 'idle',
    }),

  setSelectedRouteIndex: (selectedRouteIndex) => set({ selectedRouteIndex }),

  startWalk: () => {
    const { availableMinutes, origin } = get();
    set({
      activeState: 'walking',
      startTime: Date.now(),
      elapsedSeconds: 0,
      remainingSeconds: availableMinutes * 60,
      distanceWalkedMeters: 0,
      currentPosition: origin,
      returnRoute: null,
      returnSafetyStatus: 'safe',
      recommendedReturnAction: 'continue',
      returnSafetyMessage: 'Walk started. Enjoy your loop!',
    });
  },

  tickSecond: () => {
    const { activeState, startTime, availableMinutes } = get();
    if (activeState !== 'walking' && activeState !== 'returning') return;
    if (startTime === null) return;

    // Derive from wall-clock time so the countdown stays accurate even when
    // interval ticks are paused (app backgrounded, JS thread busy).
    const nextElapsed = Math.floor((Date.now() - startTime) / 1000);
    const nextRemaining = Math.max(0, availableMinutes * 60 - nextElapsed);

    set({
      elapsedSeconds: nextElapsed,
      remainingSeconds: nextRemaining,
    });
  },

  triggerReturn: (returnRoute) => {
    set((state) => ({
      activeState: 'returning',
      returnRoute: returnRoute ?? state.returnRoute,
      recommendedReturnAction: 'head_back_now',
    }));
  },

  completeWalk: () => {
    set({ activeState: 'completed' });
  },

  interruptWalk: () => {
    set({ activeState: 'interrupted' });
  },

  resetWalk: () => {
    const { availableMinutes } = get();
    set({
      activeState: 'idle',
      startTime: null,
      elapsedSeconds: 0,
      remainingSeconds: availableMinutes * 60,
      distanceWalkedMeters: 0,
      returnRoute: null,
      generatedRoutes: [],
      selectedRouteIndex: 0,
    });
  },

  updateCurrentPosition: (currentPosition) => {
    set({ currentPosition });
  },

  updateReturnAssessment: ({ route, status, action, message }) => {
    set({
      returnRoute: route,
      returnSafetyStatus: status,
      recommendedReturnAction: action,
      returnSafetyMessage: message,
    });
  },
}));
