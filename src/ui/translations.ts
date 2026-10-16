import type { Language } from '../core/preferences';

const english: Record<string, string> = {
  '추가할 요소': 'Element to add',
  '＋ 요소 추가': '＋ Add element',
  '새 내용을 입력하세요.': 'Enter new content here.',
  '탐색 메뉴': 'Navigation',
  '본문 영역': 'Main content',
  섹션: 'Section',
  '글 영역': 'Article',
  컨테이너: 'Container',
  '제목 1': 'Heading 1',
  '제목 2': 'Heading 2',
  '제목 3': 'Heading 3',
  '제목 4': 'Heading 4',
  표: 'Table',
  '글머리 목록': 'Bulleted list',
  '번호 목록': 'Numbered list',
  인용문: 'Quote',
  '선택한 요소 삭제': 'Delete selected element',
  '빈 문서는 요소 추가로 시작하세요.': 'Use Add element to start a blank document.',
  '선택한 컨테이너 안 또는 선택한 요소 뒤에 추가합니다.':
    'Insert inside the selected container or after the selected element.',
  '컨테이너를 삭제하면 내부 요소도 함께 삭제됩니다. 실행 취소로 복구할 수 있습니다.':
    'Deleting a container also deletes its contents. Undo restores them.',
  '본문 영역은 이미 있습니다. 기존 main 요소를 선택해 수정하세요.':
    'A main element already exists. Select it to edit.',
  '요소를 추가했습니다. 속성 패널에서 내용을 수정하세요.':
    'Element added. Edit its content in the inspector.',
  '요소를 삭제했습니다. 실행 취소로 복구할 수 있습니다.': 'Element deleted. Undo restores it.',
  '빈 HTML': 'Blank HTML',
  '사용자 매뉴얼': 'User manual',
  '연구 논문': 'Research paper',
  '발표 슬라이드': 'Presentation slides',
  '편집 실습': 'Editing practice',
  '본문과 스타일 없이, 최소 HTML 구조부터 시작합니다.':
    'Start with minimal HTML and no body content or styles.',
  '소개, 목차, 사용 절차, 설정 예시와 FAQ를 제공합니다.':
    'Includes an introduction, contents, steps, configuration examples and FAQ.',
  '초록, 연구 방법, 결과 표, 논의와 참고문헌을 제공합니다.':
    'Includes an abstract, methods, results table, discussion and references.',
  '표지부터 결론까지, 16:9 슬라이드 네 장으로 시작합니다.':
    'Four 16:9 slides, from the title to the conclusion.',
  '표, 코드, 이미지와 다양한 요소로 편집 기능을 익힙니다.':
    'Practice editing tables, code, images and other elements.',
  '어떤 문서를 만들까요?': 'What would you like to create?',
  '템플릿을 선택하고 나만의 문서로 편집하세요.': 'Choose a template and make it your own.',
  '기본 템플릿': 'Built-in templates',
  '템플릿 미리보기': 'Template preview',
  '완전히 빈 캔버스': 'A completely blank canvas',
  '선택한 뒤 문구 추가로 첫 내용을 작성하세요.':
    'After choosing, use Add text to write your first content.',
  '현재 문서의 변경 사항은 전환 전에 확인합니다.':
    'Unsaved changes are checked before switching documents.',
  '문서 만드는 중…': 'Creating document…',
  '이 템플릿으로 시작': 'Start with this template',
  취소: 'Cancel',
  닫기: 'Close',
  '외부 HTML': 'Imported HTML',
  '문서 메뉴': 'Document menu',
  '＋ 새 문서': '＋ New document',
  '템플릿 선택': 'Choose template',
  '＋ 문구 추가': '＋ Add text',
  '전체 너비': 'Full width',
  'A4 문서': 'A4 document',
  '16:9 슬라이드': '16:9 slides',
  '새 문구를 입력하세요.': 'Enter your text here.',
  '① 새 문서에서 템플릿을 선택하거나 파일을 여세요.':
    '① Choose a template from New document or open a file.',
  '빈 문서는 문구 추가로 시작하세요.': 'Use Add text to start a blank document.',
  '저장하지 않은 변경 사항을 버리고 새 문서를 만드시겠습니까?':
    'Discard unsaved changes and create a new document?',
  '확인 중 문서가 변경되었습니다. 문서 전환을 다시 시도하세요.':
    'The document changed during confirmation. Try switching again.',
  '새 문서를 만들었습니다. 내용을 편집한 뒤 HTML로 저장하세요.':
    'New document created. Edit the content and save it as HTML.',
  '문구를 추가했습니다. 더블 클릭해 수정하세요.': 'Text added. Double-click to edit.',
  수정됨: 'Modified',
  '↥ 파일 열기': '↥ Open file',
  '↓ HTML 저장': '↓ Save HTML',
  'HTML 덮어쓰기': 'Overwrite HTML',
  '열려 있는 원본 HTML 파일에 저장합니다.': 'Save to the open original HTML file.',
  '덮어쓰려면 파일 열기로 원본 파일을 선택하세요.':
    'Select the original file with Open file to enable overwriting.',
  'Ctrl+S 저장 · Esc 선택 해제': 'Ctrl+S Save · Esc Clear selection',
  '실행 취소 (Ctrl+Z)': 'Undo (Ctrl+Z)',
  '다시 실행 (Ctrl+Shift+Z)': 'Redo (Ctrl+Shift+Z)',
  미리보기: 'Preview',
  '✦ 편집 모드': '✦ Edit mode',
  데스크톱: 'Desktop',
  태블릿: 'Tablet',
  모바일: 'Mobile',
  '편집으로 돌아가기': 'Back to editing',
  '◉ 미리보기': '◉ Preview',
  '유동 너비': 'Fluid width',
  '스크립트 실행 제한': 'Scripts restricted',
  'HTML 편집 화면': 'HTML editor canvas',
  글자색: 'Text color',
  배경색: 'Background color',
  '글자 크기': 'Font size',
  글꼴: 'Font family',
  '안쪽 여백': 'Padding',
  '바깥 여백': 'Margin',
  모서리: 'Corner radius',
  테두리: 'Border',
  너비: 'Width',
  '요소 속성': 'Element properties',
  '편집할 요소를 선택하세요': 'Select an element to edit',
  '화면에서 요소를 클릭하면': 'Click an element on the canvas.',
  '스타일과 속성이 여기에 표시됩니다.': 'Its styles and properties appear here.',
  '빠른 시작': 'Quick start',
  '① HTML 파일을 열거나 끌어 놓으세요.': '① Open or drop an HTML file.',
  '② 텍스트를 더블 클릭해 수정하세요.': '② Double-click text to edit.',
  '③ 완성한 페이지를 HTML로 저장하세요.': '③ Save your page as HTML.',
  '선택한 요소': 'Selected element',
  '상위 요소 선택': 'Select parent',
  코드블록: 'Code block',
  '코드 내용': 'Code content',
  '표 크기': 'Table dimensions',
  '열 너비': 'Column width',
  '행 높이': 'Row height',
  '예: 120px': 'e.g. 120px',
  '셀 문구': 'Cell text',
  문구: 'Text',
  스타일: 'Style',
  '예: 16px': 'e.g. 16px',
  링크: 'Link',
  주소: 'URL',
  이미지: 'Image',
  '이미지 주소': 'Image URL',
  '대체 텍스트': 'Alt text',
  '↥ 이미지 파일로 교체': '↥ Replace with image file',
  한국어: 'Korean',
  영어: 'English',
  언어: 'Language',
  테마: 'Theme',
  시스템: 'System',
  라이트: 'Light',
  다크: 'Dark',
  '입력한 코드는 바로 반영됩니다. Tab으로 들여쓰기할 수 있습니다. 기존 강조 태그는 유지되며 구문 강조는 자동 갱신되지 않습니다.':
    'Code updates as you type. Use Tab to indent. Existing highlight tags are preserved; syntax highlighting does not update automatically.',
  '셀 오른쪽 경계를 좌우로, 아래쪽 경계를 위아래로 드래그하세요. 병합 셀에서는 오른쪽 끝 열과 시작 행을 조절합니다. 내용보다 작게 줄어들지 않을 수 있습니다.':
    'Drag the right cell edge horizontally or the bottom edge vertically. Merged cells resize the last column and first row. Content may limit the minimum size.',
  '입력한 문구는 바로 반영되며 저장 없이 계속 수정할 수 있습니다. 내부 태그와 아이콘은 유지됩니다.':
    'Text updates as you type and can be edited again without saving. Inner tags and icons are preserved.',
  '값을 입력하고 Enter를 누르거나 다른 항목을 클릭하면 적용됩니다.':
    'Enter a value and press Enter or click another field to apply.',
  '요소를 클릭해 선택하고, 텍스트는 더블 클릭해 수정하세요.':
    'Click an element to select it; double-click text to edit.',
  '저장하지 않은 변경 사항을 버리고 새 파일을 여시겠습니까?':
    'Discard unsaved changes and open a new file?',
  '저장하지 않은 변경 사항을 버리고 닫으시겠습니까?': 'Discard unsaved changes and close?',
  '확인 중 문서가 변경되었습니다. 파일 열기를 다시 시도하세요.':
    'The document changed during confirmation. Try opening the file again.',
  '파일을 열었습니다. 상대 경로의 CSS·이미지는 자동으로 불러오지 못합니다. 외부 URL 또는 내장 리소스를 사용하세요.':
    'File opened. Relative CSS and images cannot load automatically. Use external URLs or embedded resources.',
  '저장을 취소했습니다.': 'Save cancelled.',
  '변경 사항을 적용했습니다.': 'Changes applied.',
  'HTML 파일을 저장했습니다.': 'HTML file saved.',
  'HTML 파일을 덮어썼습니다.': 'HTML file overwritten.',
  'HTML 파일을 다운로드했습니다.': 'HTML file downloaded.',
  '파일 열기 실패: ': 'Failed to open file: ',
  '저장 실패: ': 'Save failed: ',
  '이미지 읽기 실패: ': 'Failed to read image: ',
  '닫기 처리 실패: ': 'Failed to close: ',
  '저장하지 않은 변경 사항': 'Unsaved changes',
  '변경 사항 버리기': 'Discard changes',
  '계속 편집': 'Keep editing',
  '코드 블록을 직접 편집하세요. Tab 들여쓰기 · Ctrl+Enter 적용 · Esc 종료':
    'Edit the code block directly. Tab to indent · Ctrl+Enter to apply · Esc to finish',
  '오른쪽 문구 입력창에서 수정하거나 텍스트가 있는 하위 요소를 더블 클릭하세요.':
    'Edit text in the inspector or double-click a child element containing text.',
  '표 크기는 24 이상의 숫자 또는 px 값으로 입력하세요. 예: 120px':
    'Enter a table dimension of at least 24, as a number or px value, e.g. 120px',
  '올바른 CSS 값을 입력하세요. 예: 24px, 1rem, #345678':
    'Enter a valid CSS value, e.g. 24px, 1rem, #345678',
};
export function translate(language: Language, message: string): string {
  if (language === 'ko') return message;
  if (english[message]) return english[message];
  for (const prefix of [
    '파일 열기 실패: ',
    '저장 실패: ',
    '이미지 읽기 실패: ',
    '닫기 처리 실패: ',
  ]) {
    if (message.startsWith(prefix)) return english[prefix] + message.slice(prefix.length);
  }
  return message;
}
