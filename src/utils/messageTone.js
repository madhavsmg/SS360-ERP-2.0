const WARNING_MESSAGE_PATTERNS = [
  /^error:/i,
  /\b(required|invalid|must|cannot|can't|exceed|negative|future|unavailable|already)\b/i,
  /\b(no active|no outstanding|not available|not found|not linked|no longer|multiple active)\b/i,
  /\b(select|enter|add|scan|review)\b.+\bbefore\b/i,
  /^(select|enter|add|scan|review)\b/i,
  /\bonly\b.+\bavailable\b/i,
  /\bgreater than zero\b/i,
];

export function getMessageTone(message) {
  const text = String(message || '').trim();

  if (!text) {
    return 'info';
  }

  return WARNING_MESSAGE_PATTERNS.some((pattern) => pattern.test(text)) ? 'warning' : 'info';
}

export function getMessageClassName(message, baseClassName = 'erp-message') {
  return `${baseClassName} ${baseClassName}--${getMessageTone(message)}`;
}
