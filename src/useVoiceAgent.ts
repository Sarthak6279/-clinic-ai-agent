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

    return `तुम डॉक्टर रमेश चावलानी की क्लिनिक की रिसेप्शनिस्ट हो। केवल हिंदी में बात करो। छोटे जवाब दो।

नियम:
1. COLLECTED DATA में जो जानकारी है वो दोबारा कभी मत पूछो।
2. एक बार में सिर्फ एक सवाल पूछो।
3. रविवार क्लिनिक बंद है। बुक्ड स्लॉट पर appointment नहीं।
4. सभी 4 जानकारी मिलने पर संक्षेप में बताओ और हाँ/नहीं पूछो।
5. समय हमेशा हिंदी में बोलो — जैसे "तीन बजे", "साढ़े तीन बजे", "दोपहर दो बजे"। कभी "3:00 PM" या "AM/PM" मत बोलो।
6. जब यूजर तारीख या समय बताए, उसे SILENTLY parse करो और ONLY यह JSON दो (बोलो नहीं, सिर्फ JSON):
   {"date":"YYYY-MM-DD"} या {"time":"H:MM AM/PM"}
7. confirmation पर ONLY यह JSON (बाकी कुछ नहीं):
   {"status":"BOOKED","name":"...","phone":"...","date":"YYYY-MM-DD","time":"H:MM AM/PM"}

COLLECTED DATA — इन्हें दोबारा मत पूछो:
- नाम: ${c.name ? `✓ ${c.name}` : 'अभी नहीं मिला'}
- मोबाइल: ${c.phone ? `✓ ${c.phone}` : 'अभी नहीं मिला'}
- तारीख: ${c.date ? `✓ ${c.date}` : 'अभी नहीं मिली'}
- समय: ${c.time ? `✓ ${c.time}` : 'अभी नहीं मिला'}
${slotStatus ? `- स्लॉट स्थिति: ${slotStatus}` : ''}

ABHI YEH PUCHHO (sirf yeh ek sentence bolo, kuch aur nahi):
${!c.name ? '"कृपया अपना नाम बताइए।"' : !c.phone ? '"आपका मोबाइल नंबर क्या है?"' : !c.date ? '"आप किस तारीख को आना चाहते हैं?"' : !c.time ? '"आप किस समय आना चाहते हैं?"' : '"सभी जानकारी मिल गई है — confirm करो।"'}

आज: ${todayStr} | पहले से बुक: ${bookedList}`;
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

      let userText = rawText.trim();
      const c = collectedRef.current;
      const step = stepRef.current;

      // ── EAGER CLIENT-SIDE EXTRACTION ─────────────────────────────────
      // Store each field directly from user speech so COLLECTED DATA is
      // always accurate and the AI never re-asks for known fields.

      if (step === 'name' && !c.name) {
        // Take whatever the user said as their name (strip punctuation)
        const nm = userText.replace(/[^\u0900-\u097Fa-zA-Z\s]/g, '').trim();
        if (nm.length >= 2) {
          collectedRef.current.name = nm;
          console.log('[Name extracted]', nm);
        }
      }

      if (step === 'phone' || (!c.phone && extractDigits(userText).length >= 8)) {
        const digits = tryExtractPhone(userText);
        if (digits && digits.length === 10) {
          collectedRef.current.phone = digits;
          userText = digits; // send clean number to AI
          console.log('[Phone extracted]', rawText, '→', digits);
        }
      }

      // Date and time: let AI parse and format, but mark step progress
      // so the prompt tells AI exactly what's missing

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
            // Always update any field the AI has captured
            if (parsed.name  && parsed.name  !== '...' && parsed.name  !== '—') collectedRef.current.name  = parsed.name;
            if (parsed.phone && parsed.phone !== '...' && parsed.phone !== '—') collectedRef.current.phone = parsed.phone;
            if (parsed.date  && parsed.date  !== '...' && parsed.date  !== '—') collectedRef.current.date  = parsed.date;
            if (parsed.time  && parsed.time  !== '...' && parsed.time  !== '—') collectedRef.current.time  = parsed.time;

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

        // ── Advance step tracker ──────────────────────────────────────
        const updated = collectedRef.current;
        if (!updated.name)        stepRef.current = 'name';
        else if (!updated.phone)  stepRef.current = 'phone';
        else if (!updated.date)   stepRef.current = 'date';
        else if (!updated.time)   stepRef.current = 'time';
        else                      stepRef.current = 'confirm';

        // Remove JSON from spoken text (don't speak raw JSON to user)
        const spokenText = aiResponse.replace(/\{[\s\S]*?\}/g, '').trim();
        messages.push({ role: 'assistant', content: aiResponse });

        if (spokenText) {
          await speak(spokenText);
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
