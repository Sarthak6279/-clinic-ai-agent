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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

let cachedAppointments: BookedSlot[] = [];

export async function fetchAppointments(): Promise<BookedSlot[]> {
  if (!supabase) return cachedAppointments;
  
  const { data, error } = await supabase.from('appointments').select('*').order('createdAt', { ascending: false });
  if (error) {
    console.error("Supabase fetch error:", error);
    return cachedAppointments;
  }
  if (data) {
    cachedAppointments = data;
    window.dispatchEvent(new Event('appointments-updated-local'));
    return data;
  }
  return cachedAppointments;
}

export async function saveAppointment(slot: BookedSlot): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('appointments').insert([slot]);
    if (error) {
      console.error("Supabase insert error:", error);
      alert("Failed to save to cloud database. Please check Supabase configuration.");
      return; // Do not save locally if cloud fails!
    }
  }

  // Update memory cache
  cachedAppointments = [slot, ...cachedAppointments.filter(a => a.id !== slot.id)].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  window.dispatchEvent(new Event('appointments-updated-local'));
}

export async function updateAppointmentStatus(id: string, status: BookedSlot['status']): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) console.error("Supabase update error:", error);
  }

  cachedAppointments = cachedAppointments.map(a => a.id === id ? { ...a, status } : a);
  window.dispatchEvent(new Event('appointments-updated'));
}

export async function deleteAppointment(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) console.error("Supabase delete error:", error);
  }

  cachedAppointments = cachedAppointments.filter(a => a.id !== id);
  window.dispatchEvent(new Event('appointments-updated'));
}

export function isSlotBooked(date: string, time: string): boolean {
  return cachedAppointments.some(a => a.date === date && a.time === time && a.status !== 'cancelled');
}

// Ensure anyone trying to read local cache just gets the memory array
export function getLocalAppointments(): BookedSlot[] {
  return cachedAppointments;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

export const ADMIN_CREDENTIALS = { username: 'dr.romesh', password: 'clinic2025' };
