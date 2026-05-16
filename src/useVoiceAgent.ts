import { useState, useRef, useCallback } from 'react';
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

/**
 * Try to extract a clean digit string from speech input.
 * Handles: Devanagari digits, Hindi word digits, spaced/dashed numbers.
 */
function extractDigits(text: string): string {
  // Replace Devanagari digits
  let s = text;
  for (const [d, a] of Object.entries(DEVA_DIGIT)) s = s.split(d).join(a);

  // Replace Hindi word digits (longest match first)
  const words = Object.keys(HINDI_DIGITS).sort((a, b) => b.length - a.length);
  for (const w of words) {
    const re = new RegExp(w, 'gi');
    s = s.replace(re, HINDI_DIGITS[w]);
  }

  // Extract only digits
  return s.replace(/\D/g, '');
}

/**
 * If the input looks like a phone attempt, return the cleaned 10-digit string.
 * Otherwise return null.
 */
function tryExtractPhone(text: string): string | null {
  const digits = extractDigits(text);
  // Accept 10-digit result
  if (digits.length === 10) return digits;
  // If the original text is mostly digit-like (words/chars), return whatever we got
  const nonDigitWords = text.trim().split(/\s+/).filter(w => !/^\d+$/.test(w) && !HINDI_DIGITS[w.toLowerCase()] && !Object.keys(DEVA_DIGIT).some(d => w.includes(d)));
  if (nonDigitWords.length === 0 && digits.length >= 8) return digits;
  return null;
}

export function useVoiceAgent(onAppointmentBooked: (appt: Appointment) => void) {
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [transcript, setTranscript] = useState('');
  
  const isActiveRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  // What we've collected so far
  const collectedRef = useRef({ name: '', phone: '', date: '', time: '' });
  // Which field we're currently asking for
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
      setTranscript(text);
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
        setTranscript('');
        timer = setTimeout(() => { try { recognition.stop(); } catch(e) {} done(''); }, 10000);
      };

      recognition.onresult = (event: any) => {
        // Pick the best alternative
        let best = '';
        for (let i = 0; i < event.results[0].length; i++) {
          const alt = event.results[0][i].transcript;
          if (!best || alt.length > best.length) best = alt;
        }
        setTranscript(best);
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
        temperature: 0.2,
        max_tokens: 300,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'AI request failed');
    }
    const data = await res.json();
    return data.choices[0].message.content.trim();
  };

  // ── Build the system prompt injecting current known data + live booked slots ──
  const buildSystemPrompt = (todayStr: string) => {
    const c = collectedRef.current;

    // Use getLocalAppointments which reflects the latest Supabase-synced cache
    const appointments = getLocalAppointments();
    const bookedList = appointments
      .filter(a => a.status !== 'cancelled')
      .map(a => `${a.date} ${a.time}`)
      .join(' | ') || 'कोई नहीं';

    // Availability check
    let slotStatus = '';
    if (c.date && c.time) {
      const isSun = new Date(c.date + 'T12:00:00').getDay() === 0;
      const isBooked = isSlotBooked(c.date, c.time);
      if (isSun) slotStatus = 'यह तारीख रविवार है — क्लिनिक बंद है।';
      else if (isBooked) slotStatus = 'यह स्लॉट पहले से बुक है।';
      else slotStatus = 'स्लॉट उपलब्ध है।';
    }

    return `तुम डॉक्टर रमेश चावलानी की क्लिनिक की रिसेप्शनिस्ट हो। केवल हिंदी में बात करो।

STRICT RULES:
1. एक समय में सिर्फ एक सवाल पूछो।
2. नीचे COLLECTED DATA में जो जानकारी पहले से है वो दोबारा मत पूछो।
3. पूछने का क्रम: नाम → मोबाइल नंबर → तारीख → समय → पुष्टि
4. मोबाइल नंबर: यूजर जो भी बोले उसमें से सिर्फ अंक निकालो। अगर 10 अंक हों तो सही मानो।
5. रविवार को क्लिनिक बंद है। बुक्ड स्लॉट पर appointment नहीं हो सकती।
6. सभी जानकारी मिलने पर एक बार संक्षेप में बताओ और हाँ/नहीं पूछो।
7. यूजर हाँ/जी/सही है बोले तो EXACTLY यह JSON output करो और कुछ नहीं:
{"status":"BOOKED","name":"...","phone":"...","date":"YYYY-MM-DD","time":"H:MM AM/PM"}
8. गलत जानकारी हो तो सिर्फ वही बदलो।
9. जानकारी दोहराओ मत। छोटे जवाब दो।

COLLECTED DATA (यह पहले से मिली जानकारी है, दोबारा मत पूछो):
- नाम: ${c.name || '—'}
- मोबाइल: ${c.phone || '—'}
- तारीख: ${c.date || '—'}
- समय: ${c.time || '—'}
${slotStatus ? `- स्लॉट स्थिति: ${slotStatus}` : ''}

आज की तारीख: ${todayStr} (${new Date().toLocaleDateString('hi-IN', { weekday: 'long' })})
पहले से बुक स्लॉट: ${bookedList}`;
  };

  const runConversationalFlow = useCallback(async () => {
    // Sync latest appointments from Supabase before starting
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

      // ── Client-side phone normalization ──────────────────────────────
      let userText = rawText;
      if (stepRef.current === 'phone') {
        const cleaned = tryExtractPhone(rawText);
        if (cleaned) {
          userText = cleaned;
          collectedRef.current.phone = cleaned;
          console.log('[Phone extracted]', rawText, '→', cleaned);
        }
      }

      messages.push({ role: 'user', content: userText });
      messages[0] = { role: 'system', content: buildSystemPrompt(todayStr) };

      // Keep context small and fast
      if (messages.length > 10) {
        messages = [messages[0], ...messages.slice(-8)];
      }

      setAgentState('PROCESSING');

      try {
        const aiResponse = await callGroq(messages);
        if (!isActiveRef.current) break;

        // ── Extract structured data from AI response ──────────────────
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.name)  collectedRef.current.name  = parsed.name;
            if (parsed.phone) collectedRef.current.phone = parsed.phone;
            if (parsed.date)  collectedRef.current.date  = parsed.date;
            if (parsed.time)  collectedRef.current.time  = parsed.time;

            if (parsed.status === 'BOOKED') {
              onAppointmentBooked({
                id: '',
                patientInfo: `${parsed.name} - ${parsed.phone}`,
                dateTimeInfo: `${parsed.date} - ${parsed.time}`,
                createdAt: new Date().toISOString(),
              });
              setAgentState('COMPLETED');
              await speak('आपकी अपॉइंटमेंट बुक हो गई है। क्लिनिक में मिलते हैं।');
              stopAll();
              return;
            }
          }
        } catch (e) {}

        // ── Advance step based on what's been collected ───────────────
        const c = collectedRef.current;
        if (!c.name)        stepRef.current = 'name';
        else if (!c.phone)  stepRef.current = 'phone';
        else if (!c.date)   stepRef.current = 'date';
        else if (!c.time)   stepRef.current = 'time';
        else                stepRef.current = 'confirm';

        messages.push({ role: 'assistant', content: aiResponse });

        // Don't speak if response is the JSON (already handled above)
        if (!aiResponse.includes('"status"')) {
          await speak(aiResponse);
        }

      } catch (err) {
        console.error('AI Flow Error:', err);
        await speak('माफ़ कीजिये, कुछ तकनीकी दिक्कत आ गई। थोड़ी देर बाद कोशिश करें।');
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
