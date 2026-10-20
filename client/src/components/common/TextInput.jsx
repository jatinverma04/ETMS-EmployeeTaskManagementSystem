import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { inputBase } from '../../utils/styles';

const TextInput = forwardRef(function TextInput(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(inputBase, className)}
      {...props}
    />
  );
});

export const EmailInput = forwardRef(function EmailInput({ className, ...props }, ref) {
  return <TextInput ref={ref} type="email" className={className} {...props} />;
});

export const PhoneInput = forwardRef(function PhoneInput({ className, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      type="tel"
      inputMode="tel"
      className={className}
      {...props}
    />
  );
});

export default TextInput;
