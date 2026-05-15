import { useState, useRef, useEffect, useCallback } from 'react';

export type AgentState = 'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED';

export interface Appointment {
  id: string;
  patientInfo: string;
  dateTimeInfo: string;
  createdAt: string;
}

// Speak using browser's native speechSynthesis
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

const SYSTEM_PROMPT = `आप डॉ. रमेश चावलानी के क्लिनिक के AI रिसेप्शनिस्ट हैं।
आपका लक्ष्य मरीज़ से बातचीत करके अपॉइंटमेंट बुक करने के लिए ये 4 जानकारी प्राप्त करना है:
1. नाम (Name)
2. 10-अंकों का मोबाइल नंबर (Mobile Number)
3. अपॉइंटमेंट की तारीख (Date - Note: क्लिनिक रविवार को बंद रहती है)
4. अपॉइंटमेंट का समय (Time)

नियम:
- आप मरीज़ से प्राकृतिक, विनम्र और इंसानी रूप में बातचीत करें।
- एक बार में एक या दो ही सवाल पूछें।
- छोटे वाक्यों का प्रयोग करें।
- अगर मरीज़ कोई सामान्य सवाल पूछता है, तो उसका जवाब दें और फिर से बुकिंग की तरफ ले आएं।
- जब आपके पास चारों जानकारी आ जाएं, तो मरीज़ से एक बार कन्फर्म करें (जैसे: "क्या मैं कन्फर्म कर दूँ? नाम: ... नंबर: ...")
- जब मरीज़ 'हाँ' कर दे, तो आपको "book_appointment" टूल को कॉल करना है। 
- टूल कॉल करने से पहले मत कहें कि अपॉइंटमेंट बुक हो गई है।`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Call this tool ONLY when you have collected and confirmed the name, phone, date, and time.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Patient Name" },
          phone: { type: "string", description: "10 digit mobile number" },
          date: { type: "string", description: "Format: YYYY-MM-DD or spoken date" },
          time: { type: "string", description: "Time like 10:00 AM" }
        },
        required: ["name", "phone", "date", "time"]
      }
    }
  }
];

export function useVoiceAgent(onAppointmentBooked: (appointment: Appointment) => void) {
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [transcript, setTranscript] = useState('');

  const recognitionRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const currentTranscriptRef = useRef('');
  const messagesRef = useRef<any[]>([]);

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

  const runConversationalFlow = useCallback(async () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      alert("⚠️ OpenAI API Key is missing! Please set VITE_OPENAI_API_KEY in your .env file or Vercel dashboard.");
      isActiveRef.current = false;
      setAgentState('IDLE');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const contextPrompt = SYSTEM_PROMPT + `\n\nToday's Date is: ${todayDate}.`;

    messagesRef.current = [{ role: 'system', content: contextPrompt }];
    
    const initialGreeting = "नमस्ते! डॉ. रमेश चावलानी के क्लिनिक में आपका स्वागत है। मैं आपकी अपॉइंटमेंट बुक करने में कैसे मदद कर सकती हूँ?";
    messagesRef.current.push({ role: 'assistant', content: initialGreeting });
    
    await speak(initialGreeting);

    while (isActiveRef.current) {
       const userText = await listenOnce();
       if (!isActiveRef.current) break;
       
       if (!userText.trim()) continue;

       setAgentState('PROCESSING');
       messagesRef.current.push({ role: 'user', content: userText });

       try {
         const response = await fetch('https://api.openai.com/v1/chat/completions', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${apiKey}`
           },
           body: JSON.stringify({
             model: 'gpt-4o-mini',
             messages: messagesRef.current,
             tools: TOOLS,
             tool_choice: 'auto'
           })
         });
         
         const data = await response.json();
         if (data.error) throw new Error(data.error.message);

         const msg = data.choices[0].message;
         messagesRef.current.push(msg);

         if (msg.tool_calls) {
           const toolCall = msg.tool_calls[0];
           if (toolCall.function.name === 'book_appointment') {
             const args = JSON.parse(toolCall.function.arguments);
             
             await speak("बहुत अच्छा! आपकी अपॉइंटमेंट बुक हो गई है। डॉ. रमेश चावलानी आपसे जल्द मिलेंगे। धन्यवाद।");
             if (!isActiveRef.current) return;
             
             onAppointmentBooked({
                id: Math.random().toString(36).substring(7),
                patientInfo: `${args.name} - ${args.phone}`,
                dateTimeInfo: `${args.date} - ${args.time}`,
                createdAt: new Date().toISOString()
             });
             
             setAgentState('COMPLETED');
             await new Promise(r => setTimeout(r, 3000));
             isActiveRef.current = false;
             setAgentState('IDLE');
             return;
           }
         }

         if (msg.content) {
           await speak(msg.content);
         }

       } catch (err) {
         console.error(err);
         await speak("माफ़ कीजिएगा, नेटवर्क में कोई समस्या आ रही है।");
       }
    }
  }, [speak, listenOnce, onAppointmentBooked]);

  const startCall = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;

    try { recognitionRef.current?.abort(); } catch (_) {}
    window.speechSynthesis.cancel();

    const unlockUtter = new SpeechSynthesisUtterance('');
    unlockUtter.volume = 0;
    window.speechSynthesis.speak(unlockUtter);

    setTranscript('');
    currentTranscriptRef.current = '';

    setTimeout(() => {
      if (isActiveRef.current) runConversationalFlow();
    }, 100);
  }, [runConversationalFlow]);

  const endCall = useCallback(() => {
    isActiveRef.current = false;
    window.speechSynthesis.cancel();
    try { recognitionRef.current?.stop(); } catch (_) {}
    setAgentState('IDLE');
  }, []);

  return { agentState, transcript, startCall, endCall };
}
