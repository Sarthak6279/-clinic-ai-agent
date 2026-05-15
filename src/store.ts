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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function getLocalAppointments(): BookedSlot[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

let cachedAppointments: BookedSlot[] = getLocalAppointments();

export async function fetchAppointments(): Promise<BookedSlot[]> {
  if (supabase) {
    const { data, error } = await supabase.from('appointments').select('*').order('createdAt', { ascending: false });
    if (!error && data) {
      cachedAppointments = data;
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    }
  }
  return getLocalAppointments();
}

export async function saveAppointment(slot: BookedSlot): Promise<void> {
  cachedAppointments.push(slot);
  localStorage.setItem(KEY, JSON.stringify(cachedAppointments));
  window.dispatchEvent(new Event('appointments-updated'));

  if (supabase) {
    await supabase.from('appointments').insert([slot]);
  }
}

export async function updateAppointmentStatus(id: string, status: BookedSlot['status']): Promise<void> {
  cachedAppointments = cachedAppointments.map(a => a.id === id ? { ...a, status } : a);
  localStorage.setItem(KEY, JSON.stringify(cachedAppointments));
  window.dispatchEvent(new Event('appointments-updated'));

  if (supabase) {
    await supabase.from('appointments').update({ status }).eq('id', id);
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  cachedAppointments = cachedAppointments.filter(a => a.id !== id);
  localStorage.setItem(KEY, JSON.stringify(cachedAppointments));
  window.dispatchEvent(new Event('appointments-updated'));

  if (supabase) {
    await supabase.from('appointments').delete().eq('id', id);
  }
}

export function isSlotBooked(date: string, time: string): boolean {
  return cachedAppointments.some(a => a.date === date && a.time === time && a.status !== 'cancelled');
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

export const ADMIN_CREDENTIALS = { username: 'dr.romesh', password: 'clinic2025' };
