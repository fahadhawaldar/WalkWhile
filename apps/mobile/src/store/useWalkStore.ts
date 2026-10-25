import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  ActiveWalkState,
  Coordinate,
  DEFAULTS,
  RecommendedReturnAction,
  ReturnRouteStatus,
  WaitType,
  WalkingRoute,
} from '@walkwhile/shared';
import { PRESET_LOCATIONS } from '../utils/location';

/** What the app has learned about how this person walks, from their history. */
export interface LearnedProfile {
  /** Walking speed with crossings taken out, km/h. Null until enough walks. */
  paceKmh: number | null;
  /** Walks the pace is based on. */
  paceWalks: number;
  /** Metres per step, from steps and distance on past walks. */
  strideMeters: number | null;
}

interface WalkStoreState {
  // Input settings
  origin: Coordinate;
  /** Where the origin came from: a GPS fix, a developer preset, or the placeholder. */
  originSource: 'gps' | 'preset' | 'default';
  availableMinutes: number;
  walkingSpeedKmh: number;
  safetyBufferMinutes: number;
  waitType: WaitType;
  /** Flexible waits: furthest the walker should get, in minutes back. */
  maxReturnMinutes: number;
  /** Dev only: move along the route automatically instead of using GPS. */
  simulateWalk: boolean;
  /** Speak turns, time checks and return warnings during a walk. */
  voiceEnabled: boolean;
  /** Follow the phone's light/dark setting, or force one. */
  appearance: 'system' | 'light' | 'dark';
  /** auto: walkingSpeedKmh follows the learned pace. manual: the walker picked one. */
  paceMode: 'auto' | 'manual';
  learned: LearnedProfile;
  /** Steps a day to aim for; null until the walker sets one. */
  dailyStepGoal: number | null;
  /** The walker closed the "set a goal" card without setting one. */
  goalPromptDismissed: boolean;
  /** Day (YYYY-MM-DD) the goal was last celebrated, so it happens once a day. */
  goalCelebratedOn: string | null;

  // Generated options
  generatedRoutes: WalkingRoute[];
  selectedRouteIndex: number;

  // Active walk state machine
  activeState: ActiveWalkState;
  startTime: number | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  distanceWalkedMeters: number;
  /** Steps taken since the walk started, from the phone's pedometer. */
  stepCount: number;

  // Tracking & Return
  currentPosition: Coordinate | null;
  returnRoute: WalkingRoute | null;
  returnSafetyStatus: ReturnRouteStatus;
  recommendedReturnAction: RecommendedReturnAction;
  returnSafetyMessage: string;

  // Actions
  setOrigin: (origin: Coordinate, source: 'gps' | 'preset') => void;
  setAvailableMinutes: (minutes: number) => void;
  setWalkingSpeedKmh: (speed: number) => void;
  setSafetyBufferMinutes: (buffer: number) => void;
  setWaitType: (waitType: WaitType) => void;
  setSimulateWalk: (simulate: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setAppearance: (appearance: 'system' | 'light' | 'dark') => void;
  /** Pick a fixed pace (manual) or go back to the learned one (auto). */
  setPace: (mode: 'auto' | 'manual', kmh?: number) => void;
  setLearned: (learned: LearnedProfile) => void;
  setDailyStepGoal: (goal: number | null) => void;
  dismissGoalPrompt: () => void;
  markGoalCelebrated: (day: string) => void;
  setGeneratedRoutes: (routes: WalkingRoute[]) => void;
  setSelectedRouteIndex: (index: number) => void;
  startWalk: () => void;
  tickSecond: () => void;
  /** Flexible waits: the other person is running late. */
  extendWalk: (minutes: number) => void;
  addWalkedDistance: (meters: number) => void;
  setStepCount: (steps: number) => void;
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

export const useWalkStore = create<WalkStoreState>()(
  persist(
    (set, get) => ({
      // Defaults to DIFC Dubai
      origin: PRESET_LOCATIONS[0].coordinate,
      originSource: 'default',
      availableMinutes: DEFAULTS.AVAILABLE_MINUTES,
      walkingSpeedKmh: DEFAULTS.WALKING_SPEED_KMH,
      safetyBufferMinutes: DEFAULTS.SAFETY_BUFFER_MINUTES,
      waitType: 'fixed',
      maxReturnMinutes: 3,
      simulateWalk: false,
      voiceEnabled: true,
      appearance: 'system',
      paceMode: 'auto',
      learned: { paceKmh: null, paceWalks: 0, strideMeters: null },
      dailyStepGoal: null,
      goalPromptDismissed: false,
      goalCelebratedOn: null,

      generatedRoutes: [],
      selectedRouteIndex: 0,

      activeState: 'idle',
      startTime: null,
      elapsedSeconds: 0,
      remainingSeconds: DEFAULTS.AVAILABLE_MINUTES * 60,
      distanceWalkedMeters: 0,
      stepCount: 0,

      currentPosition: null,
      returnRoute: null,
      returnSafetyStatus: 'safe',
      recommendedReturnAction: 'continue',
      returnSafetyMessage: 'On schedule. Keep walking!',

      setOrigin: (origin, originSource) => set({ origin, originSource }),
      setAvailableMinutes: (availableMinutes) =>
        set({
          availableMinutes,
          remainingSeconds: availableMinutes * 60,
        }),
      setWalkingSpeedKmh: (walkingSpeedKmh) => set({ walkingSpeedKmh }),
      setSafetyBufferMinutes: (safetyBufferMinutes) => set({ safetyBufferMinutes }),
      setWaitType: (waitType) => set({ waitType }),
      setSimulateWalk: (simulateWalk) => set({ simulateWalk }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setAppearance: (appearance) => set({ appearance }),
      setPace: (paceMode, kmh) => {
        if (paceMode === 'manual' && kmh !== undefined) {
          set({ paceMode, walkingSpeedKmh: kmh });
        } else {
          set({
            paceMode: 'auto',
            walkingSpeedKmh: get().learned.paceKmh ?? DEFAULTS.WALKING_SPEED_KMH,
          });
        }
      },
      setLearned: (learned) => {
        set({ learned });
        // In auto mode the planning speed follows what was learned.
        if (get().paceMode === 'auto') {
          set({ walkingSpeedKmh: learned.paceKmh ?? DEFAULTS.WALKING_SPEED_KMH });
        }
      },
      setDailyStepGoal: (dailyStepGoal) => set({ dailyStepGoal }),
      dismissGoalPrompt: () => set({ goalPromptDismissed: true }),
      markGoalCelebrated: (goalCelebratedOn) => set({ goalCelebratedOn }),

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
          stepCount: 0,
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

      extendWalk: (minutes) => {
        const { availableMinutes } = get();
        set({ availableMinutes: availableMinutes + minutes });
        get().tickSecond();
      },

      addWalkedDistance: (meters) => {
        set((state) => ({
          distanceWalkedMeters: state.distanceWalkedMeters + meters,
        }));
      },

      setStepCount: (stepCount) => set({ stepCount }),

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
          stepCount: 0,
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
    }),
    {
      name: 'walkwhile.settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Only preferences and what was learned; never a walk in progress.
      partialize: (s) => ({
        walkingSpeedKmh: s.walkingSpeedKmh,
        safetyBufferMinutes: s.safetyBufferMinutes,
        waitType: s.waitType,
        voiceEnabled: s.voiceEnabled,
        appearance: s.appearance,
        paceMode: s.paceMode,
        learned: s.learned,
        dailyStepGoal: s.dailyStepGoal,
        goalPromptDismissed: s.goalPromptDismissed,
        goalCelebratedOn: s.goalCelebratedOn,
      }),
    }
  )
);
