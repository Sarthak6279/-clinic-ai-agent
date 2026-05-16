import { createClient } from '@supabase/supabase-js';

export interface BookedSlot {
  id: string;
  date: string;        // YYYY-MM-DD
  time: string;        // "09:00 AM"
  patientName: string;
  patientPhone: string;
  reason: string;
  bookedVia: 'form' | 'voice' | 'ai';
  createdAt: string;
  status: 'confirmed' | 'cancelled' | 'completed';
}

type AppointmentRecord = Partial<BookedSlot> & {
  created_at?: string;
  booked_via?: string;
  patient_name?: string;
  patient_phone?: string;
  patientInfo?: string;
  dateTimeInfo?: string;
  name?: string;
  phone?: string;
};

export function generateSlots(): string[] {
  const slots: string[] = [];
  let hour = 9, min = 0;
  for (let i = 0; i < 22; i++) {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const m = min === 0 ? '00' : '30';
    slots.push(`${h}:${m} ${ampm}`);
    min += 30;
    if (min >= 60) { min = 0; hour++; }
  }
  return slots;
}

export const ALL_SLOTS = generateSlots();

const KEY = 'dr_romesh_appointments';
export const APPOINTMENTS_STORAGE_KEY = KEY;

const VALID_BOOKING_SOURCES: BookedSlot['bookedVia'][] = ['form', 'voice', 'ai'];
const VALID_STATUSES: BookedSlot['status'][] = ['confirmed', 'cancelled', 'completed'];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function splitLegacyField(value?: string) {
  const [first = '', second = ''] = (value || '').split(' - ');
  return { first: first.trim(), second: second.trim() };
}

function normalizeAppointment(input: AppointmentRecord): BookedSlot {
  const patient = splitLegacyField(input.patientInfo);
  const schedule = splitLegacyField(input.dateTimeInfo);
  const bookedVia = input.bookedVia ?? input.booked_via;
  const status = input.status;

  return {
    id: input.id || generateId(),
    date: input.date || schedule.first || new Date().toISOString().slice(0, 10),
    time: input.time || schedule.second || '09:00 AM',
    patientName: input.patientName || input.patient_name || input.name || patient.first || 'Unknown',
    patientPhone: input.patientPhone || input.patient_phone || input.phone || patient.second || '—',
    reason: input.reason || (bookedVia === 'ai' || bookedVia === 'voice' || input.patientInfo ? 'AI Voice Booking' : ''),
    bookedVia: VALID_BOOKING_SOURCES.includes(bookedVia as BookedSlot['bookedVia']) ? bookedVia as BookedSlot['bookedVia'] : (input.patientInfo ? 'ai' : 'form'),
    createdAt: input.createdAt || input.created_at || new Date().toISOString(),
    status: VALID_STATUSES.includes(status as BookedSlot['status']) ? status as BookedSlot['status'] : 'confirmed',
  };
}

function persistAppointments(appointments: BookedSlot[]) {
  cachedAppointments = appointments;
  localStorage.setItem(KEY, JSON.stringify(appointments));
}

function broadcastAppointmentsUpdated() {
  window.dispatchEvent(new Event('appointments-updated'));
  window.dispatchEvent(new Event('appointments-updated-local'));
}

export function getLocalAppointments(): BookedSlot[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    const normalized = Array.isArray(stored) ? stored.map((item) => normalizeAppointment(item)) : [];
    cachedAppointments = normalized;
    return normalized;
  } catch {
    return [];
  }
}

let cachedAppointments: BookedSlot[] = getLocalAppointments();

export async function fetchAppointments(): Promise<BookedSlot[]> {
  if (supabase) {
    const { data, error } = await supabase.from('appointments').select('*');
    if (error) {
      console.error("Supabase fetch error:", error);
      return getLocalAppointments();
    }
    if (data) {
      // Supabase is the source of truth — use its data directly
      // (this ensures admin deletions / status changes are reflected everywhere)
      const normalizedDb = data.map((item) => normalizeAppointment(item));
      
      // Also keep any local-only entries that haven't synced to Supabase yet
      const local = getLocalAppointments();
      const dbIds = new Set(normalizedDb.map(d => d.id));
      const localOnly = local.filter(l => !dbIds.has(l.id));
      
      const merged = [...localOnly, ...normalizedDb].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      persistAppointments(merged);
      return cachedAppointments;
    }
  }
  const local = getLocalAppointments();
  cachedAppointments = local;
  return local;
}

export async function saveAppointment(slot: BookedSlot): Promise<void> {
  const normalizedSlot = normalizeAppointment(slot);

  if (supabase) {
    const { error } = await supabase.from('appointments').insert([normalizedSlot]);
    if (error) {
      console.error("Supabase insert error:", error);
      alert("Failed to save to cloud database. Please check Supabase configuration.");
      return; // Do not save locally if cloud fails!
    }
  }

  persistAppointments([normalizedSlot, ...cachedAppointments.filter(a => a.id !== normalizedSlot.id)]);
  broadcastAppointmentsUpdated();
}

export async function updateAppointmentStatus(id: string, status: BookedSlot['status']): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) console.error("Supabase update error:", error);
  }

  persistAppointments(cachedAppointments.map(a => a.id === id ? { ...a, status } : a));
  broadcastAppointmentsUpdated();
}

export async function deleteAppointment(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) console.error("Supabase delete error:", error);
  }

  persistAppointments(cachedAppointments.filter(a => a.id !== id));
  broadcastAppointmentsUpdated();
}

export function isSlotBooked(date: string, time: string): boolean {
  return cachedAppointments.some(a => a.date === date && a.time === time && a.status !== 'cancelled');
}



export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

export const ADMIN_CREDENTIALS = { username: 'dr.romesh', password: 'clinic2025' };
