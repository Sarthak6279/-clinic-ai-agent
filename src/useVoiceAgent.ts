import { useState, useRef, useCallback, useEffect } from 'react';
import { getLocalAppointments } from './store';

export interface Appointment {
  id: string;
  patientInfo: string;
  dateTimeInfo: string;
  createdAt: string;
}

export type AgentState = 'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED';

export function useVoiceAgent(onAppointmentBooked: (appt: Appointment) => void) {
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [transcript, setTranscript] = useState('');
  
  const isActiveRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  const stopAll = useCallback(() => {
    isActiveRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setAgentState('IDLE');
    setTranscript('');
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) {
        resolve();
        return;
      }

      setAgentState('SPEAKING');
      setTranscript(text);

      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      const voices = synthRef.current.getVoices();
      const hindiVoice = voices.find(v => v.lang.includes('hi')) || voices.find(v => v.lang.includes('en-IN'));
      if (hindiVoice) utterance.voice = hindiVoice;

      utterance.onend = () => {
        if (isActiveRef.current) setAgentState('PROCESSING');
        resolve();
      };
      utterance.onerror = () => {
        resolve();
      };

      synthRef.current.speak(utterance);
    });
  }, []);

  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) {
        resolve('');
        return;
      }

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        resolve('');
        return;
      }

      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let timer: any;

      const cleanup = () => {
        clearTimeout(timer);
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
      };

      recognition.onstart = () => {
        if (!isActiveRef.current) {
          recognition.stop();
          return;
        }
        setAgentState('LISTENING');
        setTranscript('');
        
        timer = setTimeout(() => {
          recognition.stop();
        }, 15000); // 15s max listening
      };

      recognition.onresult = (event: any) => {
        cleanup();
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setAgentState('PROCESSING');
        resolve(text);
      };

      recognition.onerror = () => {
        cleanup();
        resolve('');
      };

      recognition.onend = () => {
        cleanup();
        resolve('');
      };

      try {
        recognition.start();
      } catch (e) {
        resolve('');
      }
    });
  }, []);

  const callGroq = async (messages: any[]) => {
    const key = import.meta.env.VITE_GROQ_API_KEY;
    if (!key) throw new Error("Groq API key not found");

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages,
        temperature: 0.5,
        max_tokens: 150
      })
    });
    
    if (!res.ok) {
      const errBody = await res.text();
      console.error("Groq API failed:", errBody);
      throw new Error("Groq API Error");
    }
    const data = await res.json();
    return data.choices[0].message.content;
  };

  const runConversationalFlow = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const appts = getLocalAppointments();
    const bookedByDate = appts.reduce((acc, curr) => {
      if (curr.status !== 'cancelled') {
        if (!acc[curr.date]) acc[curr.date] = [];
        acc[curr.date].push(curr.time);
      }
      return acc;
    }, {} as Record<string, string[]>);
    const bookedStr = Object.entries(bookedByDate).map(([d, times]) => `${d} (${times.join(', ')})`).join(' | ');

    // ✅ KEY FIX: Track collected data OUTSIDE message history so it survives truncation
    const collected: { name?: string; phone?: string; date?: string; time?: string } = {};

    const buildSystemPrompt = () => {
      // Build a summary of what we already know so AI never asks again
      const alreadyKnown = [
        collected.name   ? `Name already collected: "${collected.name}" — DO NOT ask for name again.` : '',
        collected.phone  ? `Phone already collected: "${collected.phone}" — DO NOT ask for phone again.` : '',
        collected.date   ? `Date already collected: "${collected.date}" — DO NOT ask for date again.` : '',
        collected.time   ? `Time already collected: "${collected.time}" — DO NOT ask for time again.` : '',
      ].filter(Boolean).join('\n');

      return `Role: Dr. Chawalani's clinic receptionist.
Language: Strictly Hindi (Devanagari).
Goal: Book appointments. Ask ONLY for what is missing — never repeat a question for something already collected.

ALREADY COLLECTED (do NOT ask again):
${alreadyKnown || 'Nothing collected yet.'}

Strict Flow (skip steps already done):
1. If name missing → ask name.
2. If phone missing → ask 10-digit mobile number.
3. If date missing → ask preferred date.
4. If time missing → ask preferred time. If the Date+Time is in Booked Slots below, apologize and ask for a different time ONLY — do not ask for name/phone/date again.
5. Once all 4 collected → summarize and ask: "क्या यह जानकारी सही है? हाँ या ना?"
6. If user says Yes (हाँ) → output EXACTLY this JSON and NOTHING else:
{"status": "BOOKED", "name": "${collected.name || '...'}", "phone": "${collected.phone || '...'}", "date": "YYYY-MM-DD", "time": "HH:MM AM/PM"}
7. If user says No (ना) → say sorry and end the call.

Clinic Hours: Mon-Sat 10AM-2PM & 5PM-8PM. Closed Sundays.
Today is ${today}.
Booked Slots (DO NOT BOOK THESE): ${bookedStr || 'None'}`;
    };

    let messages = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'assistant', content: "डॉक्टर चावलानी के क्लिनिक में कॉल करने के लिए धन्यवाद। मैं आपकी अपॉइंटमेंट बुक करने में मदद करुँगी। कृपया अपना नाम बताएं।" }
    ];

    await speak(messages[1].content);

    while (isActiveRef.current) {
      const userText = await listenOnce();
      if (!isActiveRef.current) break;
      
      if (!userText.trim()) {
        await speak("माफ़ कीजिएगा, आवाज़ नहीं आई। कृपया फिर से बोलें?");
        continue;
      }

      messages.push({ role: 'user', content: userText });
      
      // Keep last 6 conversation turns but ALWAYS replace system prompt with fresh collected state
      if (messages.length > 7) {
        messages = [{ role: 'system', content: buildSystemPrompt() }, ...messages.slice(-6)];
      } else {
        // Always keep system prompt current with latest collected data
        messages[0] = { role: 'system', content: buildSystemPrompt() };
      }

      setAgentState('PROCESSING');

      try {
        const aiResponse = await callGroq(messages);
        if (!isActiveRef.current) break;

        // ✅ Extract collected data from the FULL JSON if AI outputs it (for partial/final booking)
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.name)  collected.name  = parsed.name;
            if (parsed.phone) collected.phone = parsed.phone;
            if (parsed.date)  collected.date  = parsed.date;
            if (parsed.time)  collected.time  = parsed.time;
          }
        } catch { /* not JSON, that's fine */ }

        // ✅ Also infer what the user just said based on context — update collected accordingly.
        // If AI just asked for name (last AI msg asked for name) and user replied, store it.
        const assistantMsgs = messages.filter(m => m.role === 'assistant');
        const lastAiMsg = assistantMsgs[assistantMsgs.length - 1]?.content || '';
        const nameQ  = /नाम/.test(lastAiMsg);
        const phoneQ = /नंबर|मोबाइल|number/.test(lastAiMsg);
        const dateQ  = /तारीख|date|दिनांक/.test(lastAiMsg);
        const timeQ  = /समय|time|बजे/.test(lastAiMsg);
        
        if (nameQ  && !collected.name  && userText.trim().length > 1) collected.name  = userText.trim();
        if (phoneQ && !collected.phone && /\d{5,}/.test(userText))     collected.phone = userText.trim();
        if (dateQ  && !collected.date  && userText.trim().length > 2)  collected.date  = userText.trim();
        if (timeQ  && !collected.time  && userText.trim().length > 1)  collected.time  = userText.trim();

        const isBooked = /\"status\"\s*:\s*\"BOOKED\"/i.test(aiResponse);
        if (isBooked) {
          try {
            const jsonStr = aiResponse.substring(aiResponse.indexOf('{'), aiResponse.lastIndexOf('}') + 1);
            const data = JSON.parse(jsonStr);
            
            await speak("बहुत अच्छा! आपकी अपॉइंटमेंट सफलतापूर्वक बुक हो गई है। डॉक्टर रमेश चावलानी आपसे जल्द मिलेंगे। धन्यवाद।");
            
            onAppointmentBooked({
              id: Math.random().toString(36).substring(7),
              patientInfo: `${data.name} - ${data.phone}`,
              dateTimeInfo: `${data.date} - ${data.time}`,
              createdAt: new Date().toISOString()
            });
            
            setAgentState('COMPLETED');
            await new Promise(r => setTimeout(r, 3000));
            stopAll();
            break;
          } catch (e) {
            console.error("JSON parse error from AI:", e);
            messages.push({ role: 'assistant', content: aiResponse });
            await speak(aiResponse);
          }
        } else {
          messages.push({ role: 'assistant', content: aiResponse });
          await speak(aiResponse);
        }

      } catch (e) {
        console.error("Groq Error:", e);
        await speak("माफ़ कीजिएगा, नेटवर्क में कुछ परेशानी आ रही है। कृपया थोड़ी देर बाद फिर से कोशिश करें।");
        stopAll();
        break;
      }
    }
  }, [speak, listenOnce, stopAll, onAppointmentBooked]);

  const startCall = useCallback(() => {
    if (isActiveRef.current) return;
    
    // Check if API key is present
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      alert("⚠️ Groq API key is missing. Please add VITE_GROQ_API_KEY to your Vercel Environment Variables.");
      return;
    }

    isActiveRef.current = true;
    
    // Ensure voices are loaded before starting
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        if (isActiveRef.current && agentState === 'IDLE') runConversationalFlow();
      };
    } else {
      runConversationalFlow();
    }
  }, [runConversationalFlow, agentState]);

  const endCall = useCallback(() => {
    stopAll();
  }, [stopAll]);

  // Load voices on mount
  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  return { agentState, transcript, startCall, endCall };
}
