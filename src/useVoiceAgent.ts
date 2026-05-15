import { useState, useRef, useEffect, useCallback } from 'react';
import { isSlotBooked, ALL_SLOTS } from './store';

export type AgentState = 'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED';

export interface Appointment {
  id: string;
  patientInfo: string;
  dateTimeInfo: string;
  createdAt: string;
}

// Speak using browser's native speechSynthesis — simple, reliable, no network needed
function tts(text: string, onEnd: () => void, onError: () => void) {
  // Prefer Hindi voice; fall back to any available voice
  const voices = window.speechSynthesis.getVoices();
  const hindiVoices = voices.filter(v => v.lang.startsWith('hi'));
  
  // Prefer 'online' or 'network' neural voices as they sound perfectly human on mobile
  let hindiVoice = hindiVoices.find(v => v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('network')) 
                   || hindiVoices[0] || null;

  const utter = new SpeechSynthesisUtterance(text);
  if (hindiVoice) {
    utter.voice = hindiVoice;
    utter.lang = hindiVoice.lang;
  } else {
    utter.lang = 'hi-IN';
  }
  utter.rate = 0.95; // More natural pacing than 0.85
  utter.pitch = 1;

  // Fallback in case browser TTS engine bugs out and doesn't fire onend
  let finished = false;
  const finish = () => { if (!finished) { finished = true; onEnd(); } };

  utter.onend = finish;
  utter.onerror = () => { finished = true; onError(); };

  window.speechSynthesis.speak(utter);

  // Failsafe timeout based on text length (max 15 seconds)
  setTimeout(finish, Math.min(Math.max(text.length * 150, 4000), 15000));
}

export function useVoiceAgent(onAppointmentBooked: (appointment: Appointment) => void) {
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [transcript, setTranscript] = useState('');

  const recognitionRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const currentTranscriptRef = useRef('');
  const patientInfoRef = useRef('');
  const dateTimeInfoRef = useRef('');

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'hi-IN';

      recognition.onresult = (event: any) => {
        const final = Array.from(event.results)
          .filter((r: any) => r.isFinal)
          .map((r: any) => (r as any)[0].transcript)
          .join('');
        if (final) {
          setTranscript(final);
          currentTranscriptRef.current = final;
          try { recognition.stop(); } catch (_) {}
        }
      };

      recognition.onerror = (e: any) => console.error('Recognition error:', e.error);
      recognitionRef.current = recognition;
    }

    // Pre-load voices so they're available when needed
    window.speechSynthesis.getVoices();
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    return () => {
      isActiveRef.current = false;
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (_) {}
      window.speechSynthesis.cancel();
    };
  }, []);

  // Returns a promise that resolves when the AI finishes speaking
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) return resolve();
      setAgentState('SPEAKING');

      tts(
        text,
        () => { if (isActiveRef.current) resolve(); },
        () => { resolve(); } // on error, keep flow going
      );
    });
  }, []);

  // Returns a promise that resolves with whatever the user said
  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current || !recognitionRef.current) return resolve('');

      setAgentState('LISTENING');
      setTranscript('');
      currentTranscriptRef.current = '';

      const recognition = recognitionRef.current;

      const cleanup = () => {
        recognition.onend = null;
        recognition.onerror = null;
      };

      recognition.onend = () => {
        cleanup();
        if (isActiveRef.current) resolve(currentTranscriptRef.current);
      };

      recognition.onerror = (e: any) => {
        cleanup();
        console.error('Recognition error', e.error);
        if (isActiveRef.current) resolve(currentTranscriptRef.current);
      };

      try { recognition.start(); }
      catch (_) { resolve(''); }
    });
  }, []);

  // Helper: ask until non-empty answer received
  const askUntilAnswered = useCallback(async (question: string, retryQ: string): Promise<string> => {
    let answer = '';
    while (!answer.trim() && isActiveRef.current) {
      await speak(question);
      if (!isActiveRef.current) return '';
      answer = await listenOnce();
      question = retryQ;
    }
    return answer.trim();
  }, [speak, listenOnce]);

  // Helper: check if user said yes
  const isYes = useCallback((r: string) => {
    const s = r.toLowerCase();
    return s.includes('हाँ') || s.includes('हां') || s.includes('han') || s.includes('ha') ||
      s.includes('yes') || s.includes('correct') || s.includes('theek') || s.includes('ठीक') ||
      s.includes('sahi') || s.includes('bilkul') || s.includes('ok') || s.includes('okay');
  }, []);

  // Extract only digits from speech (e.g. "nine eight seven..." → "987...")
  const extractDigits = (text: string): string => {
    const wordMap: Record<string, string> = {
      'zero':'0','one':'1','two':'2','three':'3','four':'4','five':'5',
      'six':'6','seven':'7','eight':'8','nine':'9','oh':'0',
      'शून्य':'0','एक':'1','दो':'2','तीन':'3','चार':'4','पाँच':'5','पांच':'5',
      'छह':'6','छः':'6','सात':'7','आठ':'8','नौ':'9'
    };
    let result = text.toLowerCase();
    Object.entries(wordMap).forEach(([w, d]) => { result = result.replace(new RegExp(w, 'g'), d); });
    return result.replace(/\D/g, '');
  };

  // Ask for phone and validate exactly 10 digits
  const askPhone = useCallback(async (): Promise<string> => {
    let digits = '';
    while (digits.length !== 10 && isActiveRef.current) {
      await speak(digits.length === 0
        ? "धन्यवाद। अब कृपया अपना 10 अंकों का मोबाइल नंबर बताएं।"
        : `आपने ${digits.length} अंक बताए। मोबाइल नंबर 10 अंकों का होना चाहिए। कृपया दोबारा पूरा नंबर बताएं।`
      );
      if (!isActiveRef.current) return '';
      const raw = await listenOnce();
      digits = extractDigits(raw);
      if (!digits && isActiveRef.current) {
        await speak("मुझे नंबर सुनाई नहीं दिया। कृपया दोबारा बताएं।");
      }
    }
    return digits;
  }, [speak, listenOnce]);

  // Identify which field the user wants to correct
  const identifyField = (text: string): 'name'|'phone'|'date'|'time'|null => {
    const r = text.toLowerCase();
    if (r.includes('naam') || r.includes('नाम') || r.includes('name')) return 'name';
    if (r.includes('number') || r.includes('नंबर') || r.includes('mobile') || r.includes('phone') || r.includes('फोन')) return 'phone';
    if (r.includes('date') || r.includes('तारीख') || r.includes('din') || r.includes('दिन')) return 'date';
    if (r.includes('time') || r.includes('समय') || r.includes('baje') || r.includes('बजे')) return 'time';
    return null;
  };

  // Helper: parse date from text to YYYY-MM-DD
  const parseDate = (text: string): { dateStr: string, isSunday: boolean } => {
    const d = new Date();
    const lower = text.toLowerCase();
    if (lower.includes('kal') || lower.includes('कल') || lower.includes('tomorrow')) {
      d.setDate(d.getDate() + 1);
    } else if (lower.includes('parso') || lower.includes('परसों') || lower.includes('day after')) {
      d.setDate(d.getDate() + 2);
    } else if (lower.includes('aaj') || lower.includes('आज') || lower.includes('today')) {
      // today
    } else {
      d.setDate(d.getDate() + 1); // default tomorrow
    }
    return { dateStr: d.toISOString().split('T')[0], isSunday: d.getDay() === 0 };
  };

  const askSmartDate = useCallback(async (): Promise<{ text: string, dateStr: string }> => {
    let resultDate = '';
    let parsedDateStr = '';
    while (isActiveRef.current) {
      resultDate = await askUntilAnswered(
        resultDate === '' ? "ठीक है, नंबर नोट कर लिया गया है। ... अब आप किस दिन डॉक्टर साहब से मिलना चाहेंगे? ... आप 'आज', 'कल', या कोई और दिन बोल सकते हैं।" : "कृपया कोई और दिन चुनें, जैसे कि कल, या परसों।",
        "माफ़ कीजिएगा, मैं समझ नहीं पाई। ... कृपया दिन फिर से बताएं।"
      );
      if (!isActiveRef.current) return { text: '', dateStr: '' };
      
      const parsed = parseDate(resultDate);
      if (parsed.isSunday) {
        await speak("माफ़ कीजिएगा, रविवार को क्लिनिक बंद रहता है। ... क्या आप सोमवार या किसी और दिन आना चाहेंगे?");
      } else {
        parsedDateStr = parsed.dateStr;
        break;
      }
    }
    return { text: resultDate, dateStr: parsedDateStr };
  }, [askUntilAnswered, speak]);

  const parseTime = (text: string): string | null => {
    const lower = text.toLowerCase();
    const timeMap: Record<string, string> = {
      '9:30': '9:30 AM', 'nau': '9:00 AM', '9': '9:00 AM',
      '10:30': '10:30 AM', 'das': '10:00 AM', '10': '10:00 AM',
      '11:30': '11:30 AM', 'gyarah': '11:00 AM', '11': '11:00 AM',
      '12:30': '12:30 PM', 'barah': '12:00 PM', '12': '12:00 PM',
      '1:30': '1:30 PM', 'ek': '1:00 PM', '1': '1:00 PM',
      '2:30': '2:30 PM', 'do': '2:00 PM', '2': '2:00 PM',
      '5:30': '5:30 PM', 'paanch': '5:00 PM', '5': '5:00 PM',
      '6:30': '6:30 PM', 'chhe': '6:00 PM', '6': '6:00 PM',
      '7:30': '7:30 PM', 'saat': '7:00 PM', '7': '7:00 PM',
    };
    for (const [key, val] of Object.entries(timeMap)) {
      if (lower.includes(key)) return val;
    }
    return null;
  };

  const getAvailableSlots = (dateStr: string) => ALL_SLOTS.filter(s => !isSlotBooked(dateStr, s));

  const askSmartTime = useCallback(async (dateStr: string): Promise<string> => {
    let resultTime = '';
    while (isActiveRef.current) {
      resultTime = await askUntilAnswered(
        resultTime === '' ? "जी बिलकुल। ... और आप कितने बजे आना पसंद करेंगे?" : "कृपया कोई और समय बताएं।",
        "सॉरी, मैं सुन नहीं पाई। ... कृपया समय फिर से बताएं, जैसे कि सुबह दस बजे, या शाम पांच बजे।"
      );
      if (!isActiveRef.current) return '';
      
      const parsedSlot = parseTime(resultTime);
      if (!parsedSlot) {
        return resultTime;
      }
      
      if (isSlotBooked(dateStr, parsedSlot)) {
         const available = getAvailableSlots(dateStr);
         const suggestions = available.slice(0, 3).join(', ');
         await speak(`माफ़ कीजिएगा, ${parsedSlot} का समय पहले से बुक है। ... मेरे पास ${suggestions} के स्लॉट्स खाली हैं। ... इनमें से आपके लिए क्या सही रहेगा?`);
      } else {
         return parsedSlot; 
      }
    }
    return resultTime;
  }, [askUntilAnswered, speak]);

  // Linear async conversation flow — each step waits for user before proceeding
  const runFlow = useCallback(async () => {
    // Collect all 4 fields
    let name = '', phone = '', date = '', time = '';
    let parsedDateStr = '';

    // --- STEP 1: Name ---
    name = await askUntilAnswered(
      "नमस्ते! डॉ. रमेश चावलानी के क्लिनिक में आपका स्वागत है। ... मैं आपकी अपॉइंटमेंट बुक कर सकती हूँ। ... सबसे पहले, क्या आप मुझे अपना शुभ नाम बता सकते हैं?",
      "माफ़ कीजिएगा, मैं ठीक से सुन नहीं पाई। ... क्या आप अपना नाम फिर से बता सकते हैं?"
    );
    if (!isActiveRef.current) return;

    setAgentState('PROCESSING'); await new Promise(r => setTimeout(r, 250));
    if (!isActiveRef.current) return;

    // --- STEP 2: Phone (10-digit validated) ---
    phone = await askPhone();
    if (!isActiveRef.current) return;

    setAgentState('PROCESSING'); await new Promise(r => setTimeout(r, 250));
    if (!isActiveRef.current) return;

    // --- STEP 3: Date ---
    const dRes = await askSmartDate();
    if (!isActiveRef.current) return;
    date = dRes.text;
    parsedDateStr = dRes.dateStr;

    setAgentState('PROCESSING'); await new Promise(r => setTimeout(r, 250));
    if (!isActiveRef.current) return;

    // --- STEP 4: Time ---
    time = await askSmartTime(parsedDateStr);
    if (!isActiveRef.current) return;

    // --- CONFIRMATION LOOP: repeat back, allow per-field correction ---
    let confirmed = false;
    let detailsSpoken = false;
    while (!confirmed && isActiveRef.current) {
      setAgentState('PROCESSING'); await new Promise(r => setTimeout(r, 350));
      if (!isActiveRef.current) return;

      if (!detailsSpoken) {
        await speak(
          `अच्छा, मैं एक बार आपकी जानकारी कन्फर्म कर लेती हूँ। ... ` +
          `आपका नाम है ${name}, ... ` +
          `नंबर है ${phone.split('').join(' ')}, ... ` +
          `और अपॉइंटमेंट है ${date} को, ${time} बजे। ... ` +
          `क्या यह जानकारी बिल्कुल सही है? आप हाँ या ना में जवाब दे सकते हैं।`
        );
        detailsSpoken = true;
      } else {
        await speak(`क्या यह सब सही है? हाँ, या ना बोलें।`);
      }
      if (!isActiveRef.current) return;

      const reply = await listenOnce();
      if (!isActiveRef.current) return;

      if (!reply.trim()) {
        continue; // They didn't answer, loop will ask the short question again
      }

      if (isYes(reply)) {
        confirmed = true;
      } else {
        // Try to identify which field they want to change
        const field = identifyField(reply);
        setAgentState('PROCESSING'); await new Promise(r => setTimeout(r, 250));
        if (!isActiveRef.current) return;

        if (field === 'name') {
          name = await askUntilAnswered(
            "ठीक है। ... कृपया सही नाम बताएं।",
            "नाम सुनाई नहीं दिया, दोबारा बताएं।"
          );
          detailsSpoken = false; // Details changed, read them again next loop
        } else if (field === 'phone') {
          await speak("ठीक है। ... कृपया सही मोबाइल नंबर बताएं।");
          if (!isActiveRef.current) return;
          phone = await askPhone();
          detailsSpoken = false;
        } else if (field === 'date') {
          const dRes = await askSmartDate();
          if (!isActiveRef.current) return;
          date = dRes.text;
          parsedDateStr = dRes.dateStr;
          detailsSpoken = false;
        } else if (field === 'time') {
          time = await askSmartTime(parsedDateStr);
          detailsSpoken = false;
        } else {
          // Couldn't identify field — ask them to specify
          await speak("कृपया बताएं ... नाम, नंबर, तारीख, या समय में से क्या बदलना है?");
        }
        if (!isActiveRef.current) return;
      }
    }

    // --- BOOK ---
    patientInfoRef.current = `${name} - ${phone}`;
    dateTimeInfoRef.current = `${date} - ${time}`;

    await speak("बहुत बढ़िया! आपकी अपॉइंटमेंट पक्की हो गई है। ... डॉ. रमेश चावलानी के क्लिनिक में कॉल करने के लिए आपका बहुत-बहुत धन्यवाद। ... आपका दिन शुभ हो!");
    if (!isActiveRef.current) return;

    onAppointmentBooked({
      id: Math.random().toString(36).substring(7),
      patientInfo: patientInfoRef.current,
      dateTimeInfo: dateTimeInfoRef.current,
      createdAt: new Date().toISOString()
    });
    setAgentState('COMPLETED');

    await new Promise(r => setTimeout(r, 3000));
    isActiveRef.current = false;
    setAgentState('IDLE');
  }, [speak, listenOnce, askUntilAnswered, askPhone, askSmartDate, askSmartTime, isYes, onAppointmentBooked]);

  const startCall = useCallback(() => {
    if (isActiveRef.current) return; // prevent double-start
    isActiveRef.current = true;

    try { recognitionRef.current?.abort(); } catch (_) {}
    window.speechSynthesis.cancel(); // clear stale queue

    // Unlock audio for mobile browsers
    const unlockUtter = new SpeechSynthesisUtterance('');
    unlockUtter.volume = 0;
    window.speechSynthesis.speak(unlockUtter);

    patientInfoRef.current = '';
    dateTimeInfoRef.current = '';
    setTranscript('');
    currentTranscriptRef.current = '';

    // Delay runFlow slightly so cancel() doesn't kill the first utterance (Safari/Chrome bug)
    setTimeout(() => {
      if (isActiveRef.current) runFlow();
    }, 100);
  }, [runFlow]);

  const endCall = useCallback(() => {
    isActiveRef.current = false;
    window.speechSynthesis.cancel();
    try { recognitionRef.current?.stop(); } catch (_) {}
    setAgentState('IDLE');
  }, []);

  return { agentState, transcript, startCall, endCall };
}
