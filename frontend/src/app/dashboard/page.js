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
  const dueSoon = obligations.filter(o => {
    const diff = (new Date(o.due_date) - new Date()) / 86400000;
    return diff <= 7 && diff >= 0;
  }).length;

  if (loading) {
    return (
      <div className={styles.layout}>
        <Sidebar user={null} />
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Loading your financial data...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.greeting}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.email?.split('@')[0]}</h1>
            <p className={styles.subtitle}>Here&apos;s your financial overview</p>
          </div>
          <div className={styles.balanceInput}>
            <label className="form-label" htmlFor="balance-input">Current Balance (₹)</label>
            <input
              id="balance-input"
              type="number"
              className="input-field"
              placeholder="Enter balance..."
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              style={{ width: '200px' }}
            />
          </div>
        </div>

        {/* Warning Banner */}
        {conflict && (
          <div className={styles.warningBanner}>
            <span className={styles.warningIcon}>⚠️</span>
            <div>
              <strong>Cash Flow Conflict Detected!</strong>
              <p>Your total obligations (₹{totalUnpaid.toLocaleString()}) exceed your current balance. Consider reviewing payment scenarios.</p>
            </div>
            <button onClick={() => router.push('/scenarios')} className="btn-primary" style={{ flexShrink: 0 }}>
              View Scenarios
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.statBlue}`}>
            <div className={styles.statIcon}>💰</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>₹{balance ? parseFloat(balance).toLocaleString() : '—'}</div>
              <div className={styles.statLabel}>Current Balance</div>
            </div>
          </div>
          <div className={`${styles.statCard} ${styles.statAmber}`}>
            <div className={styles.statIcon}>📋</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>₹{totalUnpaid.toLocaleString()}</div>
              <div className={styles.statLabel}>Total Unpaid</div>
            </div>
          </div>
          <div className={`${styles.statCard} ${runway !== null && runway < 30 ? styles.statRose : styles.statEmerald}`}>
            <div className={styles.statIcon}>⏱️</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{runway !== null ? (runway === Infinity ? '∞' : `${runway} days`) : '—'}</div>
              <div className={styles.statLabel}>Days to Zero</div>
            </div>
          </div>
          <div className={`${styles.statCard} ${styles.statViolet}`}>
            <div className={styles.statIcon}>🔥</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{criticalCount}</div>
              <div className={styles.statLabel}>Critical Bills</div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className={styles.twoCol}>
          {/* Upcoming Obligations */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Upcoming Obligations</h2>
              <span className="badge badge-amber">{dueSoon} due this week</span>
            </div>
            {obligations.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No obligations yet. Upload your bills to get started.</p>
                <button onClick={() => router.push('/upload')} className="btn-primary" id="upload-cta">
                  Upload Bills
                </button>
              </div>
            ) : (
              <div className={styles.obligationList}>
                {obligations.slice(0, 8).map((obl, i) => {
                  const daysLeft = Math.ceil((new Date(obl.due_date) - new Date()) / 86400000);
                  return (
                    <div key={obl.id || i} className={styles.oblRow} style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className={styles.oblInfo}>
                        <div className={styles.oblVendor}>
                          {obl.vendor || 'Unknown'}
                          {obl.is_critical && <span className="badge badge-rose" style={{ marginLeft: 8 }}>CRITICAL</span>}
                        </div>
                        <div className={styles.oblCategory}>{obl.category || 'general'}</div>
                      </div>
                      <div className={styles.oblRight}>
                        <div className={styles.oblAmount}>₹{(obl.amount || 0).toLocaleString()}</div>
                        <div className={`${styles.oblDue} ${daysLeft <= 3 ? styles.dueDanger : daysLeft <= 7 ? styles.dueWarn : ''}`}>
                          {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Quick Actions</h2>
            <div className={styles.actionGrid}>
              <button onClick={() => router.push('/upload')} className={styles.actionCard} id="action-upload">
                <span className={styles.actionIcon}>📄</span>
                <span className={styles.actionLabel}>Upload Bills</span>
                <span className={styles.actionDesc}>Scan or manually add</span>
              </button>
              <button onClick={() => router.push('/obligations')} className={styles.actionCard} id="action-obligations">
                <span className={styles.actionIcon}>📋</span>
                <span className={styles.actionLabel}>View All</span>
                <span className={styles.actionDesc}>Manage obligations</span>
              </button>
              <button onClick={() => router.push('/scenarios')} className={styles.actionCard} id="action-scenarios">
                <span className={styles.actionIcon}>🎯</span>
                <span className={styles.actionLabel}>Scenarios</span>
                <span className={styles.actionDesc}>Payment strategies</span>
              </button>
              <button onClick={() => router.push('/emails')} className={styles.actionCard} id="action-emails">
                <span className={styles.actionIcon}>✉️</span>
                <span className={styles.actionLabel}>Email Drafter</span>
                <span className={styles.actionDesc}>Vendor negotiation</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
