export function slugify(value, fallback = 'ITEM') {
  const slug = String(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 18);

  return slug || fallback;
}

export function makeId(prefix, value) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${slugify(value)}-${datePart}-${randomPart}`;
}
