import type { HtmlTemplate } from '../application/ports';
import blank from './blank.html?raw';
import manual from './manual.html?raw';
import research from './research.html?raw';
import slides from './slides.html?raw';
import { sample } from '../fixtures/sample';

export const templates: readonly HtmlTemplate[] = [
  {
    id: 'blank',
    label: '빈 HTML',
    description: '본문과 스타일 없이, 최소 HTML 구조부터 시작합니다.',
    name: 'untitled.html',
    html: blank,
  },
  {
    id: 'manual',
    label: '사용자 매뉴얼',
    description: '소개, 목차, 사용 절차, 설정 예시와 FAQ를 제공합니다.',
    name: 'manual.html',
    html: manual,
  },
  {
    id: 'research',
    label: '연구 논문',
    description: '초록, 연구 방법, 결과 표, 논의와 참고문헌을 제공합니다.',
    name: 'research.html',
    html: research,
  },
  {
    id: 'slides',
    label: '발표 슬라이드',
    description: '표지부터 결론까지, 16:9 슬라이드 네 장으로 시작합니다.',
    name: 'slides.html',
    html: slides,
  },
  {
    id: 'practice',
    label: '편집 실습',
    description: '표, 코드, 이미지와 다양한 요소로 편집 기능을 익힙니다.',
    name: 'practice.html',
    html: sample,
  },
];
