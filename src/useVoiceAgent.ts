import { useState, useRef, useEffect, useCallback } from 'react';
import { isSlotBooked, ALL_SLOTS } from './store';

export type AgentState = 'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED';

export interface Appointment {
  id: string;
  patientInfo: string;
  dateTimeInfo: string;
  createdAt: string;
}

function tts(text: string, onEnd: () => void, onError: () => void) {
  const voices = window.speechSynthesis.getVoices();
  const premiumVoice = voices.find(v => 
    v.lang.startsWith('hi') && 
    (v.name.includes('Google') || v.name.includes('Online') || v.name.includes('Natural') || v.name.includes('Premium'))
  );
  const defaultHindiVoice = voices.find(v => v.lang.startsWith('hi'));
  const bestVoice = premiumVoice || defaultHindiVoice || null;

  const utter = new SpeechSynthesisUtterance(text);
  if (bestVoice) {
    utter.voice = bestVoice;
    utter.lang = bestVoice.lang;
  } else {
    utter.lang = 'hi-IN';
  }
  utter.rate = 0.95; 
  utter.pitch = 1.05; 

  let finished = false;
  const finish = () => { if (!finished) { finished = true; onEnd(); } };

  utter.onend = finish;
  utter.onerror = () => { finished = true; onError(); };

  window.speechSynthesis.speak(utter);
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

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) return resolve();
      setAgentState('SPEAKING');

      tts(
        text,
        () => { if (isActiveRef.current) resolve(); },
        () => { resolve(); } 
      );
    });
  }, []);

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

  const isYes = useCallback((r: string) => {
    const s = r.toLowerCase();
    return s.includes('हाँ') || s.includes('हां') || s.includes('han') || s.includes('ha') ||
      s.includes('yes') || s.includes('correct') || s.includes('theek') || s.includes('ठीक') ||
      s.includes('sahi') || s.includes('bilkul') || s.includes('ok') || s.includes('okay') || 
      s.includes('book') || s.includes('kar do') || s.includes('kar de');
  }, []);

  const isNo = useCallback((r: string) => {
    const s = r.toLowerCase();
    return s.includes('नहीं') || s.includes('nahi') || s.includes('nhi') || s.includes('no') || 
      s.includes('cancel') || s.includes('na ') || s.includes('mat');
  }, []);

  const checkGlobalIntent = useCallback((text: string): 'name'|'phone'|'date'|'time'|null => {
    const r = text.toLowerCase();
    const wantsToChange = r.includes('galat') || r.includes('wrong') || r.includes('badal') || r.includes('change') || r.includes('sahi nahi') || r.includes('galt');
    if (!wantsToChange) return null;

    if (r.includes('naam') || r.includes('नाम') || r.includes('name')) return 'name';
    if (r.includes('number') || r.includes('नंबर') || r.includes('mobile') || r.includes('phone') || r.includes('फोन')) return 'phone';
    if (r.includes('date') || r.includes('तारीख') || r.includes('din') || r.includes('दिन') || r.includes('tarikh')) return 'date';
    if (r.includes('time') || r.includes('समय') || r.includes('baje') || r.includes('बजे')) return 'time';
    return null;
  }, []);

  const identifyField = (text: string): 'name'|'phone'|'date'|'time'|null => {
    const r = text.toLowerCase();
    if (r.includes('naam') || r.includes('नाम') || r.includes('name')) return 'name';
    if (r.includes('number') || r.includes('नंबर') || r.includes('mobile') || r.includes('phone') || r.includes('फोन')) return 'phone';
    if (r.includes('date') || r.includes('तारीख') || r.includes('din') || r.includes('दिन')) return 'date';
    if (r.includes('time') || r.includes('समय') || r.includes('baje') || r.includes('बजे')) return 'time';
    return null;
  };

  const askUntilAnswered = useCallback(async (question: string, retryQ: string): Promise<{val: string, intent: any}> => {
    let answer = '';
    while (!answer.trim() && isActiveRef.current) {
      await speak(question);
      if (!isActiveRef.current) return {val:'', intent:null};
      answer = await listenOnce();
      
      const intent = checkGlobalIntent(answer);
      if (intent) return { val: '', intent };

      question = retryQ;
    }
    return { val: answer.trim(), intent: null };
  }, [speak, listenOnce, checkGlobalIntent]);

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

  const askPhone = useCallback(async (): Promise<{val: string, intent: any}> => {
    let digits = '';
    let isFirst = true;
    while (digits.length !== 10 && isActiveRef.current) {
      if (!isFirst) {
        await speak(`आपने ${digits.length} अंक बताए। मोबाइल नंबर 10 अंकों का होना चाहिए। कृपया दोबारा पूरा नंबर बताएं।`);
      }
      isFirst = false;

      if (!isActiveRef.current) return {val:'', intent:null};
      const raw = await listenOnce();
      
      const intent = checkGlobalIntent(raw);
      if (intent) return { val: '', intent };

      digits = extractDigits(raw);
      if (!digits && isActiveRef.current) {
        await speak("मुझे नंबर सुनाई नहीं दिया। कृपया दोबारा बताएं।");
        isFirst = true; 
      }
    }
    return { val: digits, intent: null };
  }, [speak, listenOnce, checkGlobalIntent]);

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

  const askSmartDate = useCallback(async (): Promise<{ text: string, dateStr: string, intent: any }> => {
    let resultDate = '';
    let parsedDateStr = '';
    while (isActiveRef.current) {
      const res = await askUntilAnswered(
        resultDate === '' ? "ठीक है। अब कृपया अपनी अपॉइंटमेंट की तारीख बताएं।" : "कृपया कोई और दिन चुनें, जैसे कल या परसों।",
        "मुझे तारीख समझ नहीं आई। कृपया दोबारा बताएं।"
      );
      if (!isActiveRef.current) return { text: '', dateStr: '', intent: null };
      if (res.intent) return { text: '', dateStr: '', intent: res.intent };
      
      resultDate = res.val;
      const parsed = parseDate(resultDate);
      if (parsed.isSunday) {
        await speak("माफ़ कीजिएगा, रविवार को क्लिनिक बंद रहती है।");
      } else {
        parsedDateStr = parsed.dateStr;
        break;
      }
    }
    return { text: resultDate, dateStr: parsedDateStr, intent: null };
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

  const speakTimeInHindi = (timeStr: string) => {
      const map: Record<string, string> = {
        '9:00 AM': 'सुबह नौ बजे', '9:30 AM': 'सुबह साढ़े नौ बजे',
        '10:00 AM': 'सुबह दस बजे', '10:30 AM': 'सुबह साढ़े दस बजे',
        '11:00 AM': 'सुबह ग्यारह बजे', '11:30 AM': 'सुबह साढ़े ग्यारह बजे',
        '12:00 PM': 'दोपहर बारह बजे', '12:30 PM': 'दोपहर साढ़े बारह बजे',
        '1:00 PM': 'दोपहर एक बजे', '1:30 PM': 'दोपहर साढ़े एक बजे',
        '2:00 PM': 'दोपहर दो बजे', '2:30 PM': 'दोपहर साढ़े दो बजे',
        '5:00 PM': 'शाम पांच बजे', '5:30 PM': 'शाम साढ़े पांच बजे',
        '6:00 PM': 'शाम छह बजे', '6:30 PM': 'शाम साढ़े छह बजे',
        '7:00 PM': 'शाम सात बजे'
      };
      return map[timeStr] || timeStr;
  };

  const getAvailableSlots = (dateStr: string) => ALL_SLOTS.filter(s => !isSlotBooked(dateStr, s));

  const askSmartTime = useCallback(async (dateStr: string): Promise<{val: string, intent: any}> => {
    let resultTime = '';
    while (isActiveRef.current) {
      const res = await askUntilAnswered(
        resultTime === '' ? "और कृपया अपना पसंदीदा समय बताएं।" : "कृपया कोई और समय बताएं।",
        "मुझे समय सुनाई नहीं दिया। कृपया दोबारा बताएं, जैसे — 10 बजे या 4 बजे।"
      );
      if (!isActiveRef.current) return {val:'', intent:null};
      if (res.intent) return { val: '', intent: res.intent };
      
      resultTime = res.val;
      const parsedSlot = parseTime(resultTime);
      if (!parsedSlot) {
        return { val: resultTime, intent: null };
      }
      
      if (isSlotBooked(dateStr, parsedSlot)) {
         const available = getAvailableSlots(dateStr);
         const suggestions = available.slice(0, 3).map(speakTimeInHindi).join(', ');
         await speak(`माफ़ कीजिएगा, यह समय पहले से बुक है। इस दिन के लिए उपलब्ध समय हैं: ${suggestions}। आप इनमें से क्या चुनना चाहेंगे?`);
      } else {
         return { val: parsedSlot, intent: null };
      }
    }
    return { val: resultTime, intent: null };
  }, [askUntilAnswered, speak]);

  const runFlow = useCallback(async () => {
    let name = '', phone = '', date = '', time = '';
    let parsedDateStr = '';
    let step = 'name';

    while (isActiveRef.current && step !== 'done') {
      setAgentState('PROCESSING'); await new Promise(r => setTimeout(r, 200));

      if (step === 'name') {
        const res = await askUntilAnswered(
           name ? "कृपया सही नाम बताएं।" : "नमस्ते! डॉक्टर रमेश चावलानी के क्लिनिक में आपका स्वागत है। आपका शुभ नाम क्या है?", 
           "नाम सुनाई नहीं दिया, दोबारा बताएं।"
        );
        if (!isActiveRef.current) return;
        if (res.intent && res.intent !== 'name') { step = res.intent; continue; }
        
        name = res.val;
        step = !phone ? 'phone' : !date ? 'date' : !time ? 'time' : 'confirm';
      } 
      else if (step === 'phone') {
        await speak("ठीक है। कृपया अपना 10 अंकों का मोबाइल नंबर बताएं।");
        if (!isActiveRef.current) return;

        const res = await askPhone();
        if (!isActiveRef.current) return;
        if (res.intent && res.intent !== 'phone') { step = res.intent; continue; }

        phone = res.val;
        step = !date ? 'date' : !time ? 'time' : 'confirm';
      }
      else if (step === 'date') {
        const res = await askSmartDate();
        if (!isActiveRef.current) return;
        if (res.intent && res.intent !== 'date') { step = res.intent; continue; }

        date = res.text;
        parsedDateStr = res.dateStr;
        step = !time ? 'time' : 'confirm';
      }
      else if (step === 'time') {
        const res = await askSmartTime(parsedDateStr);
        if (!isActiveRef.current) return;
        if (res.intent && res.intent !== 'time') { step = res.intent; continue; }

        time = res.val;
        step = 'confirm';
      }
      else if (step === 'confirm') {
        await speak(`क्या मैं आपकी अपॉइंटमेंट बुक कर दूँ?`);
        if (!isActiveRef.current) return;

        let confirmed = false;
        let cancelled = false;
        while (!confirmed && !cancelled && isActiveRef.current && step === 'confirm') {
          const reply = await listenOnce();
          if (!isActiveRef.current) return;
          if (!reply.trim()) continue;

          const intent = checkGlobalIntent(reply) || identifyField(reply);
          if (intent) {
             step = intent;
             break;
          }

          if (isYes(reply)) {
            confirmed = true;
          } else if (isNo(reply)) {
            cancelled = true;
          } else {
            await speak("कृपया 'हाँ' या 'नहीं' में जवाब दें। क्या मैं अपॉइंटमेंट बुक कर दूँ?");
          }
        }
        if (confirmed) step = 'book';
        if (cancelled) step = 'cancel';
      }
      else if (step === 'cancel') {
         await speak("ठीक है, मैंने आपकी अपॉइंटमेंट कैंसिल कर दी है। धन्यवाद।");
         setAgentState('COMPLETED');
         await new Promise(r => setTimeout(r, 3000));
         isActiveRef.current = false;
         setAgentState('IDLE');
         step = 'done';
      }
      else if (step === 'book') {
        patientInfoRef.current = `${name} - ${phone}`;
        dateTimeInfoRef.current = `${parsedDateStr} - ${time}`;

        await speak("बहुत अच्छा! आपकी अपॉइंटमेंट सफलतापूर्वक बुक हो गई है। डॉक्टर रमेश चावलानी आपसे जल्द मिलेंगे। धन्यवाद।");
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
        step = 'done';
      }
    }
  }, [speak, listenOnce, askUntilAnswered, askPhone, askSmartDate, askSmartTime, isYes, isNo, checkGlobalIntent, onAppointmentBooked]);

  const startCall = useCallback(() => {
    if (isActiveRef.current) return; 
    isActiveRef.current = true;

    try { recognitionRef.current?.abort(); } catch (_) {}
    window.speechSynthesis.cancel(); 

    const unlockUtter = new SpeechSynthesisUtterance('');
    unlockUtter.volume = 0;
    window.speechSynthesis.speak(unlockUtter);

    patientInfoRef.current = '';
    dateTimeInfoRef.current = '';
    setTranscript('');
    currentTranscriptRef.current = '';

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
