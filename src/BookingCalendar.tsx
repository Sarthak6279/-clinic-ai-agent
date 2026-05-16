import React, { useState, useEffect } from 'react';
import { ALL_SLOTS, APPOINTMENTS_STORAGE_KEY, isSlotBooked, saveAppointment, generateId, type BookedSlot } from './store';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isSunday(y: number, m: number, d: number) {
  return new Date(y, m, d).getDay() === 0;
}

function isPast(y: number, m: number, d: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(y, m, d) < today;
}

export default function BookingCalendar({ onClose }: { onClose?: () => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [step, setStep] = useState<'calendar' | 'slots' | 'form' | 'success'>('calendar');
  const [bookedMap, setBookedMap] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ name: '', phone: '', reason: '' });
  const [mode, setMode] = useState<'clinic' | 'online'>('clinic');
  const [submitting, setSubmitting] = useState(false);

  // Rebuild booked map when appointments change
  useEffect(() => {
    const rebuild = () => {
      const map: Record<string, boolean> = {};
      ALL_SLOTS.forEach(slot => {
        if (selectedDate) map[slot] = isSlotBooked(selectedDate, slot);
      });
      setBookedMap({ ...map });
    };
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === APPOINTMENTS_STORAGE_KEY) {
        rebuild();
      }
    };

    rebuild();
    window.addEventListener('appointments-updated', rebuild);
    window.addEventListener('appointments-updated-local', rebuild);
    window.addEventListener('storage', syncFromStorage);

    return () => {
      window.removeEventListener('appointments-updated', rebuild);
      window.removeEventListener('appointments-updated-local', rebuild);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, [selectedDate]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const handleDayClick = (d: number) => {
    const dateStr = formatDate(year, month, d);
    if (isPast(year, month, d) || isSunday(year, month, d)) return;
    setSelectedDate(dateStr);
    setSelectedTime('');
    setStep('slots');
  };

  const handleSlotClick = (slot: string) => {
    if (bookedMap[slot]) return;
    setSelectedTime(slot);
    setStep('form');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSubmitting(true);
    setTimeout(async () => {
      const apt: BookedSlot = {
        id: generateId(),
        date: selectedDate,
        time: selectedTime,
        patientName: form.name,
        patientPhone: form.phone,
        reason: form.reason,
        bookedVia: 'form',
        createdAt: new Date().toISOString(),
        status: 'confirmed',
      };
      await saveAppointment(apt);
      setSubmitting(false);
      setStep('success');
    }, 800);
  };

  const reset = () => { setStep('calendar'); setSelectedDate(''); setSelectedTime(''); setForm({ name: '', phone: '', reason: '' }); };

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const displayDate = selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 720, margin: '0 auto', background: 'white', borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(10,77,104,0.14)', border: '1px solid rgba(5,191,219,0.15)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0a4d68,#0e6d8c)', padding: '1.5rem 2rem', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>📅 Book an Appointment</div>
          <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>Dr. Romesh Chawalani · 22 slots/day · 30 min each</div>
        </div>
        {onClose && <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(5,191,219,0.12)' }}>
        {['Select Date', 'Choose Time', 'Your Details', 'Confirmed'].map((s, i) => {
          const stepIdx = ['calendar','slots','form','success'].indexOf(step);
          return (
            <div key={i} style={{ flex: 1, padding: '0.75rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: i <= stepIdx ? '#0a4d68' : '#bbb', borderBottom: i === stepIdx ? '2px solid #05bfdb' : '2px solid transparent' }}>
              <span style={{ color: i < stepIdx ? '#00a896' : i === stepIdx ? '#05bfdb' : '#bbb' }}>{i < stepIdx ? '✓ ' : `${i + 1}. `}</span>{s}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '2rem' }}>
        {/* STEP 1: Calendar */}
        {step === 'calendar' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <button onClick={prevMonth} style={{ background: 'rgba(5,191,219,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', color: '#0a4d68', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0a4d68' }}>{monthName}</div>
              <button onClick={nextMonth} style={{ background: 'rgba(5,191,219,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', color: '#0a4d68', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.5rem' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: d === 'Sun' ? '#e74c3c' : '#6b7f8e', padding: '0.4rem' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const past = isPast(year, month, d);
                const sun = isSunday(year, month, d);
                const dateStr = formatDate(year, month, d);
                const isToday = dateStr === formatDate(today.getFullYear(), today.getMonth(), today.getDate());
                const disabled = past || sun;
                return (
                  <button key={d} onClick={() => handleDayClick(d)} disabled={disabled}
                    style={{ padding: '0.7rem 0.25rem', borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem', background: disabled ? 'transparent' : isToday ? 'linear-gradient(135deg,#0a4d68,#05bfdb)' : 'rgba(5,191,219,0.08)', color: disabled ? '#ccc' : isToday ? 'white' : sun ? '#e74c3c' : '#0a4d68', transition: 'all 0.15s' }}>
                    {d}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: '#6b7f8e' }}>
              <span>✅ Available</span><span style={{ color: '#e74c3c' }}>🚫 Sunday (Closed)</span><span style={{ color: '#bbb' }}>Past dates</span>
            </div>
          </div>
        )}

        {/* STEP 2: Time Slots */}
        {step === 'slots' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: '#0a4d68', fontSize: '1rem' }}>📅 {displayDate}</div>
              <div style={{ fontSize: '0.82rem', color: '#6b7f8e', marginTop: '0.25rem' }}>Select a 30-minute slot</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {ALL_SLOTS.map(slot => {
                const booked = bookedMap[slot];
                return (
                  <button key={slot} onClick={() => handleSlotClick(slot)} disabled={booked}
                    style={{ padding: '0.7rem 0.5rem', borderRadius: 12, border: `1.5px solid ${booked ? '#eee' : 'rgba(5,191,219,0.3)'}`, cursor: booked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', background: booked ? '#f5f5f5' : 'white', color: booked ? '#bbb' : '#0a4d68', transition: 'all 0.15s', position: 'relative' }}>
                    {slot}
                    {booked && <div style={{ fontSize: '0.65rem', color: '#e74c3c', fontWeight: 700 }}>Booked</div>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep('calendar')} style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: '#05bfdb', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>← Change Date</button>
          </div>
        )}

        {/* STEP 3: Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(5,191,219,0.08)', borderRadius: 12, padding: '1rem', marginBottom: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: '0.78rem', color: '#6b7f8e' }}>Date</div><div style={{ fontWeight: 700, color: '#0a4d68' }}>{displayDate}</div></div>
              <div><div style={{ fontSize: '0.78rem', color: '#6b7f8e' }}>Time</div><div style={{ fontWeight: 700, color: '#0a4d68' }}>{selectedTime}</div></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.85rem 1rem', borderRadius: 12, border: `2px solid ${mode === 'clinic' ? '#0a4d68' : 'rgba(5,191,219,0.25)'}`, cursor: 'pointer', textAlign: 'center' }} onClick={() => setMode('clinic')}>
                <div>🏥</div><div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0a4d68' }}>Clinic Visit</div><div style={{ fontSize: '0.78rem', color: '#6b7f8e' }}>₹400</div>
              </div>
              <div style={{ padding: '0.85rem 1rem', borderRadius: 12, border: `2px solid ${mode === 'online' ? '#0a4d68' : 'rgba(5,191,219,0.25)'}`, cursor: 'pointer', textAlign: 'center' }} onClick={() => setMode('online')}>
                <div>💻</div><div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0a4d68' }}>Online</div><div style={{ fontSize: '0.78rem', color: '#6b7f8e' }}>₹300</div>
              </div>
            </div>

            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full Name *"
              style={{ padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid rgba(5,191,219,0.25)', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', color: '#1a2332' }} />
            <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Mobile Number * (10 digits)"
              style={{ padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid rgba(5,191,219,0.25)', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', color: '#1a2332' }} />
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for visit (optional)"
              style={{ padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid rgba(5,191,219,0.25)', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', color: '#1a2332' }} />

            <button type="submit" disabled={submitting || !form.name || !form.phone}
              style={{ background: 'linear-gradient(135deg,#0a4d68,#05bfdb)', color: 'white', padding: '1rem', borderRadius: 12, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
              {submitting ? '⏳ Booking...' : '✅ Confirm Appointment'}
            </button>
            <button type="button" onClick={() => setStep('slots')} style={{ background: 'none', border: 'none', color: '#05bfdb', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer' }}>← Change Time</button>
          </form>
        )}

        {/* STEP 4: Success */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#0a4d68', marginBottom: '0.5rem' }}>Appointment Confirmed!</div>
            <div style={{ color: '#6b7f8e', marginBottom: '1.5rem', fontSize: '0.95rem' }}>Your appointment has been booked successfully.</div>
            <div style={{ background: 'rgba(5,191,219,0.08)', borderRadius: 16, padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div><span style={{ fontWeight: 600, color: '#0a4d68' }}>Patient:</span> <span style={{ color: '#1a2332' }}>{form.name}</span></div>
                <div><span style={{ fontWeight: 600, color: '#0a4d68' }}>Date:</span> <span style={{ color: '#1a2332' }}>{displayDate}</span></div>
                <div><span style={{ fontWeight: 600, color: '#0a4d68' }}>Time:</span> <span style={{ color: '#1a2332' }}>{selectedTime}</span></div>
                <div><span style={{ fontWeight: 600, color: '#0a4d68' }}>Location:</span> <span style={{ color: '#1a2332' }}>Madan Mahal, Jabalpur</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={reset} style={{ background: 'linear-gradient(135deg,#0a4d68,#05bfdb)', color: 'white', padding: '0.85rem 2rem', borderRadius: 50, border: 'none', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Book Another</button>
              {onClose && <button onClick={onClose} style={{ background: 'white', color: '#0a4d68', padding: '0.85rem 2rem', borderRadius: 50, border: '2px solid rgba(5,191,219,0.3)', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Close</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
