'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import styles from './upload.module.css';

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('ocr');
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
      setMode('manual');
      setSuccess('BILL SCANNED SUCCESSFULLY. PLEASE REVIEW.');
    } catch (err) {
      setError('OCR FAILED. ENTER DETAILS MANUALLY.');
      setMode('manual');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendor || !amount) {
      setError('VENDOR AND AMOUNT REQUIRED.');
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

      if (dbError) {
        // Postgres foreign key violation code is 23503
        if (dbError.code === '23503' || dbError.message.includes('obligations_user_id_fkey')) {
          throw new Error('SESSION INVALID. PLEASE LOG OUT AND LOG IN AGAIN.');
        }
        throw dbError;
      }

      setSuccess('OBLIGATION SAVED.');
      setVendor(''); setAmount(''); setDueDate('');
      setCategory('vendor'); setPenalty(false);
      setFlexibility(true); setIsCritical(false);
      setOcrResult(null);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'FAILED TO SAVE OBLIGATION');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'salary', label: 'SALARY' },
    { value: 'rent', label: 'RENT' },
    { value: 'tax', label: 'TAX' },
    { value: 'loan_emi', label: 'LOAN/EMI' },
    { value: 'utility', label: 'UTILITY' },
    { value: 'subscription', label: 'SUBSCRIPTION' },
    { value: 'vendor', label: 'VENDOR' },
    { value: 'other', label: 'OTHER' },
  ];

  return (
    <div className={styles.layout}>
      <Sidebar user={user} />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Upload</h1>
        <p className={styles.pageDesc}>Ingest obligations into the engine</p>

        {/* Mode Toggle */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === 'ocr' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('ocr')}
            id="mode-ocr"
          >
            SCAN BILL
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'manual' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('manual')}
            id="mode-manual"
          >
            MANUAL ENTRY
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
                <p className={styles.dropzoneText}>SELECT FILE</p>
                <p className={styles.dropzoneHint}>JPG, PNG, PDF</p>
              </div>
            </div>
            {loading && (
              <div className={styles.processingBanner}>
                <div className="spinner"></div>
                PROCESSING OBLIGATION...
              </div>
            )}
          </div>
        )}

        {/* Manual / Review Form */}
        {mode === 'manual' && (
          <form onSubmit={handleSubmit} className={styles.form}>
            {ocrResult && (
              <div className={styles.ocrBanner}>
                OBLIGATION IDENTIFIED. REVIEW DATA.
              </div>
            )}

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className="section-title" style={{ fontSize: '0.7rem', marginBottom: 8 }} htmlFor="vendor-input">Vendor</label>
                <input id="vendor-input" type="text" className="input-field" placeholder="VENDOR NAME" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className="section-title" style={{ fontSize: '0.7rem', marginBottom: 8 }} htmlFor="amount-input">Amount (₹)</label>
                <input id="amount-input" type="number" className="input-field" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" step="0.01" />
              </div>
              <div className={styles.formGroup}>
                <label className="section-title" style={{ fontSize: '0.7rem', marginBottom: 8 }} htmlFor="due-date-input">Due Date</label>
                <input id="due-date-input" type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className="section-title" style={{ fontSize: '0.7rem', marginBottom: 8 }} htmlFor="category-select">Category</label>
                <select id="category-select" className="select-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={penalty} onChange={(e) => setPenalty(e.target.checked)} />
                LATE PENALTY APPLICABLE
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={!flexibility} onChange={(e) => setFlexibility(!e.target.checked)} />
                NON-NEGOTIABLE
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
                CRITICAL PRIORITY
              </label>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}
            {success && <div className={styles.successMsg}>{success}</div>}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 12 }} id="save-obligation-btn">
              {loading ? 'PROCESSING...' : 'SAVE OBLIGATION'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}