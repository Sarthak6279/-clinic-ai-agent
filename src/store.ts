// Shared appointment store using localStorage for persistence

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

// Generate 22 slots: 9:00 AM to 7:30 PM in 30-min intervals
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
// => ["9:00 AM","9:30 AM","10:00 AM",...,"7:30 PM"] — 22 total

const KEY = 'dr_romesh_appointments';

export function loadAppointments(): BookedSlot[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch { return []; }
}

export function saveAppointment(slot: BookedSlot): void {
  const all = loadAppointments();
  all.push(slot);
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('appointments-updated'));
}

export function updateAppointmentStatus(id: string, status: BookedSlot['status']): void {
  const all = loadAppointments().map(a => a.id === id ? { ...a, status } : a);
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('appointments-updated'));
}

export function deleteAppointment(id: string): void {
  const all = loadAppointments().filter(a => a.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('appointments-updated'));
}

export function isSlotBooked(date: string, time: string): boolean {
  return loadAppointments().some(a => a.date === date && a.time === time && a.status !== 'cancelled');
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

// Admin credentials (in a real app, this would be server-side)
export const ADMIN_CREDENTIALS = { username: 'dr.romesh', password: 'clinic2025' };
