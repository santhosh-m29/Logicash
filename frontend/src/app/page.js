'use client';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className={styles.landing}>
      {/* Animated Background */}
      <div className={styles.bgGrid}></div>
      <div className={styles.bgOrb1}></div>
      <div className={styles.bgOrb2}></div>
      <div className={styles.bgOrb3}></div>

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <div className={styles.navLogo}>₹</div>
          <span className={styles.navName}>Logicash</span>
        </div>
        <button onClick={() => router.push('/login')} className="btn-primary" id="nav-login-btn">
          Get Started
        </button>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot}></span>
          SNU Hacks &apos;26 — FinTech Track
        </div>
        <h1 className={styles.heroTitle}>
          Your Business Deserves
          <br />
          <span className={styles.heroGradient}>A Virtual CFO</span>
        </h1>
        <p className={styles.heroDesc}>
          Logicash transforms scattered bills, invoices, and expenses into intelligent payment strategies.
          Prioritize payments, manage cash flow runway, and negotiate with vendors — powered by deterministic logic, explained by AI.
        </p>
        <div className={styles.heroCta}>
          <button onClick={() => router.push('/login')} className="btn-primary" id="hero-cta-btn">
            Launch Dashboard →
          </button>
          <button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })} className="btn-secondary">
            See How it Works
          </button>
        </div>

        {/* Stats strip */}
        <div className={styles.statsStrip}>
          <div className={styles.statItem}>
            <div className={styles.statNum}>3</div>
            <div className={styles.statLabel}>Payment Scenarios</div>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <div className={styles.statNum}>100%</div>
            <div className={styles.statLabel}>Deterministic</div>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <div className={styles.statNum}>OCR</div>
            <div className={styles.statLabel}>Bill Scanning</div>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <div className={styles.statNum}>AI</div>
            <div className={styles.statLabel}>Explanations</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features} id="features">
        <h2 className={styles.sectionTitle}>How Logicash Works</h2>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>📄</div>
            <h3>Upload & Digitize</h3>
            <p>Upload bills via photo, PDF, or CSV. Our OCR pipeline extracts vendor, amount, and due dates automatically.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg, #06b6d4, #10b981)' }}>⚡</div>
            <h3>Deterministic Engine</h3>
            <p>A Python-powered priority scorer ranks every obligation by urgency, penalty risk, flexibility, and category.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)' }}>🎯</div>
            <h3>Scenario Planning</h3>
            <p>Get 3 payment strategies: Penalty Minimization, Relationship Preservation, and Runway Maximization.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>🤖</div>
            <h3>AI Explanations</h3>
            <p>Every decision is explained in plain language. Auto-draft professional negotiation emails for delayed payments.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>📊</div>
            <h3>Runway Analysis</h3>
            <p>See exactly how many days until your balance hits zero. Detect conflicts before they become crises.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'linear-gradient(135deg, #f43f5e, #f59e0b)' }}>💰</div>
            <h3>Surplus Intelligence</h3>
            <p>When you have excess cash, get ROI-based suggestions for business growth opportunities.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <h2>Ready to take control of your cash flow?</h2>
        <p>Join small businesses using Logicash to make smarter financial decisions.</p>
        <button onClick={() => router.push('/login')} className="btn-primary" id="bottom-cta-btn">
          Get Started Free →
        </button>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>Built by <strong>Team Clauders</strong> for SNU Hacks &apos;26 — FinTech Track</p>
      </footer>
    </div>
  );
}
