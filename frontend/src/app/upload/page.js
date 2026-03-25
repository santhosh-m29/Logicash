'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import styles from './upload.module.css';

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('manual'); // 'manual' or 'ocr'
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('vendor');
  const [penalty, setPenalty] = useState(false);
  const [flexibility, setFlexibility] = useState(true);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, [router]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/ocr`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('OCR processing failed');
      const data = await res.json();

      if (data.vendor) setVendor(data.vendor);
      if (data.amount) setAmount(String(data.amount));
      if (data.due_date) setDueDate(data.due_date);
      if (data.category) setCategory(data.category);

      setOcrResult(data);
      setMode('manual'); // Switch to manual for review
      setSuccess('Bill scanned successfully! Please review and save.');
    } catch (err) {
      setError('OCR failed. Please enter details manually.');
      setMode('manual');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendor || !amount) {
      setError('Vendor and amount are required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const finalDueDate = dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const { error: dbError } = await supabase.from('obligations').insert({
        user_id: user.id,
        vendor,
        amount: parseFloat(amount),
        due_date: finalDueDate,
        category,
        penalty: penalty ? 1 : 0,
        flexibility: flexibility ? 1 : 0,
        is_paid: false,
        is_critical: isCritical,
      });

      if (dbError) throw dbError;

      setSuccess('Obligation saved successfully!');
      // Reset form
      setVendor(''); setAmount(''); setDueDate('');
      setCategory('vendor'); setPenalty(false);
      setFlexibility(true); setIsCritical(false);
      setOcrResult(null);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save obligation');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'salary', label: '💼 Salary' },
    { value: 'rent', label: '🏠 Rent' },
    { value: 'tax', label: '🏛️ Tax' },
    { value: 'loan_emi', label: '🏦 Loan/EMI' },
    { value: 'utility', label: '⚡ Utility' },
    { value: 'subscription', label: '📱 Subscription' },
    { value: 'vendor', label: '🤝 Vendor' },
    { value: 'other', label: '📦 Other' },
  ];

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Upload Bills</h1>
        <p className={styles.pageDesc}>Scan a bill using OCR or enter details manually</p>

        {/* Mode Toggle */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === 'ocr' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('ocr')}
            id="mode-ocr"
          >
            📷 Scan Bill
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'manual' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('manual')}
            id="mode-manual"
          >
            ✏️ Manual Entry
          </button>
        </div>

        {/* OCR Upload */}
        {mode === 'ocr' && (
          <div className={styles.ocrPanel}>
            <div className={styles.ocrDropzone}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className={styles.fileInput}
                id="file-upload"
              />
              <div className={styles.dropzoneContent}>
                <span className={styles.dropzoneIcon}>📄</span>
                <p className={styles.dropzoneText}>Drop your bill here or click to upload</p>
                <p className={styles.dropzoneHint}>Supports: JPG, PNG, PDF</p>
              </div>
            </div>
            {loading && (
              <div className={styles.processingBanner}>
                <div className={styles.spinner}></div>
                Processing with OCR & AI...
              </div>
            )}
          </div>
        )}

        {/* Manual / Review Form */}
        {mode === 'manual' && (
          <form onSubmit={handleSubmit} className={styles.form}>
            {ocrResult && (
              <div className={styles.ocrBanner}>
                ✅ OCR data loaded. Please review and correct if needed.
              </div>
            )}

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className="form-label" htmlFor="vendor-input">Vendor Name *</label>
                <input id="vendor-input" type="text" className="input-field" placeholder="e.g. Amazon, Rent, HDFC" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className="form-label" htmlFor="amount-input">Amount (₹) *</label>
                <input id="amount-input" type="number" className="input-field" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" step="0.01" />
              </div>
              <div className={styles.formGroup}>
                <label className="form-label" htmlFor="due-date-input">Due Date</label>
                <input id="due-date-input" type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className="form-label" htmlFor="category-select">Category</label>
                <select id="category-select" className="select-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={penalty} onChange={(e) => setPenalty(e.target.checked)} />
                <span className={styles.checkboxCustom}></span>
                Has late penalty
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={!flexibility} onChange={(e) => setFlexibility(!e.target.checked)} />
                <span className={styles.checkboxCustom}></span>
                Non-negotiable
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
                <span className={`${styles.checkboxCustom} ${styles.checkboxCritical}`}></span>
                Critical / Must pay
              </label>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}
            {success && <div className={styles.successMsg}>{success}</div>}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 12 }} id="save-obligation-btn">
              {loading ? 'Saving...' : 'Save Obligation'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
