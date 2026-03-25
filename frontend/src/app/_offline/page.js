'use client';
import { useRouter } from 'next/navigation';
import styles from './offline.module.css';

export default function OfflinePage() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>📶</div>
        <h1 className={styles.title}>You are offline</h1>
        <p className={styles.desc}>
          Logicash requires an internet connection to sync your financial data and run scenarios. Please check your network and try again.
        </p>
        <button className="btn-primary" onClick={() => router.refresh()}>
          Try Again
        </button>
      </div>
    </div>
  );
}