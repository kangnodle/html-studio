# HTML Studio

Vite+(`vp`), TypeScript, SolidJS와 Tauri 2로 만든 정적 HTML 화면 편집기입니다. Tauri 코어/API/CLI는 최신 안정 버전 2.12.0, 대화상자 플러그인은 2.8.0을 사용합니다. Rust와 JavaScript 의존성은 `src-tauri/Cargo.lock`과 `bun.lock`으로 고정합니다.

## 라이선스

HTML Studio는 모든 권리를 보유하는 독점 소프트웨어입니다. 이용 조건과 라이선스 문의처는 저장소 루트의 [LICENSE](LICENSE)를 참조하세요. 제3자 구성 요소에는 각각의 라이선스가 적용됩니다.

## 데스크톱 개발

```powershell
vp install
vp run dev:desktop
```

Rust stable(`rustup`), Microsoft C++ Build Tools의 Desktop development with C++ 구성 요소 및 Windows SDK, Edge WebView2 Runtime이 필요합니다. ARM64 교차 빌드에는 ARM64용 MSVC 도구도 필요합니다. Electron은 사용하지 않으며 프런트엔드 개발·검증·빌드·테스트는 단일 툴체인인 Vite+(`vp`)로 관리합니다. 자세한 요구 사항은 [Tauri Windows 준비](https://v2.tauri.app/start/prerequisites/)를 참고하세요.

데스크톱 앱은 Windows 열기·저장 대화상자를 사용하며 저장 취소·실패 시 미저장 표시를 유지합니다. 상단의 ‘HTML 덮어쓰기’는 ‘HTML 저장’ 왼쪽에 있으며, ‘파일 열기’로 연 원본 파일에 현재 내용을 저장합니다. ‘HTML 저장’은 기존처럼 저장 대화상자를 엽니다. 미저장 문서를 닫을 때 확인합니다. 네이티브 권한은 메인 창으로 제한하며, 덮어쓰기는 Rust에서 보관한 원본 파일 식별자만 받으므로 프런트엔드에 임의 경로 쓰기 API를 노출하지 않습니다.

## Windows 11 설치 파일 만들기

Windows에서 Vite+(`vp`), Cargo, rustup이 PATH에 등록되어 있어야 합니다. C++ Build Tools와 Windows SDK는 미리 설치해야 합니다. Rust 의존성과 NSIS 빌드 도구를 처음 다운로드할 때 네트워크 연결이 필요합니다. 첫 Rust 빌드는 시간이 걸릴 수 있습니다.

```powershell
.\scripts\release.ps1
# Windows on ARM용
.\scripts\release.ps1 -Architecture arm64
# 두 아키텍처 모두 생성
.\scripts\release.ps1 -Architecture all
```

의존성 설치 → 웹/Rust 포맷팅 → 린트·타입 검사와 웹 빌드 → JS/Rust 테스트 → Tauri/Rust 빌드 → NSIS 설치 파일 생성 순서로 실행합니다. 필요한 Rust target도 설치합니다. 실패하면 중단하며 설치하거나 앱을 실행하지 않습니다. 포맷팅은 소스 파일을 수정합니다.

설치 파일은 `release/x64/HTML-Studio-0.3.0-x64-Setup.exe` 또는 `release/arm64/HTML-Studio-0.3.0-arm64-Setup.exe`에 생성됩니다. 버전은 `package.json`의 `version`을 따릅니다. 각 폴더에 SHA256 파일과 `release-manifest.json`도 생성합니다. 이전 버전의 생성물은 유지되므로 현재 버전과 manifest를 확인하세요. 사용자의 계정에 설치하며 제거 프로그램을 포함합니다. 설치된 앱에는 Bun, Node.js, Rust, 별도 개발 서버가 필요하지 않습니다.

Windows WebView2 Runtime을 사용하며, 없으면 설치 프로그램이 Microsoft에서 다운로드합니다. 네트워크 없는 환경을 위한 런타임 포함은 별도 설정입니다.

현재 인증서가 없어 코드 서명을 하지 않습니다. Windows에서 알 수 없는 게시자로 표시되거나 SmartScreen 경고가 나타날 수 있습니다. 공식 배포를 위한 코드 서명은 별도 구성해야 합니다. [Tauri Windows 설치 파일 문서](https://v2.tauri.app/distribute/windows-installer/)를 참고하세요.

Vite+(`vp`), TypeScript, SolidJS로 만든 정적 HTML 화면 편집기입니다.

```powershell
vp install
vp dev
```

브라우저에서 http://127.0.0.1:5173 을 엽니다. `vp check`로 포맷·린트·타입 검사를, `vp build`로 배포 빌드를 실행합니다.

파일 시스템 접근 API를 지원하는 브라우저에서는 ‘파일 열기’로 선택한 파일을 덮어쓸 수 있으며, 최초 저장 시 브라우저가 쓰기 권한을 요청할 수 있습니다. 지원하지 않는 브라우저나 일반 파일 업로드·드롭으로 연 문서는 원본 쓰기 권한이 없으므로 덮어쓰기 버튼이 비활성화됩니다. ‘HTML 저장’으로는 계속 다운로드할 수 있습니다.

## 템플릿으로 시작하기

첫 화면과 상단 ‘새 문서’에서 실제 HTML 미리보기를 보고 기본 템플릿을 선택합니다. 언어·테마와 문서 정보는 첫 줄, 새 문서·파일 열기와 덮어쓰기·저장은 두 번째 줄, 실행 취소·문구 추가·화면 너비·미리보기는 편집 도구 모음에 배치합니다.

- **빈 HTML**: 문자 인코딩, viewport, 제목만 포함하며 본문과 스타일은 비어 있습니다. ‘문구 추가’로 첫 문단을 넣고 더블 클릭해 편집합니다.
- **사용자 매뉴얼**: 소개, 목차, 준비 항목 표, 사용 절차, 설정 코드와 FAQ를 제공합니다.
- **연구 논문**: 초록, 서론, 연구 방법, 결과 표·그림 영역, 논의, 결론과 참고문헌을 제공합니다. A4 너비 미리보기와 인쇄 스타일이 포함되며, 제출 기관의 지정 서식은 별도로 맞춰야 합니다.
- **발표 슬라이드**: 표지, 배경, 핵심 내용, 결론의 16:9 페이지 네 장을 제공합니다. 모바일에서는 세로로 읽기 쉽게 표시하며, 저장한 HTML을 브라우저에서 인쇄하면 슬라이드별로 페이지를 나눕니다.
- **편집 실습**: 기존 표·코드·이미지·칩·레이블 예제를 선택해 사용할 수 있습니다.

매뉴얼·논문·슬라이드는 외부 리소스나 실행 스크립트 없이 본문과 CSS를 포함합니다. 템플릿 본문은 한국어이며, 편집기 메뉴와 설명은 언어 설정을 따릅니다. 새 문서는 저장 전 상태로 시작하고 이전 원본의 덮어쓰기 연결을 해제합니다. 기존 변경 사항을 버릴지는 전환 전에 확인하며, 취소하면 현재 문서를 유지합니다. 템플릿 HTML과 목록은 `src/templates/`에서 관리합니다.

## 전체 실행

아래 스크립트는 프로젝트 경로로 이동한 뒤 의존성 설치 → TypeScript·Rust 코드 포맷팅 → TypeScript·Rust 린팅 및 타입 검사 → TypeScript·Rust 빌드 → TypeScript·Rust 테스트 → Tauri 데스크톱 앱 실행을 순서대로 처리합니다. 어느 단계든 실패하면 다음 단계를 실행하지 않습니다. 앱은 창을 닫거나 Ctrl+C로 종료합니다. 포맷팅은 소스 파일을 실제로 수정합니다.

```powershell
.\scripts\run.ps1
# 앱을 시작하지 않고 검증·빌드·테스트만 실행
.\scripts\run.ps1 -CheckOnly
```

```bash
bash scripts/run.sh
# 앱을 시작하지 않고 검증·빌드·테스트만 실행
bash scripts/run.sh --check-only
```

Vite+(`vp`), Cargo, rustc가 PATH에 등록되어 있어야 하며 첫 의존성 설치에는 네트워크가 필요합니다. 스크립트는 다른 작업 디렉터리에서도 절대 경로로 호출할 수 있습니다. Vite는 Tauri 연결을 위해 5173 포트를 고정 사용하므로 이미 사용 중이면 기존 서버를 종료하세요.

개별 명령: `vp fmt .`, `vp check`, `vp build`, `vp test`, `vp dev`. 테스트는 HTML 가져오기·수정·내보내기 과정에서 콘텐츠와 리소스가 유지되고 편집용 보안 정책이 제거되는지 확인합니다.

데스크톱 명령은 `vp run dev:desktop`, `vp run build:desktop`, `vp run format:rust`, `vp run test:rust`입니다. Rust 포맷 검사는 `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`로 실행합니다. JS 테스트는 네이티브 저장·취소·오류 처리도 검증하고, Rust 테스트는 파일 이름 정규화와 실제 UTF-8 파일 저장·오류를 검증합니다.

HTML 업로드/드롭, 요소 선택, 더블 클릭 텍스트 편집, 스타일 수정, 링크 수정, 이미지 URL 또는 파일 교체, 실행 취소/다시 실행, 화면 너비 미리보기, HTML 다운로드를 지원합니다. 이미지 파일은 data URL로 HTML에 포함됩니다. 편집용 속성과 보안 정책은 내보낼 때 제거됩니다.

코드 블록(`pre`, `pre > code`, `code`)은 화면에서 더블 클릭해 직접 편집할 수 있습니다. Enter는 줄바꿈, Tab은 공백 두 칸을 삽입합니다. Ctrl+Enter, Esc 또는 다른 영역 클릭으로 편집을 마칩니다. 오른쪽 코드 입력창도 사용할 수 있습니다. 줄바꿈·들여쓰기·HTML 태그 문자열과 기존 강조 태그를 보존하며, 구문 강조는 자동 갱신되지 않습니다.

표의 셀을 클릭하면 오른쪽 경계에서 열 너비를, 아래쪽 경계에서 행 높이를 드래그해 조절할 수 있습니다. 오른쪽 ‘표 크기’ 패널에서도 숫자 또는 px 값(최소 24)을 입력할 수 있습니다. 열 너비는 같은 열 전체에 적용되고 다른 열의 너비는 유지되며, 표가 넓어지면 가로 스크롤로 확인할 수 있습니다. 병합 셀은 오른쪽 끝 열과 시작 행을 조절합니다. 내용·여백 때문에 최소 높이는 입력한 값보다 클 수 있습니다. 변경은 저장 HTML과 실행 취소·다시 실행에 반영되며, 조절 핸들은 내보내지 않습니다.

## 코드 구조와 의존성

기존 코드에는 이미 Core/Application/Adapters/UI 계층이 있었지만, 편집 컨트롤러의 문서 상태 계산과 외부 작업 실행, iframe 어댑터의 요소 생성 규칙과 DOM 변경이 같은 함수 안에 섞여 있었습니다. 이번 구조는 **순수 상태 계산 → Application의 작업 순서 → Adapter의 외부 실행**으로 책임을 분리합니다. 기존 작업 중이던 기능과 공개 컨트롤러 API는 유지합니다.

- `core/editor-document.ts`: 문서 이름·템플릿·draft·편집 이력·revision·identity를 하나의 불변 상태로 다룹니다. 문서 교체, draft 확정, 실행 취소, 저장 완료 반영, 화면 상태 및 복구 스냅샷 계산과 복구 데이터 검증을 담당합니다. HTML 정규화는 Core에 들어오기 전에 수행합니다.
- `core/element-insertion.ts`: 허용된 태그, main의 중복 제한, 표·목록·코드블록의 초기 구조를 데이터로 결정합니다. `adapters/dom/element-insertion.ts`가 그 데이터를 노드·속성·스타일로 적용하고, 사용자 문구는 `textContent`로 설정합니다.
- `application/editor-controller.ts`: 순수 상태 함수를 호출하며 파일 읽기·쓰기, 확인 대화상자, 화면 갱신, 복구 저장과 구독 알림을 조정합니다. 파일 핸들, 작업 잠금, 최신 열기 요청 토큰과 해제 여부는 외부 작업의 수명에 속하므로 이 계층에 남습니다.
- `adapters/browser/recovery-storage.ts`: JSON과 localStorage 접근 및 오류 처리를 담당하고, 복구 데이터의 형식 검증은 Core에 위임합니다. 복구 계약은 Core의 `DocumentSnapshot`을 사용합니다.
- `src-tauri/src/filename.rs`: 파일명 정리의 순수 규칙입니다. `filesystem.rs`는 실제 파일 읽기·쓰기와 열린 경로 관리를, `commands.rs`는 네이티브 대화상자와 비동기 명령을 담당합니다. `main.rs`는 모듈과 명령을 조립합니다.

문서 규칙이 바뀌면 Core, 플랫폼이 바뀌면 Adapter, 화면이 바뀌면 UI를 수정합니다. 외부 작업은 기존 Port를 주입해 교체하며 별도 DI 프레임워크나 범용 Repository 계층은 추가하지 않습니다.

언어·테마 설정도 같은 의존성 방향을 따릅니다. `core/preferences.ts`는 저장 값의 기본값과 시스템 테마 해석을 순수하게 처리합니다. `application/preferences-controller.ts`가 설정 변경·저장·시스템 테마 구독의 순서를 관리하며, 실제 localStorage와 document 변경은 `adapters/browser/preferences-storage.ts`와 `appearance.ts`가 맡습니다. UI는 주입된 컨트롤러를 Solid Context로 구독하고 입력을 전달합니다.

`ui/translations.ts`의 번역은 언어와 문구를 인자로 받는 순수 함수입니다. 모듈을 가져오는 것만으로 저장소를 읽거나 전역 언어 상태를 만들지 않습니다. Tauri 대화상자는 bootstrap에서 번역 함수를 주입받으므로 UI나 Solid를 가져오지 않으며, 호출할 때 현재 언어를 사용합니다. 설정 컨트롤러는 명시적인 `start()`에서만 화면 적용과 시스템 테마 구독을 시작하고, `dispose()`에서 구독을 해제합니다.

- `src/core/`: HTML 스냅샷 기반 편집 기록, 실행 취소·다시 실행, 저장 기준점, 텍스트 편집 규칙, 텍스트 변경의 구간 분배, 병합 셀의 논리 열 계산과 크기 검증을 순수 함수로 처리합니다. DOM, Solid, Tauri에 의존하지 않습니다.
- `src/application/`: 편집 컨트롤러와 외부 기능의 계약을 정의합니다. 파일 열기·저장·이미지 교체·닫기 확인의 순서를 관리하며 UI와 어댑터 구현을 직접 가져오지 않습니다.
- `src/adapters/dom/`: HTML 파싱·직렬화·미리보기 정책, iframe 요소 선택·수정·측정과 이벤트 수명을 관리합니다. `iframe-editor`는 편집 세션을 조정하고 `element-inspection`, `code-editor`, `table-resize-controls`가 각각 요소 검사, 코드 입력창, 표 드래그를 담당합니다. DOM에서 읽은 텍스트·셀 정보를 Core에 전달하고 반환된 결과를 DOM에 적용합니다.
- `src/adapters/browser/`, `src/adapters/tauri/`: 다운로드 또는 네이티브 저장, 확인 대화상자, 창 닫기 이벤트를 구현합니다.
- `src/ui/`: Solid 화면과 입력 처리를 담당합니다. App, Toolbar, Inspector, EditorCanvas로 나뉘며 어댑터 구현을 직접 가져오지 않습니다.
- `src/bootstrap.tsx`: 플랫폼을 선택하고 컨트롤러·어댑터·UI를 조립합니다. 샘플 HTML은 `src/fixtures/`에 있습니다.

의존성은 UI → Application → Core 방향이며, 어댑터가 Application의 계약을 구현합니다. 저장(`HtmlStorage`), 버리기 확인(`DiscardDialog`), 창 생명주기(`WindowLifecycle`)는 별도 계약입니다. 컨트롤러에는 저장과 확인 기능만, UI에는 창 생명주기만 주입합니다. 실제 iframe DOM은 DOM 어댑터가 소유하고, Core에는 HTML 문자열·텍스트 구간·셀의 숫자 정보만 전달합니다. 텍스트 입력 중에는 draft로 미저장 여부를 갱신하고, 편집을 마칠 때 기록에 확정합니다. 미리보기 왕복은 원래 doctype을 보존하므로 파일을 열기만 해도 수정됨으로 표시되는 일을 방지합니다.

연속 입력과 표 드래그의 스냅샷·복구 저장, 스크롤·리사이즈의 위치 측정은 프레임당 한 번으로 합칩니다. 문구는 즉시 반영하고 표 드래그는 최신 위치를 프레임마다 적용합니다. 저장·실행 취소·문서 전환·앱 해제 전에는 대기 중인 변경을 즉시 확정합니다. 복구 내용이 같으면 상태 메시지만 바뀌어도 저장소를 다시 읽거나 쓰지 않습니다. 표 드래그는 시작 시 계산한 열 매핑과 너비를 재사용하고 종료 시 기록을 확정합니다. 미저장 표시와 복구 저장은 다음 프레임까지 지연될 수 있습니다.

비동기 저장은 시작 시 캡처한 HTML과 문서 식별자를 사용합니다. 저장 중 추가 편집은 미저장 상태를 유지하고, 문서가 교체된 뒤 완료된 이전 저장은 새 문서의 저장 기준점에 적용하지 않습니다. 가장 최근 파일 열기 요청만 유효하며, 버리기 확인 중 추가 편집이 생기면 파일 교체를 중단합니다. iframe 교체·앱 해제 시 예약된 프레임, 이벤트 리스너와 ResizeObserver를 해제합니다.

네이티브 저장은 같은 폴더의 임시 파일에 전체 내용을 기록하고 동기화한 뒤 원본을 교체합니다. 내보내는 HTML의 문자 인코딩 선언은 UTF-8로 통일합니다. 이미지 주소나 파일을 교체하면 해당 이미지의 기존 반응형 소스도 제거합니다. 실행 취소 기록은 HTML 문자열의 UTF-16 크기 기준 32 MiB를 넘으면 오래된 상태부터 제거하며, 현재 문서와 마지막 저장 상태는 크기와 관계없이 유지합니다.

`vp test`는 순수 상태 전이, 비동기 작업 경쟁·취소·오류, DOM 편집 세션과 이벤트 해제, HTML 변환, 네이티브 저장 계약을 검증합니다. 아키텍처 테스트는 하위 디렉터리까지 재귀적으로 검사하고 어휘 분석으로 일반 import, 부수효과 import, re-export, 동적 import와 import 타입을 확인합니다. Core는 Core만, Application은 Core/Application만 의존할 수 있으며 UI와 Adapter의 상호 참조 및 bootstrap 역참조를 차단합니다. 내부 계층의 외부 패키지 참조, Core의 브라우저 API·시간·난수 접근과 소스 모듈의 순환 참조도 검사합니다.

`vp check`는 Oxfmt 포맷 검사, Oxlint 타입 인지 린팅, 전체 타입 검사를 단일 패스로 통합 수행합니다. 해제된 컨트롤러의 호출은 외부 작업을 실행하지 않으며, 반복 해제도 안전합니다.

정적 HTML이 지원 범위입니다. 편집 화면에서 원본 스크립트, 폼 제출과 링크 이동은 제한됩니다. 다운로드한 HTML에는 원본 스크립트가 유지되므로 신뢰할 수 있는 파일만 브라우저에서 실행하세요. 미리보기는 편집 표시를 숨기는 모드이며 스크립트를 실행하지 않습니다. 외부 CSS/이미지/글꼴 URL은 네트워크 접근이 필요합니다. 상대 경로 로컬 파일과 ZIP 프로젝트는 아직 지원하지 않습니다. 저장 시 브라우저가 정규화한 HTML을 출력하므로 원본 들여쓰기와 소스 표현은 달라질 수 있습니다.
