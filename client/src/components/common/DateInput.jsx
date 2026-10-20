import { forwardRef } from 'react';
import TextInput from './TextInput';

const DateInput = forwardRef(function DateInput({ placeholder = 'YYYY-MM-DD', ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={10}
      placeholder={placeholder}
      {...props}
    />
  );
});

export default DateInput;
