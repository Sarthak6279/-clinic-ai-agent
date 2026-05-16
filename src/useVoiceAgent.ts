import { useState, useRef, useCallback } from 'react';
import { fetchAppointments, getLocalAppointments, isSlotBooked } from './store';

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

  // Persistent storage for collected data during the call
  const collectedRef = useRef({
    name: '',
    phone: '',
    date: '',
    time: ''
  });

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
    // Clear data for next call
    collectedRef.current = { name: '', phone: '', date: '', time: '' };
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
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

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
      recognition.continuous = false;

      let timer: any;

      const cleanup = () => {
        clearTimeout(timer);
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
      };

      recognition.onstart = () => {
        setAgentState('LISTENING');
        setTranscript('');
        // Fail-safe timeout
        timer = setTimeout(() => {
          try { recognition.stop(); } catch(e) {}
          resolve('');
        }, 8000);
      };

      recognition.onresult = (event: any) => {
        cleanup();
        const text = event.results[0][0].transcript;
        setTranscript(text);
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

  // Calls our secure server-side proxy at /api/chat
  // The API key lives ONLY in Vercel's environment variables — never in the browser bundle.
  const callGroq = async (messages: any[]) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('AI proxy error:', err);
      throw new Error(err.error || 'AI request failed');
    }

    const data = await res.json();
    return data.choices[0].message.content;
  };

  const runConversationalFlow = useCallback(async () => {
    // Always fetch fresh appointments from Supabase/admin dashboard before starting
    await fetchAppointments();

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const buildSystemPrompt = () => {
      const c = collectedRef.current;
      
      // Proactive availability check to guide the AI
      let availabilityInfo = "Available: Yes";
      if (c.date && c.time) {
        const isSun = new Date(c.date).getDay() === 0;
        const isBooked = isSlotBooked(c.date, c.time);
        if (isSun) availabilityInfo = "Available: NO (Clinic closed on Sunday)";
        else if (isBooked) availabilityInfo = "Available: NO (Slot already booked)";
      }

      const appointments = getLocalAppointments();
      const bookedList = appointments
        .filter(a => a.status !== 'cancelled')
        .map(a => `${a.date} at ${a.time}`)
        .join(', ') || 'None';

      return `आप डॉक्टर रमेश चावलानी की क्लिनिक की रिसेप्शनिस्ट हैं। केवल हिंदी में बात करें।

व्यवहार:
- हमेशा विनम्र, शांत और प्राकृतिक हिंदी में बात करें।
- बातचीत इंसानों जैसी लगे, रोबोट जैसी नहीं।
- छोटे और साफ वाक्य बोलें।
- कोई उदाहरण न दें।
- अनावश्यक जानकारी या लंबे जवाब न दें।
- जानकारी बार-बार रिपीट न करें।
- केवल वही जानकारी दोबारा पूछें जो गलत या अधूरी हो।

क्रम में यह जानकारी लें:
1. नाम
2. मोबाइल नंबर (केवल 10 अंक)
3. तारीख
4. समय

नियम:
- एक समय में केवल एक सवाल पूछें।
- अगर नंबर 10 अंक का नहीं है तो विनम्रता से दोबारा पूछें।
- रविवार को क्लिनिक बंद है। रविवार की तारीख पर दूसरा दिन पूछें।
- अगर BOOKED SLOTS में वो समय है तो कहें यह समय पहले से बुक है और दूसरा समय पूछें।
- अगर उपयोगकर्ता कहे कोई जानकारी गलत है तो केवल वही जानकारी बदलें, बाकी याद रखें।
- सभी जानकारी मिलने के बाद एक बार संक्षेप में पुष्टि करें और confirmation मांगें।
- पुष्टि होने पर (हाँ/जी/सही है) EXACTLY यह JSON और कुछ नहीं:
{"status": "BOOKED", "name": "...", "phone": "...", "date": "YYYY-MM-DD", "time": "HH:MM AM/PM"}

अभी तक मिली जानकारी:
- नाम: ${c.name || 'नहीं मिला'}
- मोबाइल: ${c.phone || 'नहीं मिला'}
- तारीख: ${c.date || 'नहीं मिली'}
- समय: ${c.time || 'नहीं मिला'}
- ${availabilityInfo}

आज की तारीख: ${todayStr}
BOOKED SLOTS (ये समय पहले से बुक हैं, इन पर appointment न करें): ${bookedList}`;
    };

    let messages = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'assistant', content: "डॉक्टर रमेश चावलानी की क्लिनिक में कॉल करने के लिए धन्यवाद। मैं आपकी अपॉइंटमेंट बुक करने में मदद कर सकती हूँ। कृपया अपना नाम बताइए।" }
    ];

    await speak(messages[1].content);

    while (isActiveRef.current) {
      const userText = await listenOnce();
      if (!isActiveRef.current) break;
      
      if (!userText.trim()) {
        await speak("माफ़ कीजिये, मुझे सुनाई नहीं दिया। क्या आप कृपया फिर से बोलेंगे?");
        continue;
      }

      messages.push({ role: 'user', content: userText });
      
      // Update system prompt with latest collected data before calling AI
      messages[0] = { role: 'system', content: buildSystemPrompt() };
      
      // Limit context to keep it fast
      if (messages.length > 8) {
        messages = [messages[0], ...messages.slice(-6)];
      }

      setAgentState('PROCESSING');

      try {
        const aiResponse = await callGroq(messages);
        if (!isActiveRef.current) break;

        // Auto-extract any data the AI might have captured (JSON or partial JSON)
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.name) collectedRef.current.name = parsed.name;
            if (parsed.phone) collectedRef.current.phone = parsed.phone;
            if (parsed.date) collectedRef.current.date = parsed.date;
            if (parsed.time) collectedRef.current.time = parsed.time;

            if (parsed.status === 'BOOKED') {
              onAppointmentBooked({
                id: '',
                patientInfo: `${parsed.name} - ${parsed.phone}`,
                dateTimeInfo: `${parsed.date} - ${parsed.time}`,
                createdAt: new Date().toISOString()
              });
              setAgentState('COMPLETED');
              await speak("आपका धन्यवाद! आपकी अपॉइंटमेंट बुक हो गई है। क्लिनिक में मिलते हैं।");
              stopAll();
              return;
            }
          }
        } catch(e) {}

        messages.push({ role: 'assistant', content: aiResponse });
        await speak(aiResponse);

      } catch (err) {
        console.error("AI Flow Error:", err);
        await speak("माफ़ कीजिये, कुछ तकनीकी दिक्कत आ गई है। कृपया थोड़ी देर बाद कोशिश करें।");
        stopAll();
      }
    }
  }, [speak, listenOnce, onAppointmentBooked, stopAll]);

  const startCall = useCallback(() => {
    isActiveRef.current = true;
    runConversationalFlow();
  }, [runConversationalFlow]);

  const endCall = useCallback(() => {
    stopAll();
  }, [stopAll]);

  return { agentState, transcript, startCall, endCall };
}
