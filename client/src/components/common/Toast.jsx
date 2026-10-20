import { cn } from '../../utils/cn';
import Icon from './Icon';
import IconButton from './IconButton';

const toastStyles = {
  success: 'border-olive/30 bg-olive-soft text-olive',
  error: 'border-rust/30 bg-rust-soft text-rust',
  info: 'border-primary/20 bg-primary-soft text-primary',
};

const toastIcons = {
  success: 'check',
  error: 'alert',
  info: 'clipboard',
};

export default function Toast({ toast, onClose }) {
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
        toastStyles[toast.type],
      )}
    >
      <Icon name={toastIcons[toast.type]} className="mt-0.5 h-5 w-5" />
      <p className="min-w-0 flex-1 text-sm font-medium leading-6">{toast.message}</p>
      <IconButton
        label="Close notification"
        className="shrink-0 text-current"
        onClick={onClose}
      >
        <Icon name="close" className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
