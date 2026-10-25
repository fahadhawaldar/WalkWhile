import AVFoundation
import ExpoModulesCore

/**
 * Spoken walk prompts that work with the screen locked. Like navigation
 * apps, it ducks whatever is playing (music, podcasts) while it speaks and
 * hands the audio back afterwards.
 */
public class WalkVoiceModule: Module {
  private let voice = WalkVoice()

  public func definition() -> ModuleDefinition {
    Name("WalkVoice")

    Function("speak") { (text: String) in
      DispatchQueue.main.async {
        self.voice.speak(text)
      }
    }

    Function("stop") {
      DispatchQueue.main.async {
        self.voice.stop()
      }
    }
  }
}

final class WalkVoice: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()
  private var pending = 0

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  func speak(_ text: String) {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(
        .playback,
        mode: .voicePrompt,
        options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers]
      )
      try session.setActive(true)
    } catch {
      // Speak anyway; at worst it won't duck other audio.
    }
    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(language: AVSpeechSynthesisVoice.currentLanguageCode())
    pending += 1
    synthesizer.speak(utterance)
  }

  func stop() {
    synthesizer.stopSpeaking(at: .immediate)
  }

  private func finishedOne() {
    pending = max(0, pending - 1)
    guard pending == 0 else { return }
    // Let music come back up.
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    finishedOne()
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    finishedOne()
  }
}
