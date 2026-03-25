'use client';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './Sidebar.module.css';

export default function Sidebar({ user }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: '📊', path: '/dashboard' },
    { label: 'Upload Bills', icon: '📄', path: '/upload' },
    { label: 'Obligations', icon: '📋', path: '/obligations' },
    { label: 'Scenarios', icon: '🎯', path: '/scenarios' },
    { label: 'Email Drafter', icon: '✉️', path: '/emails' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>₹</div>
        <span className={styles.brandName}>Logicash</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`${styles.navItem} ${pathname === item.path ? styles.active : ''}`}
            id={`nav-${item.path.replace('/', '')}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.bottom}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className={styles.userMeta}>
            <div className={styles.userName}>{user?.email?.split('@')[0] || 'User'}</div>
            <div className={styles.userEmail}>{user?.email || ''}</div>
          </div>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn} id="logout-btn">
          Logout
        </button>
      </div>
    </aside>
  );
}
