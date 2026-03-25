'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import styles from './scenarios.module.css';

export default function ScenariosPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState('');
  const [scenarios, setScenarios] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
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

  const handleBalanceChange = async (e) => {
    const val = e.target.value;
    setBalance(val);
    await supabase.auth.updateUser({
      data: { balance: val }
    });
  };

  const runScenarios = async () => {
    if (!balance || obligations.length === 0) return;
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obligations, balance: parseFloat(balance) }),
      });
      if (!res.ok) throw new Error('Engine failed');
      const data = await res.json();
      setScenarios(data.scenarios);
      setSelectedScenario(data.recommended);
      setExplanation(data.explanation || '');
    } catch {
      const localScenarios = generateLocalScenarios(obligations, parseFloat(balance));
      setScenarios(localScenarios);
      setSelectedScenario('penalty_minimization');
    } finally {
      setLoading(false);
    }
  };

  const generateLocalScenarios = (obls, bal) => {
    const today = new Date();
    const scored = (weightConfig) => {
      return obls.map(o => {
        const daysLeft = Math.max(1, Math.ceil((new Date(o.due_date) - today) / 86400000));
        const urgency = 1 / daysLeft;
        const penaltyScore = o.penalty ? weightConfig.penalty : 0;
        const flexScore = o.flexibility ? 0 : weightConfig.flexibility;
        const catScore = ['salary', 'tax', 'rent', 'loan_emi'].includes(o.category) ? weightConfig.category_high : (['vendor'].includes(o.category) ? weightConfig.category_med : 0);
        const smallBonus = o.amount < bal * 0.1 ? weightConfig.small_bonus : 0;
        const criticalOverride = o.is_critical ? 999 : 0;

        const score = criticalOverride + penaltyScore + (urgency * weightConfig.urgency_mult) + flexScore + catScore + smallBonus;
        return { ...o, score, daysLeft };
      }).sort((a, b) => b.score - a.score);
    };

    const penaltyMin = scored({ penalty: 5, urgency_mult: 3, flexibility: 2, category_high: 3, category_med: 1, small_bonus: 1 });
    const relationship = scored({ penalty: 2, urgency_mult: 2, flexibility: 3, category_high: 2, category_med: 4, small_bonus: 2 });
    const runway = scored({ penalty: 1, urgency_mult: 1, flexibility: 1, category_high: 4, category_med: 1, small_bonus: 4 });

    const buildPlan = (sorted) => {
      let remaining = bal;
      return sorted.map(o => {
        const canPay = remaining >= o.amount;
        if (canPay) remaining -= o.amount;
        return { ...o, action: canPay ? 'PAY' : 'DEFER', remaining_after: canPay ? remaining : remaining };
      });
    };

    return {
      penalty_minimization: {
        name: 'PENALTY MINIMIZATION',
        description: 'PRIORITIZES OBLIGATIONS WITH LATE PENALTIES TO MINIMIZE UNNECESSARY EXPENDITURE.',
        plan: buildPlan(penaltyMin),
      },
      relationship_preservation: {
        name: 'RELATIONSHIP PRESERVATION',
        description: 'PROTECTS STRATEGIC VENDOR RELATIONSHIPS BY PRIORITIZING KEY PARTNER PAYMENTS.',
        plan: buildPlan(relationship),
      },
      runway_maximization: {
        name: 'RUNWAY MAXIMIZATION',
        description: 'EXTENDS OPERATIONAL RUNWAY BY DEFERRING NON-CRITICAL CASH OUTFLOWS.',
        plan: buildPlan(runway),
      },
    };
  };

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
        <p className={styles.pageDesc}>Model payment vectors and optimize capital allocation</p>

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
          <div className={styles.emptyState}>
            NO UNPAID OBLIGATIONS IDENTIFIED
          </div>
        )}

        {/* Scenario Cards */}
        {scenarios && (
          <>
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

            {/* Payment Plan */}
            {selected && (
              <div className={styles.planPanel}>
                <h2 className={styles.planTitle}>
                  {selected.name} — ALLOCATION PLAN
                </h2>
                <div className={styles.planList}>
                  {selected.plan.map((item, i) => (
                    <div key={item.id || i} className={`${styles.planItem} ${item.action === 'DEFER' ? styles.planDeferred : ''}`}>
                      <div className={styles.planOrder}>{String(i + 1).padStart(2, '0')}</div>
                      <div className={styles.planInfo}>
                        <div className={styles.planVendor}>
                          {item.vendor?.toUpperCase()}
                          {item.is_critical && <span className="badge" style={{ marginLeft: 12, borderColor: '#f43f5e', color: '#f43f5e' }}>PRIORITY</span>}
                        </div>
                        <div className={styles.planCategory}>{item.category?.toUpperCase()} · T-{item.daysLeft}D</div>
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