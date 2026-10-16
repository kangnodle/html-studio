// Distribute a text replacement across existing segments without losing their boundaries.
export function replaceTextSegments(segments: readonly string[], value: string): readonly string[] {
  const old = segments.join('');
  if (old === value) return segments;
  if (!segments.length) return [value];
  let start = 0,
    suffix = 0;
  while (start < old.length && start < value.length && old[start] === value[start]) start++;
  while (
    suffix < old.length - start &&
    suffix < value.length - start &&
    old[old.length - 1 - suffix] === value[value.length - 1 - suffix]
  )
    suffix++;
  const end = old.length - suffix;
  const insertion = value.slice(start, value.length - suffix);
  let offset = 0,
    inserted = false;
  return segments.map((segment) => {
    const length = segment.length;
    const from = Math.max(0, Math.min(length, start - offset));
    const to = Math.max(from, Math.min(length, end - offset));
    const receivesInsertion = !inserted && start <= offset + length;
    const next = segment.slice(0, from) + (receivesInsertion ? insertion : '') + segment.slice(to);
    if (receivesInsertion) inserted = true;
    offset += length;
    return next;
  });
}
