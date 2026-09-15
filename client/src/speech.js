// Text-to-speech: the browser's built-in Web Speech Synthesis API. Free, no
// server round-trip, works on any deployed host -- chosen specifically
// because Hugging Face's free Inference tier has zero text-to-speech models
// available (verified live; see server/media.js).
export function speak(text) {
  if (!('speechSynthesis' in window)) throw new Error('speech synthesis not supported in this browser');
  window.speechSynthesis.cancel(); // stop anything already playing
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function isSpeechSynthesisSupported() {
  return 'speechSynthesis' in window;
}

// Speech-to-text: records the mic via MediaRecorder and hands the resulting
// blob to the backend's /transcribe route (Whisper via Hugging Face). A
// class rather than a hook so it has no React dependency of its own.
export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  stop() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        this.stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(this.chunks, { type: 'audio/webm' }));
      };
      this.mediaRecorder.stop();
    });
  }
}

export function isRecordingSupported() {
  return !!(navigator.mediaDevices && window.MediaRecorder);
}
