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

    const systemPrompt = `Role: Dr. Chawalani's clinic receptionist.
Language: Strictly Hindi (Devanagari).
Goal: Book appointments sequentially.

Strict Flow:
1. Ask for Name. Wait for answer.
2. Ask for 10-digit Mobile Number. Wait for answer.
3. Ask for Date. Wait for answer.
4. Ask for Time. Wait for answer.
5. If the requested Date & Time is in the "Booked Slots" list below, apologize and ask for a different time.
6. Once all 4 are collected, summarize Name, Number, Date, Time and ask: "क्या यह जानकारी सही है? हाँ या ना?"
7. If user says No (ना), cancel the booking process.
8. If user says Yes (हाँ) to confirm, output EXACTLY this JSON and NOTHING else:
{"status": "BOOKED", "name": "...", "phone": "...", "date": "YYYY-MM-DD", "time": "HH:MM AM/PM"}

Clinic Hours: Mon-Sat 10AM-2PM & 5PM-8PM. Closed Sundays.
Today is ${today}.
Booked Slots (DO NOT BOOK THESE): ${bookedStr || 'None'}`;

    let messages = [
      { role: 'system', content: systemPrompt },
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
      
      // Keep 8 messages to remember context without exceeding 6K TPM limit
      if (messages.length > 9) {
        messages = [messages[0], ...messages.slice(-8)];
      }

      setAgentState('PROCESSING');

      try {
        const aiResponse = await callGroq(messages);
        if (!isActiveRef.current) break;

        const isBooked = /"status"\s*:\s*"BOOKED"/i.test(aiResponse);
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
