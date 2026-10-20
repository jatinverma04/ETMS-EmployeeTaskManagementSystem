import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { focusRing, inputBase } from '../../utils/styles';
import Icon from './Icon';

function firstEnabledIndex(options) {
  return options.findIndex((option) => !option.disabled);
}

function lastEnabledIndex(options) {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index].disabled) {
      return index;
    }
  }

  return -1;
}

function initialIndex(options, value) {
  const selectedIndex = options.findIndex(
    (option) => option.value === value && !option.disabled,
  );

  return selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options);
}

function nextEnabledIndex(options, currentIndex, direction) {
  if (options.length === 0) {
    return -1;
  }

  let index = currentIndex;

  for (let step = 0; step < options.length; step += 1) {
    index = (index + direction + options.length) % options.length;

    if (!options[index].disabled) {
      return index;
    }
  }

  return -1;
}

export default function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  showSelectedDescription = false,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-labelledby': ariaLabelledBy,
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedOption = options.find((option) => option.value === value);
  const safeActiveIndex =
    activeIndex >= 0 && activeIndex < options.length ? activeIndex : -1;

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
      optionRefs.current[safeActiveIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, safeActiveIndex]);

  function openMenu() {
    setActiveIndex(initialIndex(options, value));
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
  }

  function selectOption(option) {
    if (!option || option.disabled) {
      return;
    }

    onChange(option.value);
    closeMenu();
    buttonRef.current?.focus();
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
          nextEnabledIndex(options, current < 0 ? -1 : current, 1),
        );
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!open) {
        setActiveIndex(initialIndex(options, value));
        setOpen(true);
      } else {
        setActiveIndex((current) =>
          nextEnabledIndex(options, current < 0 ? 0 : current, -1),
        );
      }
      return;
    }

    if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(options));
      return;
    }

    if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(lastEnabledIndex(options));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      if (!open) {
        openMenu();
      } else {
        selectOption(options[safeActiveIndex]);
      }
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === 'Tab') {
      closeMenu();
    }
  }

  return (
    <div
      className={cn('relative', className)}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeMenu();
        }
      }}
    >
      <button
        ref={buttonRef}
        id={fieldId}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && safeActiveIndex >= 0 ? `${fieldId}-option-${safeActiveIndex}` : undefined
        }
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          inputBase,
          'flex items-center justify-between gap-2 text-left',
          focusRing,
          !selectedOption && 'text-ink-muted',
        )}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {selectedOption?.label || placeholder}
          </span>
          {showSelectedDescription && selectedOption?.description ? (
            <span className="mt-0.5 block truncate text-xs font-normal text-ink-muted">
              {selectedOption.description}
            </span>
          ) : null}
        </span>
        <Icon
          name="chevronDown"
          className={cn(
            'h-4 w-4 text-ink-muted transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabelledBy || fieldId}
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-3 py-3 text-sm text-ink-muted" aria-disabled="true">
              No options available
            </li>
          ) : (
            options.map((option, index) => {
              const selected = option.value === value;
              const active = index === safeActiveIndex;

              return (
                <li
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  id={`${fieldId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  className={cn(
                    'flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none',
                    active && 'bg-surface-muted text-ink',
                    selected && 'bg-primary-soft font-semibold text-primary',
                    option.disabled && 'cursor-not-allowed text-ink-muted opacity-50',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => {
                    if (!option.disabled) {
                      setActiveIndex(index);
                    }
                  }}
                  onClick={() => selectOption(option)}
                >
                  <span className="block">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                      {option.description}
                    </span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
