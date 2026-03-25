'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import styles from './obligations.module.css';

export default function ObligationsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unpaid, paid, critical

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      fetchObligations(session.user.id);
    };
    init();
  }, [router]);

  const fetchObligations = async (userId) => {
    const { data } = await supabase
      .from('obligations')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });
    if (data) setObligations(data);
  };

  const togglePaid = async (oblId, currentStatus) => {
    await supabase.from('obligations').update({ is_paid: !currentStatus }).eq('id', oblId);
    setObligations(prev => prev.map(o => o.id === oblId ? { ...o, is_paid: !currentStatus } : o));
  };

  const deleteObl = async (oblId) => {
    await supabase.from('obligations').delete().eq('id', oblId);
    setObligations(prev => prev.filter(o => o.id !== oblId));
  };

  const filtered = obligations.filter(o => {
    if (filter === 'unpaid') return !o.is_paid;
    if (filter === 'paid') return o.is_paid;
    if (filter === 'critical') return o.is_critical;
    return true;
  });

  const totalUnpaid = obligations.filter(o => !o.is_paid).reduce((s, o) => s + (o.amount || 0), 0);
  const totalPaid = obligations.filter(o => o.is_paid).reduce((s, o) => s + (o.amount || 0), 0);

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Obligations</h1>
            <p className={styles.pageDesc}>Manage all your financial obligations</p>
          </div>
          <button onClick={() => router.push('/upload')} className="btn-primary" id="add-obligation-btn">
            + Add New
          </button>
        </div>

        {/* Summary */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Unpaid</span>
            <span className={styles.summaryValue} style={{ color: '#fbbf24' }}>₹{totalUnpaid.toLocaleString()}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Paid</span>
            <span className={styles.summaryValue} style={{ color: '#34d399' }}>₹{totalPaid.toLocaleString()}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Items</span>
            <span className={styles.summaryValue}>{obligations.length}</span>
          </div>
        </div>

        {/* Filter */}
        <div className={styles.filterRow}>
          {['all', 'unpaid', 'paid', 'critical'].map(f => (
            <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'unpaid' ? 'Unpaid' : f === 'paid' ? 'Paid' : 'Critical'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className={styles.tableWrapper}>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>No obligations found. Upload a bill to get started!</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((obl, i) => {
                  const daysLeft = Math.ceil((new Date(obl.due_date) - new Date()) / 86400000);
                  return (
                    <tr key={obl.id || i} className={obl.is_paid ? styles.paidRow : ''}>
                      <td>
                        <div className={styles.vendorCell}>
                          {obl.vendor || 'Unknown'}
                          {obl.is_critical && <span className="badge badge-rose">CRITICAL</span>}
                          {obl.penalty === 1 && <span className="badge badge-amber">PENALTY</span>}
                        </div>
                      </td>
                      <td className={styles.amountCell}>₹{(obl.amount || 0).toLocaleString()}</td>
                      <td>
                        <span className={`${daysLeft <= 3 && !obl.is_paid ? styles.dueDanger : ''}`}>
                          {obl.due_date}
                        </span>
                        {!obl.is_paid && <div className={styles.daysHint}>{daysLeft < 0 ? 'Overdue' : `${daysLeft}d left`}</div>}
                      </td>
                      <td><span className={styles.categoryTag}>{obl.category || 'other'}</span></td>
                      <td>
                        <span className={`badge ${obl.is_paid ? 'badge-green' : 'badge-amber'}`}>
                          {obl.is_paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button onClick={() => togglePaid(obl.id, obl.is_paid)} className={styles.actionBtn} title={obl.is_paid ? 'Mark Unpaid' : 'Mark Paid'}>
                            {obl.is_paid ? '↩️' : '✅'}
                          </button>
                          <button onClick={() => deleteObl(obl.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Delete">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
