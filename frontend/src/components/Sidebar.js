'use client';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import styles from './Sidebar.module.css';

export default function Sidebar({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'DASHBOARD', path: '/dashboard' },
    { label: 'UPLOAD', path: '/upload' },
    { label: 'OBLIGATIONS', path: '/obligations' },
    { label: 'SCENARIOS', path: '/scenarios' },
    { label: 'EMAILS', path: '/emails' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandName}>LOGICASH</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`${styles.navItem} ${pathname === item.path ? styles.active : ''}`}
            id={`nav-${item.path.replace('/', '')}`}
          >
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.bottom}>
        <button onClick={toggleTheme} className={styles.themeToggle} id="theme-toggle">
          {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
        </button>
        <div className={styles.userInfo}>
          <div className={styles.userMeta}>
            <div className={styles.userName}>{user?.email?.split('@')[0]?.toUpperCase() || 'USER'}</div>
            <div className={styles.userEmail}>{user?.email || ''}</div>
          </div>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn} id="logout-btn">
          LOGOUT
        </button>
      </div>
    </aside>
  );
}