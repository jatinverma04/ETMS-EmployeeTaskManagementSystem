import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { inputBase } from '../../utils/styles';

const TextArea = forwardRef(function TextArea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputBase, 'min-h-28 resize-y py-3', className)}
      {...props}
    />
  );
});

export default TextArea;
