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
      // Fallback: Run local calculation
      const localScenarios = generateLocalScenarios(obligations, parseFloat(balance));
      setScenarios(localScenarios);
      setSelectedScenario('penalty_minimization');
    } finally {
      setLoading(false);
    }
  };

  // Local fallback decision engine
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
        name: 'Penalty Minimization',
        description: 'Prioritizes bills with late penalties to avoid extra costs',
        icon: '🛡️',
        color: '#f43f5e',
        plan: buildPlan(penaltyMin),
      },
      relationship_preservation: {
        name: 'Relationship Preservation',
        description: 'Keeps vendor relationships strong by paying key partners first',
        icon: '🤝',
        color: '#8b5cf6',
        plan: buildPlan(relationship),
      },
      runway_maximization: {
        name: 'Runway Maximization',
        description: 'Extends your cash runway by paying only critical obligations',
        icon: '🛫',
        color: '#10b981',
        plan: buildPlan(runway),
      },
    };
  };

  const scenarioMeta = [
    { key: 'penalty_minimization', name: 'Penalty Minimization', icon: '🛡️', color: '#f43f5e' },
    { key: 'relationship_preservation', name: 'Relationship Preservation', icon: '🤝', color: '#8b5cf6' },
    { key: 'runway_maximization', name: 'Runway Maximization', icon: '🛫', color: '#10b981' },
  ];

  const selected = scenarios && selectedScenario ? scenarios[selectedScenario] : null;

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Scenario Engine</h1>
        <p className={styles.pageDesc}>Run payment strategies and choose the best plan for your business</p>

        <div className={styles.inputRow}>
          <div className={styles.formGroup}>
            <label className="form-label" htmlFor="scenario-balance">Your Current Balance (₹)</label>
            <input
              id="scenario-balance"
              type="number"
              className="input-field"
              placeholder="Enter your bank balance..."
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <button onClick={runScenarios} className="btn-primary" disabled={loading || !balance || obligations.length === 0} id="run-scenarios-btn">
            {loading ? 'Analyzing...' : '🧠 Run Scenarios'}
          </button>
        </div>

        {obligations.length === 0 && (
          <div className={styles.emptyState}>
            <p>No unpaid obligations found. Upload bills first to run scenarios.</p>
            <button onClick={() => router.push('/upload')} className="btn-primary">Upload Bills</button>
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
                    style={{ '--card-accent': sm.color }}
                    id={`scenario-${sm.key}`}
                  >
                    <span className={styles.scenarioIcon}>{sm.icon}</span>
                    <h3>{sm.name}</h3>
                    <p className={styles.scenarioDesc}>{s.description}</p>
                    <div className={styles.scenarioStats}>
                      <div><strong>{payCount}</strong> payments</div>
                      <div><strong>₹{payTotal.toLocaleString()}</strong> total</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Payment Plan */}
            {selected && (
              <div className={styles.planPanel}>
                <h2 className={styles.planTitle}>
                  {selected.icon} {selected.name} — Payment Plan
                </h2>
                <div className={styles.planList}>
                  {selected.plan.map((item, i) => (
                    <div key={item.id || i} className={`${styles.planItem} ${item.action === 'DEFER' ? styles.planDeferred : ''}`}>
                      <div className={styles.planOrder}>{i + 1}</div>
                      <div className={styles.planInfo}>
                        <div className={styles.planVendor}>
                          {item.vendor}
                          {item.is_critical && <span className="badge badge-rose" style={{ marginLeft: 8 }}>CRITICAL</span>}
                        </div>
                        <div className={styles.planCategory}>{item.category} · Due in {item.daysLeft}d</div>
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

            {/* AI Explanation */}
            {explanation && (
              <div className={styles.explanationPanel}>
                <h3>🤖 AI Explanation</h3>
                <p>{explanation}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
