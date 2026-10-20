import { useEffect, useRef, useState } from 'react';
import FormField from './FormField';
import TextInput from './TextInput';

export default function DebouncedSearchInput({
  id,
  label = 'Search',
  value,
  onSearch,
  placeholder,
}) {
  const [text, setText] = useState(value);
  const pendingRef = useRef(false);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      pendingRef.current = false;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (!pendingRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      pendingRef.current = false;
      lastValueRef.current = text;

      if (text !== value) {
        onSearch(text);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [onSearch, text, value]);

  function handleChange(event) {
    pendingRef.current = true;
    setText(event.target.value);
  }

  return (
    <FormField id={id} label={label}>
      <TextInput
        type="text"
        role="searchbox"
        value={text}
        maxLength={100}
        placeholder={placeholder}
        autoComplete="off"
        onChange={handleChange}
      />
    </FormField>
  );
}
