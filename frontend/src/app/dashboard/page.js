'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(true);
  const [runway, setRunway] = useState(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      await fetchObligations(session.user.id);
      setLoading(false);
    };
    init();
  }, [router]);

  const fetchObligations = async (userId) => {
    const { data, error } = await supabase
      .from('obligations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_paid', false)
      .order('due_date', { ascending: true });

    if (!error && data) setObligations(data);
  };

  const calcRunway = () => {
    const bal = parseFloat(balance);
    if (isNaN(bal) || bal <= 0 || obligations.length === 0) return;

    const totalObl = obligations.reduce((sum, o) => sum + (o.amount || 0), 0);
    const daysSpan = Math.max(30, (() => {
      const dates = obligations.map(o => new Date(o.due_date).getTime());
      return Math.ceil((Math.max(...dates) - Date.now()) / 86400000);
    })());
    const avgDaily = totalObl / daysSpan;
    const daysToZero = avgDaily > 0 ? Math.floor(bal / avgDaily) : Infinity;
    setRunway(daysToZero);
    setConflict(totalObl > bal);
  };

  useEffect(() => {
    if (balance && obligations.length > 0) calcRunway();
  }, [balance, obligations]);

  const totalUnpaid = obligations.reduce((sum, o) => sum + (o.amount || 0), 0);
  const criticalCount = obligations.filter(o => o.is_critical).length;

  if (loading) {
    return (
      <div className={styles.layout}>
        <Sidebar user={null} />
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>ACCESSING DATA...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.greeting}>{user?.email?.split('@')[0]}</h1>
            <p className={styles.subtitle}>Financial Overview</p>
          </div>
          <div className={styles.balanceInput}>
            <p className={styles.subtitle}>Current Balance (₹)</p>
            <input
              type="number"
              className="input-field"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              style={{ width: '200px', fontSize: '1.2rem', fontWeight: '900', border: 'none', borderBottom: '2px solid #222', textAlign: 'right', padding: '8px 0' }}
            />
          </div>
        </header>

        {/* Warning Banner */}
        {conflict && (
          <div className={styles.warningBanner}>
            <div>
              <strong>CASH FLOW CONFLICT</strong>
              <p>Obligations (₹{totalUnpaid.toLocaleString()}) exceed balance.</p>
            </div>
            <button onClick={() => router.push('/scenarios')} className="btn-primary">
              STRATEGIZE
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>₹{balance ? parseFloat(balance).toLocaleString() : '0'}</div>
            <div className={styles.statLabel}>BALANCE</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>₹{totalUnpaid.toLocaleString()}</div>
            <div className={styles.statLabel}>UNPAID</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{runway !== null ? (runway === Infinity ? '∞' : runway) : '—'}</div>
            <div className={styles.statLabel}>RUNWAY (DAYS)</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{criticalCount}</div>
            <div className={styles.statLabel}>CRITICAL</div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className={styles.twoCol}>
          <div>
            <h2 className={styles.panelTitle}>Pending Obligations</h2>
            {obligations.length === 0 ? (
              <p className={styles.subtitle}>No pending obligations found.</p>
            ) : (
              <div className={styles.obligationList}>
                {obligations.slice(0, 10).map((obl, i) => {
                  const daysLeft = Math.ceil((new Date(obl.due_date) - new Date()) / 86400000);
                  return (
                    <div key={obl.id || i} className={styles.oblRow}>
                      <div>
                        <div className={styles.oblVendor}>
                          {obl.vendor?.toUpperCase() || 'UNKNOWN'}
                        </div>
                        <div className={styles.oblCategory}>{obl.category?.toUpperCase() || 'GENERAL'}</div>
                      </div>
                      <div className={styles.oblRight}>
                        <div className={styles.oblAmount}>₹{(obl.amount || 0).toLocaleString()}</div>
                        <div className={`${styles.oblDue} ${daysLeft <= 3 ? styles.dueDanger : ''}`}>
                          {daysLeft < 0 ? 'OVERDUE' : daysLeft === 0 ? 'TODAY' : `${daysLeft}D`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className={styles.panelTitle}>Operations</h2>
            <div className={styles.actionGrid}>
              <button onClick={() => router.push('/upload')} className={styles.actionCard}>
                <span className={styles.actionLabel}>Upload</span>
                <span className={styles.actionDesc}>Scan or add bills</span>
              </button>
              <button onClick={() => router.push('/obligations')} className={styles.actionCard}>
                <span className={styles.actionLabel}>Manage</span>
                <span className={styles.actionDesc}>View all entries</span>
              </button>
              <button onClick={() => router.push('/scenarios')} className={styles.actionCard}>
                <span className={styles.actionLabel}>Simulate</span>
                <span className={styles.actionDesc}>Payment strategies</span>
              </button>
              <button onClick={() => router.push('/emails')} className={styles.actionCard}>
                <span className={styles.actionLabel}>Communicate</span>
                <span className={styles.actionDesc}>Vendor negotiation</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}