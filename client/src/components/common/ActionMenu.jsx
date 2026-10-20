import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { focusRing } from '../../utils/styles';
import Button from './Button';
import Icon from './Icon';

function firstEnabledIndex(items) {
  return items.findIndex((item) => !item.disabled);
}

function lastEnabledIndex(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index].disabled) {
      return index;
    }
  }

  return -1;
}

function nextEnabledIndex(items, current, direction) {
  if (items.length === 0) {
    return -1;
  }

  let index = current;

  for (let step = 0; step < items.length; step += 1) {
    index = (index + direction + items.length) % items.length;

    if (!items[index].disabled) {
      return index;
    }
  }

  return -1;
}

export default function ActionMenu({
  label = 'Actions',
  ariaLabel,
  items,
  variant = 'ghost',
  className,
  disabled = false,
}) {
  const navigate = useNavigate();
  const menuId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState('down');
  const safeActiveIndex =
    activeIndex >= 0 && activeIndex < items.length ? activeIndex : -1;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open && safeActiveIndex >= 0) {
      itemRefs.current[safeActiveIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, safeActiveIndex]);

  useEffect(() => {
    if (open && safeActiveIndex >= 0) {
      itemRefs.current[safeActiveIndex]?.focus();
    }
  }, [open]);

  function computePlacement() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return 'down';
    }

    const triggerRect = trigger.getBoundingClientRect();
    const boundary = trigger.closest('[data-scroll-container]');
    const boundaryRect = boundary
      ? boundary.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const menuHeight = items.length * 52 + 16;
    const spaceBelow = boundaryRect.bottom - triggerRect.bottom;
    const spaceAbove = triggerRect.top - boundaryRect.top;

    if (spaceBelow >= menuHeight) {
      return 'down';
    }

    if (spaceAbove >= menuHeight) {
      return 'up';
    }

    return 'inline';
  }

  function openMenu(index = firstEnabledIndex(items)) {
    if (disabled) {
      return;
    }

    setPlacement(computePlacement());
    setActiveIndex(index);
    setOpen(true);
  }

  function activate(item) {
    if (!item || item.disabled) {
      return;
    }

    setOpen(false);

    if (item.to) {
      navigate(item.to, { state: item.state });
    } else {
      item.onClick?.();
    }

    triggerRef.current?.focus();
  }

  function focusItem(index) {
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  }

  function handleMenuKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(nextEnabledIndex(items, safeActiveIndex, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(
        nextEnabledIndex(items, safeActiveIndex < 0 ? 0 : safeActiveIndex, -1),
      );
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusItem(firstEnabledIndex(items));
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusItem(lastEnabledIndex(items));
      return;
    }

    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  function handleKeyDown(event) {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (!open) {
        openMenu();
      } else {
        setActiveIndex((current) =>
          nextEnabledIndex(items, current < 0 ? -1 : current, 1),
        );
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!open) {
        openMenu(lastEnabledIndex(items));
      } else {
        setActiveIndex((current) =>
          nextEnabledIndex(items, current < 0 ? 0 : current, -1),
        );
      }
      return;
    }

    if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(items));
      return;
    }

    if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(lastEnabledIndex(items));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      if (!open) {
        openMenu();
      } else {
        activate(items[safeActiveIndex]);
      }
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-block text-left', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size="sm"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        {label}
        <Icon
          name="chevronDown"
          className={cn(
            'h-4 w-4 text-ink-muted transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel || label}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'z-40 rounded-xl border border-border bg-surface p-1 shadow-lg',
            placement === 'inline'
              ? 'mt-1 w-44'
              : 'absolute right-0 min-w-44',
            placement === 'up' && 'bottom-full mb-1',
            placement === 'down' && 'top-full mt-1',
          )}
        >
          {items.map((item, index) => {
            const active = index === safeActiveIndex;
            const itemClasses = cn(
              'flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors motion-reduce:transition-none',
              focusRing,
              active && 'bg-surface-muted text-ink',
              item.tone === 'danger' ? 'text-rust' : 'text-ink',
              item.disabled && 'cursor-not-allowed text-ink-muted opacity-50',
            );

            if (item.disabled) {
              return (
                <span
                  key={item.label}
                  role="menuitem"
                  aria-disabled="true"
                  className={itemClasses}
                >
                  {item.label}
                </span>
              );
            }

            if (item.to) {
              return (
                <Link
                  key={item.label}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  id={`${menuId}-item-${index}`}
                  to={item.to}
                  state={item.state}
                  role="menuitem"
                  tabIndex={active ? 0 : -1}
                  className={itemClasses}
                  onFocus={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.label}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                id={`${menuId}-item-${index}`}
                type="button"
                role="menuitem"
                tabIndex={active ? 0 : -1}
                className={itemClasses}
                onFocus={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => activate(item)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
