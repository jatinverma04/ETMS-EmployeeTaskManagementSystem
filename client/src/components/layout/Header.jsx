import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import Icon from '../common/Icon';
import IconButton from '../common/IconButton';
import MobileNav from './MobileNav';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/employees', label: 'Employees', icon: 'users' },
  { to: '/tasks', label: 'Tasks', icon: 'clipboard' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 bg-header text-surface shadow-sm">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/dashboard"
          className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-header"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold tracking-wider text-surface">
            ET
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-surface/70">
              ETMS
            </span>
            <span className="block truncate text-sm font-semibold tracking-tight sm:text-base">
              Employee Task Management
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-header motion-reduce:transition-none',
                  isActive
                    ? 'bg-surface/20 text-surface'
                    : 'text-surface/75 hover:bg-surface/10 hover:text-surface',
                )
              }
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <IconButton
          label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          className="text-surface hover:bg-surface/10 focus-visible:ring-surface focus-visible:ring-offset-header sm:hidden"
          onClick={() => setMobileOpen((value) => !value)}
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} />
        </IconButton>
      </div>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
