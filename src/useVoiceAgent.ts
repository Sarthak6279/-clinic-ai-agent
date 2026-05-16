import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchAppointments, getLocalAppointments, isSlotBooked } from './store';

export interface Appointment {
  id: string;
  patientInfo: string;
  dateTimeInfo: string;
  createdAt: string;
}

export type AgentState = 'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED';

// ── Hindi digit words → digit map ──────────────────────────────────────────
const HINDI_DIGITS: Record<string, string> = {
  'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4',
  'पाँच': '5', 'पांच': '5', 'छह': '6', 'छः': '6', 'सात': '7',
  'आठ': '8', 'नौ': '9',
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
};

// Devanagari digit characters → ASCII
const DEVA_DIGIT: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

function extractDigits(text: string): string {
  let s = text;
  for (const [d, a] of Object.entries(DEVA_DIGIT)) s = s.split(d).join(a);
  const words = Object.keys(HINDI_DIGITS).sort((a, b) => b.length - a.length);
  for (const w of words) {
    const re = new RegExp(w, 'gi');
    s = s.replace(re, HINDI_DIGITS[w]);
  }
  return s.replace(/\D/g, '');
}

function tryExtractPhone(text: string): string | null {
  const digits = extractDigits(text);
  if (digits.length === 10) return digits;
  const nonDigitWords = text.trim().split(/\s+/).filter(w => !/^\d+$/.test(w) && !HINDI_DIGITS[w.toLowerCase()] && !Object.keys(DEVA_DIGIT).some(d => w.includes(d)));
  if (nonDigitWords.length === 0 && digits.length >= 8) return digits;
  return null;
}

export function useVoiceAgent(onAppointmentBooked: (appt: Appointment) => void) {
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [transcript, setTranscript] = useState(''); // Keep for internal state if needed, but UI is hidden
  
  const isActiveRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  const collectedRef = useRef({ name: '', phone: '', date: '', time: '' });
  const stepRef = useRef<'name' | 'phone' | 'date' | 'time' | 'confirm'>('name');

  const stopAll = useCallback(() => {
    isActiveRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (synthRef.current) synthRef.current.cancel();
    setAgentState('IDLE');
    setTranscript('');
    collectedRef.current = { name: '', phone: '', date: '', time: '' };
    stepRef.current = 'name';
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) { resolve(); return; }
      setAgentState('SPEAKING');
      // setTranscript(text); // Removed to prevent any leaking
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const voices = synthRef.current.getVoices();
      const hindiVoice = voices.find(v => v.lang.startsWith('hi')) || voices.find(v => v.lang.includes('en-IN'));
      if (hindiVoice) utterance.voice = hindiVoice;

      utterance.onend = () => { if (isActiveRef.current) setAgentState('PROCESSING'); resolve(); };
      utterance.onerror = () => resolve();
      synthRef.current.speak(utterance);
    });
  }, []);

  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) { resolve(''); return; }
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) { resolve(''); return; }

      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 3;

      let timer: any;
      let resolved = false;

      const done = (val: string) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        resolve(val);
      };

      recognition.onstart = () => {
        setAgentState('LISTENING');
        // setTranscript(''); // Removed
        timer = setTimeout(() => { try { recognition.stop(); } catch(e) {} done(''); }, 10000);
      };

      recognition.onresult = (event: any) => {
        let best = '';
        for (let i = 0; i < event.results[0].length; i++) {
          const alt = event.results[0][i].transcript;
          if (!best || alt.length > best.length) best = alt;
        }
        // setTranscript(best); // Removed
        done(best);
      };

      recognition.onerror = () => done('');
      recognition.onend = () => done('');
      try { recognition.start(); } catch (e) { done(''); }
    });
  }, []);

  const callGroq = async (messages: any[]) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.1, // Even lower for stricter output
        max_tokens: 300,
      }),
    });
    if (!res.ok) throw new Error('AI request failed');
    const data = await res.json();
    return data.choices[0].message.content.trim();
  };

  const buildSystemPrompt = (todayStr: string) => {
    const c = collectedRef.current;
    const appointments = getLocalAppointments();
    const bookedList = appointments
      .filter(a => a.status !== 'cancelled')
      .map(a => `${a.date} ${a.time}`)
      .join(' | ') || 'कोई नहीं';

    let slotStatus = '';
    if (c.date && c.time) {
      const isSun = new Date(c.date + 'T12:00:00').getDay() === 0;
      if (isSun) slotStatus = 'तारीख रविवार है — क्लिनिक बंद है।';
      else if (isSlotBooked(c.date, c.time)) slotStatus = 'यह स्लॉट पहले से बुक है।';
      else slotStatus = 'स्लॉट उपलब्ध है।';
    }

    return `तुम डॉक्टर रमेश चावलानी की क्लिनिक की रिसेप्शनिस्ट हो। केवल हिंदी में बात करो।

नियम:
1. COLLECTED DATA में जो जानकारी (✓) है, उसे दोबारा मत पूछना।
2. एक समय में सिर्फ एक सवाल पूछना।
3. समय हमेशा प्राकृतिक हिंदी में बोलना (जैसे: "दो बजे", "साढ़े तीन बजे")। "AM/PM" कभी मत बोलना।
4. यूजर से मिली जानकारी को parse करके JSON में भी देना: {"name":"...", "phone":"...", "date":"YYYY-MM-DD", "time":"H:MM AM/PM"}
5. अगर यूजर तारीख बताए तो YYYY-MM-DD format में JSON देना।
6. जब सब 4 जानकारी (नाम, फोन, तारीख, समय) मिल जाए, तब संक्षेप में पुष्टि मांगना।
7. पुष्टि मिलने पर (हाँ/जी) ही "status":"BOOKED" वाला JSON देना।
8. अपनी सोच या "NEXT QUESTION" जैसा कुछ मत बोलना।

COLLECTED DATA:
- नाम: ${c.name ? `✓ ${c.name}` : 'नहीं मिला'}
- मोबाइल: ${c.phone ? `✓ ${c.phone}` : 'नहीं मिला'}
- तारीख: ${c.date ? `✓ ${c.date}` : 'नहीं मिली'}
- समय: ${c.time ? `✓ ${c.time}` : 'नहीं मिला'}
${slotStatus ? `- स्थिति: ${slotStatus}` : ''}

PUCHHO (सिर्फ एक वाक्य):
${!c.name ? '"कृपया अपना नाम बताइए।"' : !c.phone ? '"आपका मोबाइल नंबर क्या है?"' : !c.date ? '"आप किस तारीख को आना चाहते हैं?"' : !c.time ? '"आप किस समय आना चाहते हैं?"' : '"आपकी जानकारी सही है? क्या मैं अपॉइंटमेंट बुक कर दूँ?"'}

आज: ${todayStr} | पहले से बुक: ${bookedList}`;
  };

  const runConversationalFlow = useCallback(async () => {
    await fetchAppointments();
    const todayStr = new Date().toISOString().split('T')[0];
    stepRef.current = 'name';
    const greet = 'डॉक्टर रमेश चावलानी की क्लिनिक में कॉल करने के लिए धन्यवाद। मैं आपकी अपॉइंटमेंट बुक करने में मदद कर सकती हूँ। कृपया अपना नाम बताइए।';
    let messages: any[] = [
      { role: 'system', content: buildSystemPrompt(todayStr) },
      { role: 'assistant', content: greet },
    ];
    await speak(greet);

    while (isActiveRef.current) {
      const rawText = await listenOnce();
      if (!isActiveRef.current) break;
      if (!rawText.trim()) {
        await speak('माफ़ कीजिये, सुनाई नहीं दिया। दोबारा बोलिए।');
        continue;
      }

      let userText = rawText.trim();
      const step = stepRef.current;

      // Eager Extraction
      if (step === 'name' && !collectedRef.current.name) {
        const nm = userText.replace(/[^\u0900-\u097Fa-zA-Z\s]/g, '').trim();
        if (nm.length >= 2) collectedRef.current.name = nm;
      }
      if (step === 'phone' || (!collectedRef.current.phone && extractDigits(userText).length >= 8)) {
        const digits = tryExtractPhone(userText);
        if (digits && digits.length === 10) {
          collectedRef.current.phone = digits;
          userText = digits;
        }
      }

      messages.push({ role: 'user', content: userText });
      messages[0] = { role: 'system', content: buildSystemPrompt(todayStr) };
      if (messages.length > 10) messages = [messages[0], ...messages.slice(-8)];

      setAgentState('PROCESSING');
      try {
        const aiResponse = await callGroq(messages);
        if (!isActiveRef.current) break;

        const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.name && parsed.name !== '...') collectedRef.current.name = parsed.name;
            if (parsed.phone && parsed.phone !== '...') collectedRef.current.phone = parsed.phone;
            if (parsed.date && parsed.date !== '...') collectedRef.current.date = parsed.date;
            if (parsed.time && parsed.time !== '...') collectedRef.current.time = parsed.time;

            if (parsed.status === 'BOOKED') {
              onAppointmentBooked({
                id: '',
                patientInfo: `${collectedRef.current.name} - ${collectedRef.current.phone}`,
                dateTimeInfo: `${collectedRef.current.date} - ${collectedRef.current.time}`,
                createdAt: new Date().toISOString(),
              });
              setAgentState('COMPLETED');
              await speak('आपकी अपॉइंटमेंट बुक हो गई है। क्लिनिक में मिलते हैं।');
              stopAll();
              return;
            }
          } catch(e){}
        }

        const updated = collectedRef.current;
        if (!updated.name) stepRef.current = 'name';
        else if (!updated.phone) stepRef.current = 'phone';
        else if (!updated.date) stepRef.current = 'date';
        else if (!updated.time) stepRef.current = 'time';
        else stepRef.current = 'confirm';

        const spokenText = aiResponse.replace(/\{[\s\S]*?\}/g, '').trim();
        messages.push({ role: 'assistant', content: aiResponse });
        if (spokenText) await speak(spokenText);
      } catch (err) {
        await speak('माफ़ कीजिये, तकनीकी दिक्कत आ गई।');
        stopAll();
      }
    }
  }, [speak, listenOnce, onAppointmentBooked, stopAll]);

  const startCall = useCallback(() => {
    isActiveRef.current = true;
    runConversationalFlow();
  }, [runConversationalFlow]);

  const endCall = useCallback(() => stopAll(), [stopAll]);

  return { agentState, transcript, startCall, endCall };
}
