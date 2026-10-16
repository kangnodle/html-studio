export function textEditingRule(tag: string, childTags: readonly string[]) {
  if (/^(HTML|BODY|IMG|INPUT|TEXTAREA|SELECT|VIDEO|IFRAME)$/.test(tag)) return 'blocked';
  return childTags.every((child) => /^(BR|SPAN|B|STRONG|I|EM|U|A)$/.test(child))
    ? 'editable'
    : 'select-child';
}
