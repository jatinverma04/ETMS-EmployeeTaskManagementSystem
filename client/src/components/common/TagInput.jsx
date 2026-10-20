import { useState } from 'react';
import { cn } from '../../utils/cn';
import { inputBase } from '../../utils/styles';
import Icon from './Icon';

export default function TagInput({
  id,
  value = [],
  onChange,
  placeholder = 'Type a skill and press Enter',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-labelledby': ariaLabelledBy,
}) {
  const [inputValue, setInputValue] = useState('');

  function addSkills() {
    const candidates = inputValue
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);

    if (candidates.length === 0) {
      setInputValue('');
      return;
    }

    onChange([...new Set([...value, ...candidates])]);
    setInputValue('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkills();
      return;
    }

    if (event.key === 'Backspace' && inputValue === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeSkill(skill) {
    onChange(value.filter((entry) => entry !== skill));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Selected skills">
          {value.map((skill) => (
            <li
              key={skill}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-sm font-medium text-primary"
            >
              <span>{skill}</span>
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
                onClick={() => removeSkill(skill)}
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        type="text"
        value={inputValue}
        placeholder={placeholder}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        aria-labelledby={ariaLabelledBy}
        className={cn(inputBase)}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addSkills}
      />
    </div>
  );
}
