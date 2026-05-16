import { useState, useEffect, useRef } from 'react';
import { useVoiceAgent, type AgentState, type Appointment } from './useVoiceAgent';
import { saveAppointment, fetchAppointments, generateId, type BookedSlot } from './store';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import BookingCalendar from './BookingCalendar';
import { Menu, PhoneCall, X } from 'lucide-react';

const FAQS = [
  { q: "What are the consultation timings?", a: "Dr. Chawalani is available Monday to Saturday, 10:00 AM – 2:00 PM and 5:00 PM – 8:00 PM. Sunday by appointment only." },
  { q: "What is the consultation fee?", a: "The consultation fee is ₹400 for an in-clinic visit. Online video consultations are available at ₹300." },
  { q: "How do I book an appointment?", a: "You can book instantly by clicking 'Book Appointment' and speaking with our AI agent, or call us at 07383371238." },
  { q: "Which conditions does Dr. Chawalani treat?", a: "Dr. Chawalani specializes in Hepatology and Gastroenterology — liver diseases, digestive disorders, GERD, IBS, fatty liver, hepatitis, and more." },
  { q: "Is online consultation available?", a: "Yes, video consultations are available. Book via the website and you will receive a link before your appointment." },
];

const SERVICES = [
  { icon: "🫀", title: "Hepatology", desc: "Expert care for liver diseases including hepatitis, cirrhosis, fatty liver, and liver failure management." },
  { icon: "🔬", title: "Gastroenterology", desc: "Comprehensive diagnosis and treatment of digestive system disorders, GI tract conditions, and endoscopy." },
  { icon: "🩺", title: "General Consultation", desc: "Complete health check-ups, preventive care, and chronic disease management for adults." },
  { icon: "💊", title: "GERD & Acidity", desc: "Specialized treatment for acid reflux, GERD, peptic ulcers, and related gastrointestinal conditions." },
  { icon: "🧫", title: "Liver Function Tests", desc: "Interpretation and management of liver function test reports and advanced liver diagnostics." },
  { icon: "📋", title: "IBS Management", desc: "Personalized treatment plans for Irritable Bowel Syndrome, Crohn's disease, and colitis." },
];

const TESTIMONIALS = [
  { name: "Rajesh S.", initial: "R", stars: 5, text: "Dr. Chawalani diagnosed my fatty liver condition when other doctors missed it. His expertise and patient approach are exceptional. Highly recommended!", since: "Patient since 2020" },
  { name: "Meera P.", initial: "M", stars: 5, text: "Very knowledgeable and explains everything clearly. My liver condition has improved significantly under his care. The AI booking is also very convenient!", since: "Patient since 2021" },
  { name: "Suresh K.", initial: "S", stars: 4, text: "Professional, punctual, and genuinely caring. Treated my chronic acidity effectively. The clinic is well-organized and the staff is helpful.", since: "Patient since 2022" },
];

const TRUST_POINTS = [
  { icon: "🛡️", title: "Verified Specialist", text: "12+ years in hepatology and gastroenterology care" },
  { icon: "📍", title: "Prime Jabalpur Location", text: "In front of Reliance Fresh, Madan Mahal" },
  { icon: "📞", title: "Fast Booking Assistance", text: "Call-first booking with quick response during clinic hours" },
  { icon: "⭐", title: "Trusted by Patients", text: "4.0/5 rating from 650+ reviews" },
];

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const start = () => {
    if (started) return;
    setStarted(true);
    const step = target / (duration / 16);
    let cur = 0;
    const timer = setInterval(() => {
      cur = Math.min(cur + step, target);
      setCount(Math.floor(cur));
      if (cur >= target) clearInterval(timer);
    }, 16);
  };
  return { count, start };
}

function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Nav({ onBook }: { onBook: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = () => setMobileOpen(false);
  const handleBookClick = () => {
    closeMenu();
    onBook();
  };

  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-brand-icon">+</div>
        <div>
          <div className="nav-brand-text">Dr. Romesh Chawalani<span>Hepatologist &amp; Gastroenterologist</span></div>
        </div>
      </div>
      <button className="nav-menu-btn" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <div className="nav-links">
        <a className="nav-link" href="#about">About</a>
        <a className="nav-link" href="#services">Services</a>
        <a className="nav-link" href="#booking">Book</a>
        <a className="nav-link" href="#testimonials">Reviews</a>
        <a className="nav-link" href="#contact">Contact</a>
        <a className="nav-link" href="#admin" style={{ color: 'var(--text-muted)', fontSize: '0.82rem', borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem' }}>Doctor Portal</a>
        <button className="nav-cta" onClick={onBook}><PhoneCall size={16} /> Call to Book</button>
      </div>
      <div className={`nav-mobile-menu ${mobileOpen ? 'open' : ''}`}>
        <a className="nav-mobile-link" href="#about" onClick={closeMenu}>About</a>
        <a className="nav-mobile-link" href="#services" onClick={closeMenu}>Services</a>
        <a className="nav-mobile-link" href="#booking" onClick={closeMenu}>Book</a>
        <a className="nav-mobile-link" href="#testimonials" onClick={closeMenu}>Reviews</a>
        <a className="nav-mobile-link" href="#contact" onClick={closeMenu}>Contact</a>
        <a className="nav-mobile-link" href="#admin" onClick={closeMenu}>Doctor Portal</a>
        <button className="nav-mobile-cta" onClick={handleBookClick}><PhoneCall size={16} /> Start Call Booking</button>
      </div>
    </nav>
  );
}

function Hero({ onBook }: { onBook: () => void }) {
  return (
    <section className="hero" id="home">
      <div className="hero-left">
        <div className="hero-tag"><span className="hero-tag-dot" />Now Accepting Appointments</div>
        <h1 className="hero-title">Specialist Care for<br /><span>Liver &amp; Digestive</span><br />Health</h1>
        <p className="hero-desc">Evidence-based hepatology and gastroenterology care by Dr. Romesh Chawalani in Madan Mahal, Jabalpur. Clear guidance, structured treatment plans, and patient-first consultations.</p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={onBook}>Book an Appointment</button>
          <a href="#services" className="btn-secondary">View Services</a>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="hero-stat-num">12+</div><div className="hero-stat-label">Years Experience</div></div>
          <div className="hero-stat"><div className="hero-stat-num">5,000+</div><div className="hero-stat-label">Patients Treated</div></div>
          <div className="hero-stat"><div className="hero-stat-num">4.0★</div><div className="hero-stat-label">Patient Rating</div></div>
          <div className="hero-stat"><div className="hero-stat-num">₹400</div><div className="hero-stat-label">Consult Fee</div></div>
        </div>
      </div>
      <div className="hero-right">
          <div className="hero-card">
            <div className="hero-card-header"><div className="hero-card-icon teal">📊</div><span className="hero-card-badge">Today at Clinic</span></div>
            <div className="hero-card-val">5,000+</div>
            <div className="hero-card-label">Consultations Completed</div>
          </div>
          <div className="hero-card">
            <div className="hero-card-header"><div className="hero-card-icon green">📅</div><span className="hero-card-badge">Consultation Queue</span></div>
            <div className="hero-card-mini">
              <div className="hero-card-avatar">R</div>
              <div><div className="hero-card-info-name">11:30 AM — Confirmed</div><div className="hero-card-info-time">Liver & GI follow-up</div></div>
              <div className="hero-card-status" />
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-header"><div className="hero-card-icon blue">⭐</div><span className="hero-card-badge">Care Quality</span></div>
            <div className="hero-card-val">4.0 / 5.0</div>
            <div className="hero-card-label">Patient Satisfaction</div>
          </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="trust-strip">
      <div className="container">
        <div className="trust-grid">
          {TRUST_POINTS.map((point, idx) => (
            <div key={idx} className="trust-item">
              <div className="trust-icon">{point.icon}</div>
              <div>
                <div className="trust-title">{point.title}</div>
                <div className="trust-text">{point.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Profile() {
  const ref = useFadeUp();
  const exp = useCountUp(12);
  const pts = useCountUp(5000);
  const rev = useCountUp(650);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { exp.start(); pts.start(); rev.start(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section className="profile-section" id="about">
      <div className="container">
        <div className="profile-grid fade-up" ref={ref}>
          <div className="profile-photo-wrap">
            <div className="profile-photo"><div className="profile-photo-initials">RC</div></div>
            <div className="profile-photo-badge">MBBS · MD · Gastroenterology</div>
          </div>
          <div>
            <div className="section-label">About the Doctor</div>
            <div className="profile-meta-name">Dr. Romesh Chawalani</div>
            <div className="profile-meta-role">Hepatologist & Gastroenterologist</div>
            <p className="profile-meta-desc">Dr. Romesh Chawalani is a highly experienced Hepatologist and Gastroenterologist based in Madan Mahal, Jabalpur. With over 12 years of dedicated clinical practice, he specializes in diagnosing and treating complex liver diseases, digestive disorders, and gastrointestinal conditions. His patient-first approach, combined with advanced diagnostic techniques, ensures compassionate and evidence-based care for every patient.</p>
            <div className="profile-stats">
              <div className="profile-stat-card"><div className="num">{exp.count}+</div><div className="lbl">Years Experience</div></div>
              <div className="profile-stat-card"><div className="num">{pts.count}+</div><div className="lbl">Patients Treated</div></div>
              <div className="profile-stat-card"><div className="num">{rev.count}</div><div className="lbl">Patient Reviews</div></div>
              <div className="profile-stat-card"><div className="num">4.0★</div><div className="lbl">Avg. Rating</div></div>
            </div>
            <div className="profile-badges">
              <span className="profile-badge">✅ Verified Doctor</span>
              <span className="profile-badge">🏥 Madan Mahal, Jabalpur</span>
              <span className="profile-badge">⚡ Responds in 5 mins</span>
              <span className="profile-badge">🎓 MD Gastroenterology</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const ref = useFadeUp();
  return (
    <section className="services-section" id="services">
      <div className="container">
        <div className="section-header-center fade-up" ref={ref}>
          <div className="section-label">Specialties</div>
          <div className="section-title">Comprehensive Medical Services</div>
          <p className="section-desc">From routine consultations to complex liver and digestive conditions, expert care tailored to your needs.</p>
        </div>
        <div className="services-grid">
          {SERVICES.map((s, i) => (
            <div key={i} className="service-card">
              <div className="service-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Insights() {
  const ref = useFadeUp();
  return (
    <section className="insights-section">
      <div className="container">
        <div className="section-label fade-up" ref={ref}>Clinic at a Glance</div>
        <div className="section-title" style={{ color: 'white', marginBottom: '0.75rem' }}>Real-Time Clinic Metrics</div>
         <p className="section-desc" style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '2.5rem' }}>A quick summary of patient volume, booking pace, and consultation quality.</p>
         <div className="insights-grid">
           {[
             { icon: "👥", val: "5,000+", label: "Patients Treated", change: "12+ years of practice" },
             { icon: "📅", val: "22", label: "Daily Slots", change: "30-minute appointments" },
             { icon: "⭐", val: "4.0/5", label: "Patient Rating", change: "650+ verified reviews" },
             { icon: "⚡", val: "~5 min", label: "Booking Response", change: "During working hours" },
           ].map((c, i) => (
            <div key={i} className="insight-card">
              <div className="insight-icon">{c.icon}</div>
              <div className="insight-val">{c.val}</div>
              <div className="insight-label">{c.label}</div>
              <div className="insight-change">{c.change}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Booking({ onBook, onOpenCalendar }: { onBook: () => void; onOpenCalendar: () => void }) {
  const ref = useFadeUp();
  const [mode, setMode] = useState<'clinic' | 'online'>('clinic');

  return (
    <section className="booking-section" id="booking">
      <div className="container">
        <div className="booking-grid">
          <div className="fade-up" ref={ref}>
            <div className="section-label">Appointment</div>
            <div className="section-title">Book Your Visit</div>
            <p className="section-desc">Choose from 22 daily slots (30 min each, 9 AM – 7:30 PM). Book via Voice AI or select a slot from the calendar.</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              <button className="btn-primary" onClick={onOpenCalendar}>Open Booking Calendar</button>
              <button className="btn-secondary" onClick={onBook}><PhoneCall size={16} /> Call Assistant Booking</button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.4rem', fontSize: '0.95rem' }}>Clinic Hours</div>
              <div style={{ fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                Mon – Sat: 10:00 AM – 2:00 PM & 5:00 PM – 8:00 PM<br />
                Sunday: Closed<br />
                <strong style={{ color: 'var(--primary)' }}>Response time: ~5 minutes</strong>
              </div>
            </div>
          </div>
          <div className="booking-card">
            <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '1rem' }}>Quick Enquiry Form</div>
            <div className="booking-options">
              <div className={`booking-option ${mode === 'clinic' ? 'active' : ''}`} onClick={() => setMode('clinic')}>
                <div className="booking-option-label">In-Clinic Visit</div>
                <div className="booking-option-fee">₹400 per consultation</div>
              </div>
              <div className={`booking-option ${mode === 'online' ? 'active' : ''}`} onClick={() => setMode('online')}>
                <div className="booking-option-label">Online / Video</div>
                <div className="booking-option-fee">₹300 per consultation</div>
              </div>
            </div>
            <div className="booking-form">
              <input className="booking-input" placeholder="Your Full Name" />
              <input className="booking-input" placeholder="Mobile Number" />
              <input className="booking-input" placeholder="Reason for visit (optional)" />
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onOpenCalendar}>Select Date & Time →</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Why() {
  const ref = useFadeUp();
  const points = [
    { icon: "🎓", title: "12+ Years of Expertise", desc: "Specialized training in Hepatology and Gastroenterology with hundreds of complex cases resolved." },
    { icon: "🤝", title: "Patient-First Approach", desc: "Every patient receives personalized attention. Dr. Chawalani takes time to explain and listen." },
    { icon: "⚡", title: "Fast Response", desc: "Responds in 5 minutes. Emergency consultations accommodated whenever possible." },
    { icon: "🔬", title: "Advanced Diagnostics", desc: "Access to modern diagnostic equipment for accurate, timely liver and GI assessments." },
    { icon: "💬", title: "Clear Communication", desc: "Medical jargon-free explanations. You'll always understand your diagnosis and treatment plan." },
    { icon: "📍", title: "Conveniently Located", desc: "Clinic situated in Madan Mahal, Jabalpur — easily accessible by public and private transport." },
  ];
  return (
    <section className="why-section">
      <div className="container">
        <div className="section-header-center fade-up" ref={ref}>
          <div className="section-label">Why Choose Us</div>
          <div className="section-title">A Doctor You Can Trust</div>
          <p className="section-desc">Here's what makes Dr. Chawalani the preferred choice for liver and digestive health in Jabalpur.</p>
        </div>
        <div className="why-grid">
          {points.map((p, i) => (
            <div key={i} className="why-card">
              <div className="why-icon">{p.icon}</div>
              <div><h4>{p.title}</h4><p>{p.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const ref = useFadeUp();
  return (
    <section className="testimonials-section" id="testimonials">
      <div className="container">
        <div className="section-header-center fade-up" ref={ref}>
          <div className="section-label">Patient Reviews</div>
          <div className="section-title">What Patients Say</div>
          <p className="section-desc">Real feedback from real patients treated by Dr. Romesh Chawalani.</p>
        </div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="testimonial-card">
              <div className="testimonial-stars">{'★'.repeat(t.stars)}</div>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.initial}</div>
                <div><div className="testimonial-name">{t.name}</div><div className="testimonial-since">{t.since}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useFadeUp();
  return (
    <section className="faq-section">
      <div className="container">
        <div className="section-header-center fade-up" ref={ref}>
          <div className="section-label">FAQ</div>
          <div className="section-title">Common Questions</div>
          <p className="section-desc">Everything you need to know before your visit.</p>
        </div>
        <div className="faq-list">
          {FAQS.map((f, i) => (
            <div key={i} className="faq-item">
              <div className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
                {f.q}
                <span className={`faq-chevron ${open === i ? 'open' : ''}`}>▾</span>
              </div>
              {open === i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const ref = useFadeUp();
  return (
    <section className="contact-section" id="contact">
      <div className="container">
        <div className="section-label fade-up" ref={ref}>Get in Touch</div>
        <div className="section-title">Visit the Clinic</div>
        <div className="contact-grid" style={{ marginTop: '2rem' }}>
          <div className="contact-info">
            {[
              { icon: "📍", label: "Address", val: "In Front of Reliance Fresh, Madan Mahal, Jabalpur, MP" },
              { icon: "📞", label: "Phone", val: "07383371238" },
              { icon: "🕐", label: "Timings", val: "Mon–Sat: 10AM–2PM & 5PM–8PM" },
              { icon: "💰", label: "Consultation Fee", val: "₹400 (Clinic) · ₹300 (Online)" },
               { icon: "⚡", label: "Response Time", val: "Approx. 5 minutes during clinic hours" },
            ].map((c, i) => (
              <div key={i} className="contact-item">
                <div className="contact-item-icon">{c.icon}</div>
                <div><div className="contact-item-label">{c.label}</div><div className="contact-item-val">{c.val}</div></div>
              </div>
            ))}
            <div className="map-placeholder">📍 In Front of Reliance Fresh, Madan Mahal, Jabalpur</div>
          </div>
          <div className="booking-card">
            <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '1rem' }}>Send an Enquiry</div>
            <div className="booking-form">
              <input className="booking-input" placeholder="Your Name" />
              <input className="booking-input" placeholder="Mobile / Email" />
              <textarea className="booking-input" rows={4} placeholder="Your message or question..." style={{ resize: 'vertical' }} />
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Send Message</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">🩺 Dr. Romesh Chawalani</div>
            <p className="footer-desc">Hepatologist & Gastroenterologist with 12+ years of experience. Dedicated to delivering patient-centered liver and digestive care in Jabalpur.</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <div className="footer-links">
              <a href="#about" className="footer-link">About Doctor</a>
              <a href="#services" className="footer-link">Services</a>
              <a href="#booking" className="footer-link">Book Appointment</a>
              <a href="#testimonials" className="footer-link">Patient Reviews</a>
              <a href="#contact" className="footer-link">Contact & Location</a>
            </div>
          </div>
          <div>
            <h4>Contact</h4>
            <div className="footer-links">
              <span className="footer-link">📞 07383371238</span>
              <span className="footer-link">📍 Madan Mahal, Jabalpur</span>
              <span className="footer-link">🕐 Mon–Sat: 10AM–8PM</span>
              <span className="footer-link">💰 Consult: ₹400</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">© 2025 Dr. Romesh Chawalani. All rights reserved. | Hepatologist & Gastroenterologist, Jabalpur</div>
      </div>
    </footer>
  );
}

function VoiceWidget({
  isOpen,
  onClose,
  agentState,
  transcript
}: {
  isOpen: boolean;
  onClose: () => void;
  agentState: AgentState;
  transcript: string;
}) {
  useEffect(() => {
    if (agentState === 'IDLE' && isOpen) {
      const t = setTimeout(onClose, 500);
      return () => clearTimeout(t);
    }
  }, [agentState, isOpen, onClose]);

  const statusText: Record<AgentState, string> = {
    IDLE: 'Connecting your call...',
    SPEAKING: 'Assistant is speaking...',
    LISTENING: 'Listening to your voice...',
    PROCESSING: 'Confirming details...',
    COMPLETED: '✅ Appointment booked'
  };
  const stepLabel: Record<AgentState, string> = {
    IDLE: 'Please stay on the line',
    SPEAKING: 'We are guiding your booking',
    LISTENING: 'You can speak naturally',
    PROCESSING: 'One moment while we save this',
    COMPLETED: 'Call ending shortly'
  };

  if (!isOpen) return null;

  return (
    <div className={`widget-overlay ${isOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="widget">
        <button className="widget-close" onClick={onClose}>✕</button>
        <div className={`widget-avatar ${agentState === 'SPEAKING' ? 'speaking' : ''}`}>
          {agentState === 'LISTENING' ? '🎧' : agentState === 'COMPLETED' ? '✅' : '📞'}
        </div>

        {/* Middle: Transcript & Status */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', zIndex: 1, padding: '0 1rem' }}>
          <div style={{ color: agentState === 'LISTENING' ? '#10b981' : agentState === 'SPEAKING' ? '#3b82f6' : '#64748b', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: '1rem', transition: 'color 0.3s' }}>
            {statusText[agentState] || 'Connecting...'}
          </div>
          
          <div style={{ color: '#fff', fontSize: '1.1rem', textAlign: 'center', lineHeight: 1.5, opacity: transcript ? 1 : 0.5, fontStyle: transcript ? 'normal' : 'italic', transition: 'opacity 0.3s', maxWidth: '100%' }}>
            {transcript ? `"${transcript}"` : (agentState === 'LISTENING' ? 'Go ahead and speak...' : '...')}
          </div>
        </div>

        {/* Bottom: Controls */}
        <div style={{ zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
          <button style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
            🔇
          </button>
          
          <button onClick={onClose} style={{ width: 72, height: 72, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)', transform: 'rotate(135deg)', transition: 'transform 0.2s, background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#dc2626'} onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}>
            📞
          </button>

          <button style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
            💬
          </button>
        </div>
        <div className="widget-step-label">Dr. Romesh Clinic · Call Assistant</div>
      </div>
    </div>
  );
}

export default function App() {
  // Admin routing
  const [page, setPage] = useState<'website' | 'admin-login' | 'admin'>(() =>
    window.location.hash === '#admin' ? 'admin-login' : 'website'
  );
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => sessionStorage.getItem('admin_auth') === 'true');

  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Prime Supabase cache on mount
  useEffect(() => {
    fetchAppointments();
  }, []);

  // Sync hash
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#admin') setPage(isAdminAuthed ? 'admin' : 'admin-login');
      else setPage('website');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [isAdminAuthed]);

  const handleBooked = (a: Appointment) => {
    // Split the mapped strings safely
    const partsName = (a.patientInfo || '').split(' - ');
    const partsDate = (a.dateTimeInfo || '').split(' - ');
    
    const name = partsName[0]?.trim() || a.patientInfo || 'Unknown';
    const phone = partsName[1]?.trim() || 'Via Voice AI';
    const date = partsDate[0]?.trim() || new Date().toISOString().slice(0, 10);
    const time = partsDate[1]?.trim() || 'AI Booking';

    const slot: BookedSlot = {
      id: generateId(),
      date: date,
      time: time,
      patientName: name,
      patientPhone: phone,
      reason: 'AI Voice Booking',
      bookedVia: 'ai',
      createdAt: a.createdAt,
      status: 'confirmed',
    };
    saveAppointment(slot);
  };

  const { agentState, transcript, startCall, endCall } = useVoiceAgent(handleBooked);

  const handleOpenCall = () => { 
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("⚠️ Voice AI is currently only supported on Google Chrome, Edge, and Safari browsers.");
      return;
    }
    setIsWidgetOpen(true); 
    startCall(); 
  };
  const handleCloseCall = () => { endCall(); setIsWidgetOpen(false); };

  useEffect(() => {
    if (agentState === 'IDLE' && isWidgetOpen) {
      const t = setTimeout(() => setIsWidgetOpen(false), 600);
      return () => clearTimeout(t);
    }
  }, [agentState, isWidgetOpen]);

  // Admin pages
  if (page === 'admin-login' || (page === 'admin' && !isAdminAuthed)) {
    return <AdminLogin onLogin={() => { setIsAdminAuthed(true); setPage('admin'); }} />;
  }
  if (page === 'admin' && isAdminAuthed) {
    return <AdminDashboard onLogout={() => { sessionStorage.removeItem('admin_auth'); setIsAdminAuthed(false); window.location.hash = ''; setPage('website'); }} />;
  }

  return (
    <>
      <Nav onBook={handleOpenCall} />
      <Hero onBook={handleOpenCall} />
      <TrustStrip />
      <Profile />
      <Services />
      <Insights />
      <Booking onBook={handleOpenCall} onOpenCalendar={() => setIsCalendarOpen(true)} />
      <Why />
      <Testimonials />
      <FAQ />
      <Contact />
      <Footer />

      {/* No floating Doctor Login pill - moved to nav */}

      <div className="floating-voice">
        <button className="floating-voice-btn" onClick={handleOpenCall} title="Start call booking">
          <PhoneCall size={18} />
          <span>Call to Book</span>
        </button>
        <span className="floating-voice-label">Available now</span>
      </div>

      {/* Calendar Modal */}
      {isCalendarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,30,50,0.55)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={e => { if (e.target === e.currentTarget) setIsCalendarOpen(false); }}>
          <div style={{ width: '100%', maxWidth: 720 }}>
            <BookingCalendar onClose={() => setIsCalendarOpen(false)} />
          </div>
        </div>
      )}

      <VoiceWidget isOpen={isWidgetOpen} onClose={handleCloseCall} agentState={agentState} transcript={transcript} />
    </>
  );
}
