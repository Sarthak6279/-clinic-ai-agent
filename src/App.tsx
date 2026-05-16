import { useState, useEffect, useRef } from 'react';
import { useVoiceAgent, type AgentState, type Appointment } from './useVoiceAgent';
import { saveAppointment, fetchAppointments, generateId, type BookedSlot } from './store';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import BookingCalendar from './BookingCalendar';
import { 
  Menu, 
  X, 
  PhoneCall, 
  Calendar, 
  Award, 
  MapPin, 
  CheckCircle2, 
  Stethoscope, 
  ShieldCheck,
  TrendingUp,
  Users,
  Activity,
  HeartPulse
} from 'lucide-react';

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

  return (
    <>
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-brand-icon">✚</div>
        <div>
          <div className="nav-brand-text">Dr. Romesh Chawalani<span>Hepatologist &amp; Gastroenterologist</span></div>
        </div>
      </div>
      <div className="nav-links">
        <a className="nav-link" href="#about">About</a>
        <a className="nav-link" href="#services">Services</a>
        <a className="nav-link" href="#booking">Book</a>
        <a className="nav-link" href="#testimonials">Reviews</a>
        <a className="nav-link" href="#contact">Contact</a>
        <a className="nav-link" href="#admin" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>Doctor Portal</a>
        <button className="nav-cta" onClick={onBook}><PhoneCall size={14} style={{ marginRight: '6px' }} /> Book Appointment</button>
      </div>
      <button className="nav-hamburger" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu">
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </nav>
    <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
      <a className="nav-link" href="#about" onClick={closeMenu}>About</a>
      <a className="nav-link" href="#services" onClick={closeMenu}>Services</a>
      <a className="nav-link" href="#booking" onClick={closeMenu}>Book</a>
      <a className="nav-link" href="#testimonials" onClick={closeMenu}>Reviews</a>
      <a className="nav-link" href="#contact" onClick={closeMenu}>Contact</a>
      <a className="nav-link" href="#admin" onClick={closeMenu} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Doctor Portal</a>
      <button className="nav-cta" onClick={() => { closeMenu(); onBook(); }} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}><PhoneCall size={18} style={{ marginRight: '8px' }} /> Book Appointment</button>
    </div>
    </>
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
          <button className="btn-primary" onClick={onBook}><PhoneCall size={18} /> Book Appointment</button>
          <a href="#services" className="btn-secondary"><Activity size={18} /> View Services</a>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="hero-stat-num">12+</div><div className="hero-stat-label">Years Experience</div></div>
          <div className="hero-stat"><div className="hero-stat-num">5,000+</div><div className="hero-stat-label">Patients Treated</div></div>
          <div className="hero-stat"><div className="hero-stat-num">4.0★</div><div className="hero-stat-label">Patient Rating</div></div>
          <div className="hero-stat"><div className="hero-stat-num">₹400</div><div className="hero-stat-label">Consult Fee</div></div>
        </div>
      </div>
      <div className="hero-right">
        <div className="hero-img-blob" />
        <div className="hero-img-blob2" />
        <img src="/doctor.png" alt="Dr. Romesh Chawalani" className="hero-img" />
        <div className="hero-badge">
          <div className="hero-badge-icon">🏥</div>
          <div>
            <div className="hero-badge-val">5,000+</div>
            <div className="hero-badge-lbl">Patients Treated</div>
          </div>
        </div>
        <div className="hero-badge2">
          <div className="hero-badge2-inner">
            <div className="hero-badge2-dot" />
            <div className="hero-badge2-text">Now Accepting Patients</div>
          </div>
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
    const obs = new IntersectionObserver(([e]) => { 
      if (e.isIntersecting) { 
        exp.start(); 
        pts.start(); 
        rev.start(); 
      } 
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="profile-section" id="about">
      <div className="container">
        <div className="profile-grid fade-up" ref={ref}>
          <div className="profile-photo-wrap">
            <div className="profile-photo">
              <div className="profile-photo-initials">RC</div>
              <img src="/doctor.png" alt="Dr. Romesh Chawalani" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }} />
              <div className="profile-photo-badge">MBBS, MD (Medicine)</div>
            </div>
          </div>
          
          <div className="profile-content">
            <div className="section-label">Expert Specialist</div>
            <h2 className="profile-meta-name">Dr. Romesh Chawalani</h2>
            <div className="profile-meta-role">Hepatologist & Gastroenterologist</div>
            
            <p className="profile-meta-desc">
              Specialized in Liver Diseases, Hepatitis, Cirrhosis, and complex Digestive Health issues. 
              Dr. Chawalani is a distinguished <strong>Gold Medalist</strong> with over <strong>12 years</strong> of clinical expertise in providing structured, evidence-based treatments for chronic and acute gastrointestinal conditions.
            </p>
            
            <div className="profile-stats">
              <div className="profile-stat-card">
                <div className="profile-stat-icon"><Award size={20} /></div>
                <div className="num">{exp.count}+</div>
                <div className="lbl">Years Exp.</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-icon"><Users size={20} /></div>
                <div className="num">{pts.count}+</div>
                <div className="lbl">Patients</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-icon"><ShieldCheck size={20} /></div>
                <div className="num">Gold</div>
                <div className="lbl">Medalist</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-icon"><TrendingUp size={20} /></div>
                <div className="num">4.0★</div>
                <div className="lbl">Rating</div>
              </div>
            </div>

            <div className="profile-trust-row">
              <div className="profile-trust-item">
                <CheckCircle2 size={16} className="icon-blue" />
                <span>Verified Specialist</span>
              </div>
              <div className="profile-trust-item">
                <MapPin size={16} className="icon-blue" />
                <span>Madan Mahal, Jabalpur</span>
              </div>
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
        <div className="section-header-center fade-up" ref={ref}>
          <div className="section-label">Clinic Metrics</div>
          <h2 className="section-title" style={{ color: 'white' }}>Impact in Numbers</h2>
          <p className="section-desc" style={{ color: 'rgba(255,255,255,0.6)' }}>Real-time statistics from our medical facility in Jabalpur.</p>
        </div>
        
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-icon"><Activity size={32} color="#06B6D4" /></div>
            <div className="insight-val">50+</div>
            <div className="insight-label">Daily Patients</div>
            <div className="insight-change">↑ 12% this month</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon"><HeartPulse size={32} color="#06B6D4" /></div>
            <div className="insight-val">98%</div>
            <div className="insight-label">Success Rate</div>
            <div className="insight-change">Verified Outcomes</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon"><Calendar size={32} color="#06B6D4" /></div>
            <div className="insight-val">22</div>
            <div className="insight-label">Daily Slots</div>
            <div className="insight-change">Available Mon-Sat</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon"><Stethoscope size={32} color="#06B6D4" /></div>
            <div className="insight-val">24/7</div>
            <div className="insight-label">AI Booking</div>
            <div className="insight-change">Always Available</div>
          </div>
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
              <button className="btn-primary" onClick={onOpenCalendar}><Calendar size={18} /> Open Booking Calendar</button>
              <button className="btn-secondary" onClick={onBook}><PhoneCall size={18} /> Call Assistant Booking</button>
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
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isOpen && agentState !== 'IDLE') {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isOpen, agentState]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (agentState === 'IDLE' && isOpen) {
      const t = setTimeout(onClose, 500);
      return () => clearTimeout(t);
    }
  }, [agentState, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="call-overlay">
      <div className="call-screen">
        {/* Top Info */}
        <div className="call-header">
          <div className="call-status">Outgoing Call...</div>
          <h2 className="call-name">Dr. Romesh Chawalani</h2>
          <div className="call-timer">{formatTime(seconds)}</div>
        </div>

        {/* Avatar Area */}
        <div className="call-avatar-wrap">
          <div className={`call-avatar ${agentState === 'SPEAKING' ? 'speaking' : ''}`}>
            <div className="call-avatar-inner">
              ✚
            </div>
            {agentState === 'SPEAKING' && (
              <>
                <div className="pulse-ring" />
                <div className="pulse-ring" style={{ animationDelay: '0.5s' }} />
              </>
            )}
          </div>
        </div>

        {/* Transcript Area */}
        <div className="call-transcript-wrap">
          <div className="call-status-label">
            {agentState === 'LISTENING' ? 'Listening...' : agentState === 'SPEAKING' ? 'Speaking...' : agentState === 'PROCESSING' ? 'Processing...' : ''}
          </div>
          <div className="call-transcript">
            {transcript || (agentState === 'LISTENING' ? 'Please tell your name...' : '...')}
          </div>
        </div>

        {/* Controls */}
        <div className="call-controls">
          <div className="call-grid">
            <div className="call-control-item">
              <div className="call-control-btn">🔇</div>
              <span>Mute</span>
            </div>
            <div className="call-control-item">
              <div className="call-control-btn">⌨️</div>
              <span>Keypad</span>
            </div>
            <div className="call-control-item">
              <div className="call-control-btn">🔊</div>
              <span>Speaker</span>
            </div>
            <div className="call-control-item">
              <div className="call-control-btn">➕</div>
              <span>Add Call</span>
            </div>
            <div className="call-control-item">
              <div className="call-control-btn">📹</div>
              <span>FaceTime</span>
            </div>
            <div className="call-control-item">
              <div className="call-control-btn">👤</div>
              <span>Contacts</span>
            </div>
          </div>

          <div className="call-actions">
            <button className="call-hangup" onClick={onClose}>
              <div className="call-hangup-icon">📞</div>
            </button>
          </div>
        </div>
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
          <span>📞</span>
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
