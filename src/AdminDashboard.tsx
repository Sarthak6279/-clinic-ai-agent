import { useState, useEffect } from 'react';
import { fetchAppointments, getLocalAppointments, updateAppointmentStatus, deleteAppointment, type BookedSlot } from './store';

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

  const [refreshing, setRefreshing] = useState(false);

  const reload = async () => {
    setRefreshing(true);
    const data = await fetchAppointments();
    setAppointments(data);
    setRefreshing(false);
  };

  useEffect(() => {
    reload();
    window.addEventListener('appointments-updated', reload);
    
    const updateLocal = () => setAppointments(getLocalAppointments());
    window.addEventListener('appointments-updated-local', updateLocal);
    
    return () => {
      window.removeEventListener('appointments-updated', reload);
      window.removeEventListener('appointments-updated-local', updateLocal);
    };
  }, []);

  const filtered = appointments
    .filter(a => filter === 'all' || a?.status === filter)
    .filter(a => !selectedDate || a?.date === selectedDate)
    .filter(a =>
      search === '' ||
      (a?.patientName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a?.patientPhone || '').includes(search)
    )
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a?.status === 'confirmed').length,
    completed: appointments.filter(a => a?.status === 'completed').length,
    cancelled: appointments.filter(a => a?.status === 'cancelled').length,
    today: appointments.filter(a => a?.date === new Date().toISOString().slice(0, 10)).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: '"Inter", -apple-system, sans-serif', color: '#0F172A' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '1rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 40, height: 40, background: '#0F172A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 700, letterSpacing: '-0.5px' }}>
            RC
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', letterSpacing: '-0.3px', color: '#0F172A' }}>Dr. Romesh Chawalani</div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>Clinic Administration</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'} onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}>
          Sign Out
        </button>
      </div>

      <div style={{ padding: '2.5rem', maxWidth: 1280, margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {[
            { label: 'Total Bookings', val: stats.total, color: '#3B82F6' },
            { label: 'Confirmed', val: stats.confirmed, color: '#10B981' },
            { label: 'Completed', val: stats.completed, color: '#6366F1' },
            { label: 'Cancelled', val: stats.cancelled, color: '#EF4444' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#FFFFFF', borderRadius: 12, padding: '1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>{s.label}</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 700, color: s.color, letterSpacing: '-1px' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Filters & Actions */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '1.25rem', border: '1px solid #E2E8F0', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <input
            placeholder="Search patient name or phone..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 260, padding: '0.6rem 1rem', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: '0.9rem', color: '#0F172A', outline: 'none' }}
          />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '0.6rem 1rem', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: '0.9rem', color: '#0F172A', outline: 'none' }}
          />
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 6, padding: '0.25rem' }}>
            {['all', 'confirmed', 'completed', 'cancelled'].map(f => (
              <button key={f} onClick={() => setFilter(f as any)}
                style={{ padding: '0.4rem 1rem', borderRadius: 4, border: 'none', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer', background: filter === f ? '#FFFFFF' : 'transparent', color: filter === f ? '#0F172A' : '#64748B', boxShadow: filter === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {selectedDate && <button onClick={() => setSelectedDate('')} style={{ padding: '0.6rem 1rem', borderRadius: 6, border: '1px solid #E2E8F0', color: '#64748B', background: '#FFF', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500 }}>Clear Date</button>}
          
          <div style={{ flex: 1 }} />
          <button onClick={reload} disabled={refreshing} style={{ padding: '0.6rem 1.25rem', borderRadius: 6, border: 'none', background: '#0F172A', color: '#FFFFFF', fontWeight: 500, fontSize: '0.9rem', cursor: refreshing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'opacity 0.2s', opacity: refreshing ? 0.7 : 1 }}>
            {refreshing ? 'Syncing...' : 'Sync Database'}
          </button>
        </div>

        {/* Appointments Table */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '1.05rem' }}>Appointment Records</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>Showing {filtered.length} entries</div>
          </div>
          
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#94A3B8' }}>
              <div style={{ fontWeight: 500, fontSize: '1rem', color: '#64748B' }}>No appointments found</div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>Adjust your filters or sync the database</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Patient details', 'Contact', 'Schedule', 'Reason', 'Source', 'Status', ''].map((h, i) => (
                      <th key={i} style={{ padding: '1rem 1.5rem', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a?.id || i} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ fontWeight: 500, color: '#0F172A' }}>{a?.patientName || 'Unknown'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.2rem' }}>ID: {(a?.id || '').substring(0, 6)}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>{a?.patientPhone || '—'}</td>
                      <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 500, color: '#0F172A' }}>
                          {(() => {
                            try {
                              if (!a?.date) return '—';
                              const d = new Date(a.date.includes('-') ? a.date + 'T12:00:00' : a.date);
                              if (isNaN(d.getTime())) return a.date;
                              return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                            } catch { return a?.date || '—'; }
                          })()}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.2rem' }}>{a?.time || '—'}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#64748B', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a?.reason || '—'}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{ display: 'inline-block', background: '#F1F5F9', color: '#475569', padding: '0.25rem 0.6rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                          {a?.bookedVia === 'voice' || a?.bookedVia === 'ai' ? 'Voice AI' : 'Web Form'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: a?.status === 'confirmed' ? '#10B981' : a?.status === 'completed' ? '#6366F1' : '#EF4444' }} />
                          <span style={{ color: '#334155', fontSize: '0.85rem', fontWeight: 500 }}>
                            {(a?.status || 'confirmed').charAt(0).toUpperCase() + (a?.status || 'confirmed').slice(1)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          {a?.status === 'confirmed' && (
                            <button onClick={() => updateAppointmentStatus(a.id, 'completed')}
                              style={{ background: '#FFF', border: '1px solid #E2E8F0', color: '#6366F1', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={e => {e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#6366F1'}} onMouseLeave={e => {e.currentTarget.style.background = '#FFF'; e.currentTarget.style.borderColor = '#E2E8F0'}}>Mark Done</button>
                          )}
                          {a?.status !== 'cancelled' && (
                            <button onClick={() => updateAppointmentStatus(a.id, 'cancelled')}
                              style={{ background: '#FFF', border: '1px solid #E2E8F0', color: '#EF4444', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={e => {e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#EF4444'}} onMouseLeave={e => {e.currentTarget.style.background = '#FFF'; e.currentTarget.style.borderColor = '#E2E8F0'}}>Cancel</button>
                          )}
                          <button onClick={() => { if (a?.id && confirm('Delete this appointment completely?')) deleteAppointment(a.id); }}
                            style={{ background: 'transparent', color: '#94A3B8', border: 'none', padding: '0.35rem', cursor: 'pointer', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#EF4444'} onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>✕</button>
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
