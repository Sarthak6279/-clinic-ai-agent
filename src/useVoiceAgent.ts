import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchAppointments, getLocalAppointments, isSlotBooked, ALL_SLOTS } from './store';

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  date: string;        // YYYY-MM-DD
  time: string;        // e.g. "10:00 AM"
  createdAt: string;
  // legacy fields kept for App.tsx compatibility
  patientInfo: string;
  dateTimeInfo: string;
}

export type AgentState = 'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED';

// ── Hindi/Devanagari digit normalizer ───────────────────────────────────────
const HINDI_DIGITS: Record<string, string> = {
  'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4',
  'पाँच': '5', 'पांच': '5', 'छह': '6', 'छः': '6', 'सात': '7',
  'आठ': '8', 'नौ': '9',
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
};
const DEVA_DIGIT: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

function extractDigits(text: string): string {
  let s = text;
  for (const [d, a] of Object.entries(DEVA_DIGIT)) s = s.split(d).join(a);
  const words = Object.keys(HINDI_DIGITS).sort((a, b) => b.length - a.length);
  for (const w of words) s = s.replace(new RegExp(w, 'gi'), HINDI_DIGITS[w]);
  return s.replace(/\D/g, '');
}

function tryExtractPhone(text: string): string | null {
  const digits = extractDigits(text);
  if (digits.length === 10) return digits;
  return null;
}

// ── Parse spoken date (today/kal/परसों/DD-MM/YYYY-MM-DD) ────────────────────
function parseSpokenDate(text: string): string | null {
  const t = text.toLowerCase().trim();
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (/\bआज\b|today/.test(t)) return fmt(today);
  if (/\bकल\b|kal\b|tomorrow/.test(t) && !/परसों/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d);
  }
  if (/परसों|parso/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 2); return fmt(d);
  }
  // ISO format YYYY-MM-DD
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  // DD/MM or DD-MM
  const dmy = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dmy) {
    const day = parseInt(dmy[1]), month = parseInt(dmy[2]);
    const year = dmy[3] ? (dmy[3].length === 2 ? 2000 + parseInt(dmy[3]) : parseInt(dmy[3])) : today.getFullYear();
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12)
      return `${year}-${pad(month)}-${pad(day)}`;
  }
  // spoken digits like "17 May" / "17 मई"
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    जनवरी: 1, फरवरी: 2, मार्च: 3, अप्रैल: 4, मई: 5, जून: 6,
    जुलाई: 7, अगस्त: 8, सितंबर: 9, अक्टूबर: 10, नवंबर: 11, दिसंबर: 12,
  };
  for (const [mName, mNum] of Object.entries(months)) {
    const re = new RegExp(`(\\d{1,2})\\s*${mName}`, 'i');
    const m = t.match(re);
    if (m) {
      const day = parseInt(m[1]);
      return `${today.getFullYear()}-${pad(mNum)}-${pad(day)}`;
    }
  }
  return null;
}

// ── Parse spoken time → match to nearest slot ────────────────────────────────
function parseSpokenTime(text: string): string | null {
  const t = text.toLowerCase();
  // Extract hour and optional minute
  let hour = -1, minute = 0;

  // "साढ़े X" = X:30, "पौने X" = X-1:45, "X बजे" = X:00
  const sadhe = t.match(/साढ़े\s*(\d+)/);
  if (sadhe) { hour = parseInt(sadhe[1]); minute = 30; }
  const paune = t.match(/पौने\s*(\d+)/);
  if (paune) { hour = parseInt(paune[1]) - 1; minute = 45; }

  if (hour === -1) {
    const numeric = t.match(/(\d{1,2})(?::(\d{2}))?/);
    if (numeric) {
      hour = parseInt(numeric[1]);
      minute = numeric[2] ? parseInt(numeric[2]) : 0;
    }
  }
  if (hour === -1) return null;

  // AM/PM detection
  const isPM = /pm|बजे\s*(दोपहर|शाम|रात)|दोपहर|शाम|रात/.test(t);
  const isAM = /am|सुबह/.test(t);
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;

  // Round minute to nearest slot (0 or 30)
  const roundedMin = minute < 15 ? 0 : minute < 45 ? 30 : 0;
  if (minute >= 45) hour += 1;

  // Build slot string and find best match in ALL_SLOTS
  const slotHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const candidate = `${slotHour}:${roundedMin === 0 ? '00' : '30'} ${ampm}`;
  const found = ALL_SLOTS.find(s => s === candidate);
  return found || null;
}

// ── Hindi time string for speaking ──────────────────────────────────────────
function toHindiTime(slot: string): string {
  const [timePart, ampm] = slot.split(' ');
  const [h, m] = timePart.split(':').map(Number);
  const suffix = ampm === 'AM' ? 'सुबह' : h < 17 ? 'दोपहर' : 'शाम';
  const hindiNums = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह'];
  const hStr = h <= 12 ? (hindiNums[h] || String(h)) : (hindiNums[h - 12] || String(h - 12));
  if (m === 0) return `${suffix} ${hStr} बजे`;
  if (m === 30) return `${suffix} साढ़े ${hStr} बजे`;
  return `${suffix} ${hStr} बजकर ${m} मिनट`;
}

// ── Main Hook ────────────────────────────────────────────────────────────────
export function useVoiceAgent(onAppointmentBooked: (appt: Appointment) => void) {
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [transcript] = useState('');

  const isActiveRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const collectedRef = useRef({ name: '', phone: '', date: '', time: '' });
  const stepRef = useRef<'name' | 'phone' | 'date' | 'time' | 'confirm'>('name');

  // ── Load voices once they are ready (fixes cross-device voice inconsistency)
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = synthRef.current.getVoices();
    };
    loadVoices();
    synthRef.current.addEventListener('voiceschanged', loadVoices);
    return () => synthRef.current.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const getBestVoice = (): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current.length ? voicesRef.current : synthRef.current.getVoices();
    return (
      voices.find(v => v.lang === 'hi-IN' && v.name.toLowerCase().includes('google')) ||
      voices.find(v => v.lang === 'hi-IN') ||
      voices.find(v => v.lang.startsWith('hi')) ||
      voices.find(v => v.lang === 'en-IN' && v.name.toLowerCase().includes('google')) ||
      voices.find(v => v.lang.startsWith('en-IN')) ||
      null
    );
  };

  const stopAll = useCallback(() => {
    isActiveRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    if (synthRef.current) synthRef.current.cancel();
    setAgentState('IDLE');
    collectedRef.current = { name: '', phone: '', date: '', time: '' };
    stepRef.current = 'name';
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) { resolve(); return; }
      setAgentState('SPEAKING');
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      const voice = getBestVoice();
      if (voice) utterance.voice = voice;
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
        timer = setTimeout(() => { try { recognition.stop(); } catch (e) {} done(''); }, 10000);
      };
      recognition.onresult = (event: any) => {
        let best = '';
        for (let i = 0; i < event.results[0].length; i++) {
          const alt = event.results[0][i].transcript;
          if (!best || alt.length > best.length) best = alt;
        }
        done(best);
      };
      recognition.onerror = () => done('');
      recognition.onend = () => done('');
      try { recognition.start(); } catch (e) { done(''); }
    });
  }, []);

  // ── Pure state-machine conversation — NO LLM for field collection ────────
  const runConversationalFlow = useCallback(async () => {
    await fetchAppointments();
    collectedRef.current = { name: '', phone: '', date: '', time: '' };
    stepRef.current = 'name';

    await speak('डॉक्टर रमेश चावलानी की क्लिनिक में कॉल करने के लिए धन्यवाद। मैं आपकी अपॉइंटमेंट बुक करने में मदद करूँगी। कृपया अपना पूरा नाम बताइए।');

    // ── STEP 1: Name ──────────────────────────────────────────────────────
    while (isActiveRef.current && !collectedRef.current.name) {
      const raw = await listenOnce();
      if (!isActiveRef.current) return;
      if (!raw.trim()) { await speak('माफ़ कीजिये, सुनाई नहीं दिया। अपना नाम बताइए।'); continue; }
      const nm = raw.replace(/[^\u0900-\u097Fa-zA-Z\s]/g, '').trim();
      if (nm.length < 2) { await speak('नाम सही से सुनाई नहीं दिया। कृपया दोबारा बोलिए।'); continue; }
      collectedRef.current.name = nm;
      await speak(`${nm}, आपका मोबाइल नंबर बताइए।`);
    }

    // ── STEP 2: Phone ─────────────────────────────────────────────────────
    let phoneRetries = 0;
    while (isActiveRef.current && !collectedRef.current.phone) {
      const raw = await listenOnce();
      if (!isActiveRef.current) return;
      const phone = tryExtractPhone(raw);
      if (phone) {
        collectedRef.current.phone = phone;
        await speak(`${phone.split('').join(' ')}। क्या यह नंबर सही है?`);
        const confirm = await listenOnce();
        if (!isActiveRef.current) return;
        if (/नहीं|no|गलत|बदल/.test(confirm.toLowerCase())) {
          collectedRef.current.phone = '';
          await speak('ठीक है, मोबाइल नंबर दोबारा बताइए।');
          continue;
        }
      } else {
        phoneRetries++;
        if (phoneRetries >= 3) { await speak('माफ़ कीजिये, नंबर सुनाई नहीं दिया। बाद में फिर कॉल करें।'); stopAll(); return; }
        await speak(`${raw.trim() ? 'यह 10 अंकों का नंबर नहीं है।' : 'सुनाई नहीं दिया।'} दोबारा 10 अंकों का मोबाइल नंबर बताइए।`);
        continue;
      }
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      await speak(`धन्यवाद। आप किस तारीख को आना चाहते हैं? आज ${today.getDate()} ${['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'][today.getMonth()]} है।`);
    }

    // ── STEP 3: Date ──────────────────────────────────────────────────────
    let dateRetries = 0;
    while (isActiveRef.current && !collectedRef.current.date) {
      const raw = await listenOnce();
      if (!isActiveRef.current) return;
      const parsed = parseSpokenDate(raw);
      if (!parsed) {
        dateRetries++;
        if (dateRetries >= 3) { await speak('तारीख समझ नहीं आई। बाद में फिर कॉल करें।'); stopAll(); return; }
        await speak('तारीख सही से सुनाई नहीं दी। कृपया दोबारा बताइए, जैसे "कल" या "17 मई"।');
        continue;
      }
      // Check Sunday
      const dayOfWeek = new Date(parsed + 'T12:00:00').getDay();
      if (dayOfWeek === 0) {
        await speak('रविवार को क्लिनिक बंद रहती है। कोई और दिन बताइए।');
        continue;
      }
      // Check past date
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(parsed + 'T12:00:00') < today) {
        await speak('यह तारीख बीत चुकी है। आगे की कोई तारीख बताइए।');
        continue;
      }
      collectedRef.current.date = parsed;
      await speak('आप किस समय आना चाहते हैं? जैसे "दस बजे" या "साढ़े तीन बजे"।');
    }

    // ── STEP 4: Time ──────────────────────────────────────────────────────
    let timeRetries = 0;
    while (isActiveRef.current && !collectedRef.current.time) {
      const raw = await listenOnce();
      if (!isActiveRef.current) return;
      const slot = parseSpokenTime(raw);
      if (!slot) {
        timeRetries++;
        if (timeRetries >= 3) { await speak('समय समझ नहीं आया। बाद में फिर कॉल करें।'); stopAll(); return; }
        await speak('समय सही से समझ नहीं आया। जैसे "दस बजे" या "दोपहर दो बजे" बोलिए।');
        continue;
      }
      // Check if slot already booked
      if (isSlotBooked(collectedRef.current.date, slot)) {
        // suggest next available
        const available = ALL_SLOTS.find(s => !isSlotBooked(collectedRef.current.date, s));
        const suggestion = available ? ` अगला खाली समय ${toHindiTime(available)} है।` : '';
        await speak(`यह समय पहले से बुक है।${suggestion} कोई और समय बताइए।`);
        continue;
      }
      collectedRef.current.time = slot;
    }

    // ── STEP 5: Confirm ───────────────────────────────────────────────────
    if (!isActiveRef.current) return;
    const c = collectedRef.current;
    const dateObj = new Date(c.date + 'T12:00:00');
    const days = ['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'];
    const months = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];
    const dateStr = `${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]}`;

    await speak(`ठीक है। ${c.name} जी, आपकी अपॉइंटमेंट ${dateStr} को ${toHindiTime(c.time)} के लिए बुक की जा रही है। मोबाइल नंबर ${c.phone.split('').join(' ')}। क्या यह सब सही है?`);

    const confirmReply = await listenOnce();
    if (!isActiveRef.current) return;

    if (/हाँ|हां|जी|सही|yes|okay|ठीक/.test(confirmReply.toLowerCase())) {
      // ── BOOK ──
      onAppointmentBooked({
        id: '',
        patientName: c.name,
        patientPhone: c.phone,
        date: c.date,
        time: c.time,
        createdAt: new Date().toISOString(),
        patientInfo: `${c.name} - ${c.phone}`,
        dateTimeInfo: `${c.date} - ${c.time}`,
      });
      setAgentState('COMPLETED');
      await speak(`बहुत अच्छा! ${c.name} जी, आपकी अपॉइंटमेंट सफलतापूर्वक बुक हो गई है। ${dateStr} को ${toHindiTime(c.time)} पर क्लिनिक में आइए। धन्यवाद।`);
      stopAll();
    } else {
      // Ask what to fix
      await speak('ठीक है। क्या बदलना है — नाम, नंबर, तारीख, या समय?');
      const fix = await listenOnce();
      if (!isActiveRef.current) return;
      const f = fix.toLowerCase();
      if (/नाम|naam|name/.test(f)) {
        collectedRef.current.name = '';
        stepRef.current = 'name';
        await speak('ठीक है, नाम दोबारा बताइए।');
      } else if (/नंबर|number|phone|मोबाइल/.test(f)) {
        collectedRef.current.phone = '';
        await speak('ठीक है, मोबाइल नंबर दोबारा बताइए।');
      } else if (/तारीख|date/.test(f)) {
        collectedRef.current.date = '';
        collectedRef.current.time = '';
        await speak('ठीक है, तारीख दोबारा बताइए।');
      } else if (/समय|time|बजे/.test(f)) {
        collectedRef.current.time = '';
        await speak('ठीक है, समय दोबारा बताइए।');
      } else {
        await speak('माफ़ कीजिये, समझ नहीं आया। कॉल फिर से करें।');
        stopAll();
        return;
      }
      // Restart from the cleared field
      runConversationalFlow();
    }
  }, [speak, listenOnce, onAppointmentBooked, stopAll]);

  const startCall = useCallback(() => {
    isActiveRef.current = true;
    runConversationalFlow();
  }, [runConversationalFlow]);

  const endCall = useCallback(() => stopAll(), [stopAll]);

  return { agentState, transcript, startCall, endCall };
}
