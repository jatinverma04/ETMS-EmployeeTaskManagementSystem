import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import Icon from '../common/Icon';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/employees', label: 'Employees', icon: 'users' },
  { to: '/tasks', label: 'Tasks', icon: 'clipboard' },
];

export default function MobileNav({ open, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div id="mobile-navigation" className="border-t border-surface/10 px-4 pb-4 pt-2 sm:hidden">
      <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface focus-visible:ring-offset-2 focus-visible:ring-offset-header motion-reduce:transition-none',
                isActive
                  ? 'bg-surface/20 text-surface'
                  : 'text-surface/75 hover:bg-surface/10 hover:text-surface',
              )
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
