import { useState, useRef, useCallback, useEffect } from 'react';


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
        model: 'llama3-8b-8192',
        messages: messages,
        temperature: 0.5,
        max_tokens: 300
      })
    });
    
    if (!res.ok) throw new Error("Groq API Error");
    const data = await res.json();
    return data.choices[0].message.content;
  };

  const runConversationalFlow = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are a polite, professional AI receptionist for Dr. Romesh Chawalani (a Hepatologist and Gastroenterologist). 
Your job is to converse naturally with the patient in Hindi and book their appointment.

CRITICAL RULES:
1. Speak ONLY in Hindi using Devanagari script. Do not use English words.
2. Be extremely brief, natural, and conversational. Ask only one question at a time. Do not write long paragraphs.
3. When referring to the doctor, ALWAYS say "डॉक्टर रमेश चावलानी" (never use abbreviations like डॉ. or Dr.).
4. You MUST collect exactly 4 things: Patient Name, Mobile Number, Date, and Time.
5. Clinic hours: Mon-Sat 10AM-2PM & 5PM-8PM. CLOSED on Sundays. Today's date is ${today}.

FLOW:
- Ask for missing details one by one.
- If the patient changes their mind (e.g., "Mera number galat hai", "Date change karni hai"), politely acknowledge and ask for the new detail.
- Once you have all 4 details, summarize them briefly and ask: "क्या मैं आपकी अपॉइंटमेंट बुक कर दूँ?"
- If the patient says yes (हाँ, ठीक है, book kar do), you MUST output ONLY a JSON object and absolutely no other text.

JSON FORMAT (Output this ONLY after patient confirms):
{
  "status": "BOOKED",
  "name": "extracted name",
  "phone": "extracted phone",
  "date": "YYYY-MM-DD",
  "time": "HH:MM AM/PM"
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'assistant', content: "नमस्ते, मैं डॉक्टर रमेश चावलानी का असिस्टेंट बोल रहा हूँ। मैं आपकी अपॉइंटमेंट बुक करने में मदद करूँगा। क्या मैं आपका नाम जान सकता हूँ?" }
    ];

    await speak(messages[1].content);

    while (isActiveRef.current) {
      const userText = await listenOnce();
      if (!isActiveRef.current) break;
      
      if (!userText.trim()) {
        await speak("माफ़ कीजिएगा, मुझे आपकी आवाज़ सुनाई नहीं दी। क्या आप दोहरा सकते हैं?");
        continue;
      }

      messages.push({ role: 'user', content: userText });
      setAgentState('PROCESSING');

      try {
        const aiResponse = await callGroq(messages);
        if (!isActiveRef.current) break;

        // Check if the AI returned JSON indicating booking is confirmed
        if (aiResponse.includes('"status": "BOOKED"') || aiResponse.includes('"status":"BOOKED"')) {
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
          // Otherwise, just speak the AI's response and add to history
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
