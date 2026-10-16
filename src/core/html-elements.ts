export const htmlElements = [
  ['p', '문구'],
  ['nav', '탐색 메뉴'],
  ['main', '본문 영역'],
  ['section', '섹션'],
  ['article', '글 영역'],
  ['div', '컨테이너'],
  ['h1', '제목 1'],
  ['h2', '제목 2'],
  ['h3', '제목 3'],
  ['h4', '제목 4'],
  ['table', '표'],
  ['code', '코드블록'],
  ['ul', '글머리 목록'],
  ['ol', '번호 목록'],
  ['blockquote', '인용문'],
  ['a', '링크'],
] as const;

export type HtmlElementTag = (typeof htmlElements)[number][0];
