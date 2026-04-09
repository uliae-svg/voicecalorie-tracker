// ────────────────────────────────────────────────────────
//  SpeechRecognizer — обёртка над Web Speech API
//  Поддерживается: Chrome, Edge (не Firefox)
// ────────────────────────────────────────────────────────

export class SpeechRecognizer {
  #recognition = null;
  #isListening  = false;

  /**
   * @param {{
   *   onResult:  (text: string) => void,
   *   onStart:   () => void,
   *   onEnd:     () => void,
   *   onError:   (msg: string) => void,
   * }} callbacks
   */
  constructor({ onResult, onStart, onEnd, onError }) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      onError('Ваш браузер не поддерживает распознавание речи. Используйте Chrome или Edge.');
      return;
    }

    this.#recognition = new SR();
    this.#recognition.lang            = 'ru-RU';
    this.#recognition.interimResults  = false;
    this.#recognition.maxAlternatives = 1;
    this.#recognition.continuous      = false;

    this.#recognition.onstart = () => {
      this.#isListening = true;
      onStart();
    };

    this.#recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();
      onResult(text);
    };

    this.#recognition.onend = () => {
      this.#isListening = false;
      onEnd();
    };

    this.#recognition.onerror = (event) => {
      this.#isListening = false;
      const messages = {
        'not-allowed':  'Доступ к микрофону запрещён. Разрешите его в настройках браузера.',
        'no-speech':    'Речь не обнаружена. Попробуйте ещё раз.',
        'network':      'Нет соединения с сервером распознавания.',
        'aborted':      '',
      };
      const msg = messages[event.error] ?? `Ошибка: ${event.error}`;
      if (msg) onError(msg);
      onEnd();
    };
  }

  get isListening() {
    return this.#isListening;
  }

  get isSupported() {
    return this.#recognition !== null;
  }

  start() {
    if (!this.#recognition || this.#isListening) return;
    try {
      this.#recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start error:', e);
    }
  }

  stop() {
    if (!this.#recognition || !this.#isListening) return;
    this.#recognition.stop();
  }
}
