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
        body: JSON.stringify({ obligation: selectedObl, tone, user_name: user?.email?.split('@')[0]?.toUpperCase() || 'FINANCIAL OFFICER' }),
      });
      if (!res.ok) throw new Error('Draft failed');
      const data = await res.json();
      setEmailDraft(data.email?.toUpperCase());
    } catch {
      // Local fallback template
      const daysLeft = Math.ceil((new Date(selectedObl.due_date) - new Date()) / 86400000);
      const userName = user?.email?.split('@')[0]?.toUpperCase() || 'FINANCIAL OFFICER';
      const overdue = daysLeft < 0;

      const templates = {
        professional: `SUBJECT: REGARDING PAYMENT FOR INVOICE — ${selectedObl.vendor?.toUpperCase()}

DEAR ${selectedObl.vendor?.toUpperCase()} TEAM,

I AM WRITING TO DISCUSS THE OUTSTANDING PAYMENT OF ₹${selectedObl.amount?.toLocaleString()} ${overdue ? 'WHICH WAS DUE ON' : 'SCHEDULED FOR'} ${selectedObl.due_date}.

DUE TO CURRENT CASH FLOW ALLOCATION PRIORITIES, WE REQUIRE A REVISED TIMELINE FOR THIS SETTLEMENT. WE REMAIN COMMITTED TO THE OBLIGATION.

REGARDS,
${userName}`,

        empathetic: `SUBJECT: PAYMENT TIMELINE — ${selectedObl.vendor?.toUpperCase()}

DEAR ${selectedObl.vendor?.toUpperCase()} TEAM,

WE ARE NAVIGATING CASH FLOW ADJUSTMENTS AND REQUIRE ADDITIONAL TIME TO PROCESS THE PAYMENT OF ₹${selectedObl.amount?.toLocaleString()} ${overdue ? '(PAST DUE)' : `DUE ON ${selectedObl.due_date}`}.

WE VALUE THE PARTNERSHIP AND ARE WORKING TOWARDS A RESOLUTION.

BEST,
${userName}`,

        firm: `SUBJECT: STATUS UPDATE: INVOICE — ${selectedObl.vendor?.toUpperCase()}

DEAR ${selectedObl.vendor?.toUpperCase()},

REGARDING THE PAYMENT OF ₹${selectedObl.amount?.toLocaleString()} ${overdue ? `ORIGINALLY DUE ${selectedObl.due_date}` : `DUE ON ${selectedObl.due_date}`}.

INTERNAL CAPITAL ALLOCATION HAS PRIORITIZED OTHER VECTORS. WE EXPECT TO FINALIZE THIS SETTLEMENT WITHIN 10-15 BUSINESS DAYS.

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
        <h1 className={styles.pageTitle}>Correspondence</h1>
        <p className={styles.pageDesc}>Automated negotiation drafting for capital preservation</p>

        <div className={styles.twoCol}>
          {/* Left: Select obligation */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>SELECT OBLIGATION</h2>
            {obligations.length === 0 ? (
              <p className={styles.muted}>NO UNPAID ENTRIES IDENTIFIED</p>
            ) : (
              <div className={styles.oblList}>
                {obligations.map((obl, i) => (
                  <button
                    key={obl.id || i}
                    className={`${styles.oblItem} ${selectedObl?.id === obl.id ? styles.oblItemActive : ''}`}
                    onClick={() => { setSelectedObl(obl); setEmailDraft(''); }}
                  >
                    <div className={styles.oblVendor}>{obl.vendor?.toUpperCase()}</div>
                    <div className={styles.oblMeta}>₹{obl.amount?.toLocaleString()} · {obl.due_date}</div>
                  </button>
                ))}
              </div>
            )}

            {selectedObl && (
              <div className={styles.toneSection}>
                <label className="section-title" style={{ fontSize: '0.7rem', marginBottom: 16 }}>COMMUNICATION VECTOR</label>
                <div className={styles.toneRow}>
                  {[{ value: 'professional', label: 'PROFESSIONAL' }, { value: 'empathetic', label: 'EMPATHETIC' }, { value: 'firm', label: 'FIRM' }].map(t => (
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
                  {loading ? 'DRAFTING...' : 'GENERATE DRAFT'}
                </button>
              </div>
            )}
          </div>

          {/* Right: Email preview */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>DRAFT PREVIEW</h2>
              {emailDraft && (
                <button onClick={copyToClipboard} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.7rem' }}>
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              )}
            </div>
            {emailDraft ? (
              <div className={styles.emailPreview}>
                <pre className={styles.emailText}>{emailDraft}</pre>
              </div>
            ) : (
              <div className={styles.emptyEmail}>
                SELECT OBLIGATION TO GENERATE
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}