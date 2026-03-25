'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { useBalance } from '@/context/BalanceContext';
import { generateLocalScenarios } from '@/lib/decisions';
import styles from './scenarios.module.css';

export default function ScenariosPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { balance } = useBalance();
  const [scenarios, setScenarios] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [recommendedId, setRecommendedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [obligations, setObligations] = useState([]);
  const [explanation, setExplanation] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      
      if (session.user.user_metadata?.balance) {
        setBalance(session.user.user_metadata.balance);
      }

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

<<<<<<< HEAD
  const handleBalanceChange = async (e) => {
    const val = e.target.value;
    setBalance(val);
    await supabase.auth.updateUser({
      data: { balance: val }
    });
  };

  const runScenarios = async () => {
    if (!balance || obligations.length === 0) return;
=======
  useEffect(() => {
    if (obligations.length === 0) return;
>>>>>>> 0f677ddfb303a629d387e234e1a996ea6529fdc0
    setLoading(true);
    const floatBal = parseFloat(balance) || 0;
    try {
      // Using deterministic offline decision engine
      const { scenarios: localScenarios, recommended_id } = generateLocalScenarios(obligations, floatBal);
      setScenarios(localScenarios);
      setRecommendedId(recommended_id);
      if (!selectedScenario) setSelectedScenario(recommended_id);
    } finally {
      setLoading(false);
    }
  }, [balance, obligations, selectedScenario]);


  const scenarioMeta = [
    { key: 'penalty_minimization', name: 'PENALTY MINIMIZATION' },
    { key: 'relationship_preservation', name: 'RELATIONSHIP PRESERVATION' },
    { key: 'runway_maximization', name: 'RUNWAY MAXIMIZATION' },
  ];

  const selected = scenarios && selectedScenario ? scenarios[selectedScenario] : null;

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Strategy Engine</h1>
        <p className={styles.pageDesc}>Automated payment vector optimization based on current availability.</p>

<<<<<<< HEAD
        <div className={styles.inputRow}>
          <div className={styles.formGroup}>
            <label className="section-title" style={{ fontSize: '0.7rem', marginBottom: 8 }} htmlFor="scenario-balance">AVAILABLE BALANCE (₹)</label>
            <input
              id="scenario-balance"
              type="number"
              className="input-field"
              placeholder="0.00"
              value={balance}
              onChange={handleBalanceChange}
            />
          </div>
          <button onClick={runScenarios} className="btn-primary" disabled={loading || !balance || obligations.length === 0} id="run-scenarios-btn">
            {loading ? 'CALCULATING...' : 'EXECUTE ANALYSIS'}
          </button>
        </div>

        {obligations.length === 0 && (
=======
        {obligations.length === 0 ? (
>>>>>>> 0f677ddfb303a629d387e234e1a996ea6529fdc0
          <div className={styles.emptyState}>
            NO UNPAID OBLIGATIONS IDENTIFIED
          </div>
        ) : loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>CALCULATING STRATEGIES...</div>
        ) : (
          <>
            {/* Payment Plan */}
            {selected && (
              <div className={styles.planPanel} style={{ marginBottom: 60 }}>
                <h2 className={styles.planTitle} style={{ borderBottom: '2px solid var(--text-primary)', paddingBottom: 16, marginBottom: 24 }}>
                  {selectedScenario === recommendedId ? 'RECOMMENDED PLAN' : 'SELECTED SCENARIO'}: {selected.name}
                </h2>
                <p className={styles.scenarioDesc} style={{ marginBottom: 24, padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {selected.description}
                </p>
                <div className={styles.planList}>
                  {selected.plan.map((item, i) => (
                    <div key={item.id || i} className={`${styles.planItem} ${item.action === 'DEFER' ? styles.planDeferred : ''}`}>
                      <div className={styles.planOrder}>{String(i + 1).padStart(2, '0')}</div>
                      <div className={styles.planInfo}>
                        <div className={styles.planVendor}>
                          {item.vendor_display}
                          {item.is_critical && <span className="badge" style={{ marginLeft: 12, borderColor: '#f43f5e', color: '#f43f5e' }}>PRIORITY</span>}
                        </div>
                        <div className={styles.planCategory}>{item.category_display} · T-{item.daysLeft}D</div>
                      </div>
                      <div className={styles.planAmount}>₹{item.amount.toLocaleString()}</div>
                      <div className={`${styles.planAction} ${item.action === 'PAY' ? styles.planPay : styles.planDefer}`}>
                        {item.action}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternate Scenarios */}
            {scenarios && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 40 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 24 }}>ALTERNATE SCENARIOS</h3>
                <div className={styles.scenarioCards}>
                  {scenarioMeta.map(sm => {
                    const s = scenarios[sm.key];
                    if (!s) return null;
                    const payCount = s.plan.filter(p => p.action === 'PAY').length;
                    const payTotal = s.plan.filter(p => p.action === 'PAY').reduce((sum, p) => sum + p.amount, 0);
                    return (
                      <button
                        key={sm.key}
                        className={`${styles.scenarioCard} ${selectedScenario === sm.key ? styles.scenarioCardActive : ''}`}
                        onClick={() => setSelectedScenario(sm.key)}
                        id={`scenario-${sm.key}`}
                      >
                        <h3>{sm.name}</h3>
                        <p className={styles.scenarioDesc}>{s.description}</p>
                        <div className={styles.scenarioStats}>
                          <div><strong>{payCount}</strong> SETTLEMENTS</div>
                          <div><strong>₹{payTotal.toLocaleString()}</strong> OUTFLOW</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Explanation */}
            {explanation && (
              <div className={styles.explanationPanel}>
                <h3>ENGINE LOGIC</h3>
                <p>{explanation.toUpperCase()}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}