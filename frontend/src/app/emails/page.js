'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import styles from './emails.module.css';

export default function EmailsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [selectedObl, setSelectedObl] = useState(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState('professional');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      const { data } = await supabase
        .from('obligations')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_paid', false)
        .order('due_date', { ascending: true });
      if (data) setObligations(data);
    };
    init();
  }, [router]);

  const generateEmail = async () => {
    if (!selectedObl) return;
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/email-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obligation: selectedObl, tone, user_name: user?.email?.split('@')[0] || 'Business Owner' }),
      });
      if (!res.ok) throw new Error('Draft failed');
      const data = await res.json();
      setEmailDraft(data.email);
    } catch {
      // Local fallback template
      const daysLeft = Math.ceil((new Date(selectedObl.due_date) - new Date()) / 86400000);
      const userName = user?.email?.split('@')[0] || 'Business Owner';
      const overdue = daysLeft < 0;

      const templates = {
        professional: `Subject: Regarding Payment for Invoice — ${selectedObl.vendor}

Dear ${selectedObl.vendor} Team,

I hope this message finds you well. I am writing to discuss the outstanding payment of ₹${selectedObl.amount?.toLocaleString()} ${overdue ? 'which was due on' : 'scheduled for'} ${selectedObl.due_date}.

Due to current cash flow management priorities, I would like to ${overdue ? 'request a brief extension' : 'discuss a possible adjusted timeline'} for this payment. We remain fully committed to fulfilling this obligation and value our ongoing business relationship.

Could we arrange a brief call to discuss a mutually agreeable payment schedule? We anticipate being able to complete this payment within the next 15 business days.

Thank you for your understanding and continued partnership.

Best regards,
${userName}`,

        empathetic: `Subject: Payment Discussion — ${selectedObl.vendor}

Dear ${selectedObl.vendor} Team,

I want to be transparent with you about our current situation regarding the payment of ₹${selectedObl.amount?.toLocaleString()} ${overdue ? '(past due)' : `due on ${selectedObl.due_date}`}.

We're currently navigating some cash flow challenges, and while we take our commitments to your organization very seriously, we need a bit more time to process this payment. Your business has been incredibly important to us, and we want to maintain that trust.

I'd love to work together on a comfortable resolution — perhaps a phased payment plan or a brief extension. What would work best for your team?

Warm regards,
${userName}`,

        firm: `Subject: Payment Update — ${selectedObl.vendor}

Dear ${selectedObl.vendor},

This is regarding the payment of ₹${selectedObl.amount?.toLocaleString()} ${overdue ? `originally due ${selectedObl.due_date}` : `due on ${selectedObl.due_date}`}.

After reviewing our current financial obligations and cash flow position, we are requesting a ${overdue ? 'revised timeline' : 'brief adjustment'} for this payment. We have prioritized our obligations using a systematic approach and will process your payment as soon as our schedule permits.

We expect to complete this within 10-15 business days. Please confirm receipt of this communication.

Regards,
${userName}`,
      };

      setEmailDraft(templates[tone] || templates.professional);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Email Drafter</h1>
        <p className={styles.pageDesc}>Auto-generate negotiation emails for delayed payments</p>

        <div className={styles.twoCol}>
          {/* Left: Select obligation */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Select Obligation</h2>
            {obligations.length === 0 ? (
              <p className={styles.muted}>No unpaid obligations found.</p>
            ) : (
              <div className={styles.oblList}>
                {obligations.map((obl, i) => (
                  <button
                    key={obl.id || i}
                    className={`${styles.oblItem} ${selectedObl?.id === obl.id ? styles.oblItemActive : ''}`}
                    onClick={() => { setSelectedObl(obl); setEmailDraft(''); }}
                  >
                    <div className={styles.oblVendor}>{obl.vendor}</div>
                    <div className={styles.oblMeta}>₹{obl.amount?.toLocaleString()} · {obl.due_date}</div>
                  </button>
                ))}
              </div>
            )}

            {selectedObl && (
              <div className={styles.toneSection}>
                <label className="form-label">Email Tone</label>
                <div className={styles.toneRow}>
                  {[{ value: 'professional', label: '💼 Professional' }, { value: 'empathetic', label: '💙 Empathetic' }, { value: 'firm', label: '⚡ Firm' }].map(t => (
                    <button
                      key={t.value}
                      className={`${styles.toneBtn} ${tone === t.value ? styles.toneBtnActive : ''}`}
                      onClick={() => setTone(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={generateEmail} className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={loading} id="generate-email-btn">
                  {loading ? 'Generating...' : '✉️ Generate Email'}
                </button>
              </div>
            )}
          </div>

          {/* Right: Email preview */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Email Preview</h2>
              {emailDraft && (
                <button onClick={copyToClipboard} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                  {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
              )}
            </div>
            {emailDraft ? (
              <div className={styles.emailPreview}>
                <pre className={styles.emailText}>{emailDraft}</pre>
              </div>
            ) : (
              <div className={styles.emptyEmail}>
                <span>✉️</span>
                <p>Select an obligation and generate an email to preview it here</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
