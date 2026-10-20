import InlineAlert from './InlineAlert';

export default function FormError({ message }) {
  if (!message) {
    return null;
  }

  return <InlineAlert variant="error">{message}</InlineAlert>;
}
