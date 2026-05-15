import { useState, useEffect } from 'react';
import { loadAppointments, updateAppointmentStatus, deleteAppointment, type BookedSlot } from './store';

function statusColor(s: BookedSlot['status']) {
  return s === 'confirmed' ? '#00a896' : s === 'completed' ? '#0e6d8c' : '#e74c3c';
}

function statusBg(s: BookedSlot['status']) {
  return s === 'confirmed' ? 'rgba(0,168,150,0.1)' : s === 'completed' ? 'rgba(14,109,140,0.1)' : 'rgba(231,76,60,0.1)';
}

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [appointments, setAppointments] = useState<BookedSlot[]>([]);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const reload = () => setAppointments(loadAppointments());

  useEffect(() => {
    reload();
    window.addEventListener('appointments-updated', reload);
    return () => window.removeEventListener('appointments-updated', reload);
  }, []);

  const filtered = appointments
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => !selectedDate || a.date === selectedDate)
    .filter(a =>
      search === '' ||
      a.patientName.toLowerCase().includes(search.toLowerCase()) ||
      a.patientPhone.includes(search)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    today: appointments.filter(a => a.date === new Date().toISOString().slice(0, 10)).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f7f9', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0a4d68,#0e6d8c)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white' }}>
          <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>🩺 Dr. Romesh Chawalani — Admin Dashboard</div>
          <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>Hepatologist & Gastroenterologist · Madan Mahal, Jabalpur</div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '0.5rem 1.25rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          🚪 Logout
        </button>
      </div>

      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Bookings', val: stats.total, color: '#0a4d68', icon: '📋' },
            { label: 'Confirmed', val: stats.confirmed, color: '#00a896', icon: '✅' },
            { label: 'Completed', val: stats.completed, color: '#0e6d8c', icon: '🎯' },
            { label: 'Cancelled', val: stats.cancelled, color: '#e74c3c', icon: '❌' },
            { label: 'Today', val: stats.today, color: '#f59e0b', icon: '📅' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid rgba(5,191,219,0.15)', boxShadow: '0 4px 16px rgba(10,77,104,0.07)' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{s.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7f8e' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 16, padding: '1.25rem 1.5rem', border: '1px solid rgba(5,191,219,0.15)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="🔍 Search patient name or phone..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: '0.65rem 1rem', borderRadius: 10, border: '1.5px solid rgba(5,191,219,0.25)', fontFamily: 'inherit', fontSize: '0.9rem', color: '#1a2332', outline: 'none' }}
          />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '0.65rem 1rem', borderRadius: 10, border: '1.5px solid rgba(5,191,219,0.25)', fontFamily: 'inherit', fontSize: '0.9rem', color: '#1a2332', outline: 'none' }}
          />
          {['all', 'confirmed', 'completed', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f as any)}
              style={{ padding: '0.5rem 1.1rem', borderRadius: 20, border: '1.5px solid', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', background: filter === f ? '#0a4d68' : 'white', color: filter === f ? 'white' : '#0a4d68', borderColor: filter === f ? '#0a4d68' : 'rgba(5,191,219,0.3)' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {selectedDate && <button onClick={() => setSelectedDate('')} style={{ padding: '0.5rem 1rem', borderRadius: 20, border: '1.5px solid #e74c3c', color: '#e74c3c', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600 }}>✕ Clear Date</button>}
        </div>

        {/* Appointments Table */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid rgba(5,191,219,0.15)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(10,77,104,0.07)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(5,191,219,0.12)', fontWeight: 700, color: '#0a4d68', fontSize: '1rem' }}>
            📋 Appointment Records ({filtered.length})
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7f8e' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <div style={{ fontWeight: 600 }}>No appointments found</div>
              <div style={{ fontSize: '0.87rem', marginTop: '0.4rem' }}>Try adjusting your filters</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f8fbfc' }}>
                    {['#', 'Patient', 'Phone', 'Date', 'Time', 'Reason', 'Via', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', color: '#6b7f8e', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(5,191,219,0.12)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(5,191,219,0.08)', transition: 'background 0.2s' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fbfc')} onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <td style={{ padding: '0.9rem 1rem', color: '#6b7f8e', fontWeight: 600 }}>#{i + 1}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#05bfdb,#00e5c8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>
                            {a.patientName.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: '#1a2332' }}>{a.patientName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: '#1a2332' }}>{a.patientPhone}</td>
                      <td style={{ padding: '0.9rem 1rem', color: '#1a2332', whiteSpace: 'nowrap' }}>
                        {new Date(a.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: '#0a4d68', fontWeight: 600 }}>{a.time}</td>
                      <td style={{ padding: '0.9rem 1rem', color: '#6b7f8e', maxWidth: 160 }}>{a.reason || '—'}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{ background: a.bookedVia === 'voice' || a.bookedVia === 'ai' ? 'rgba(5,191,219,0.12)' : 'rgba(10,77,104,0.08)', color: '#0a4d68', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                          {a.bookedVia === 'voice' || a.bookedVia === 'ai' ? '🎙️ AI' : '📝 Form'}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{ background: statusBg(a.status), color: statusColor(a.status), padding: '0.25rem 0.7rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>
                          {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {a.status === 'confirmed' && (
                            <button onClick={() => updateAppointmentStatus(a.id, 'completed')}
                              style={{ background: 'rgba(14,109,140,0.1)', color: '#0e6d8c', border: 'none', borderRadius: 8, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600 }}>Done</button>
                          )}
                          {a.status !== 'cancelled' && (
                            <button onClick={() => updateAppointmentStatus(a.id, 'cancelled')}
                              style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
                          )}
                          <button onClick={() => { if (confirm('Delete this appointment?')) deleteAppointment(a.id); }}
                            style={{ background: 'rgba(231,76,60,0.08)', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
