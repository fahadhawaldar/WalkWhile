import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Speech from 'expo-speech';

interface WalkVoiceNative {
  speak(text: string): void;
  stop(): void;
}

// iOS uses the native module so prompts duck music and play while locked;
// elsewhere fall back to plain text-to-speech.
const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<WalkVoiceNative>('WalkVoice') : null;

export function speak(text: string): void {
  if (native) native.speak(text);
  else Speech.speak(text);
}

export function stopSpeaking(): void {
  if (native) native.stop();
  else Speech.stop();
}
