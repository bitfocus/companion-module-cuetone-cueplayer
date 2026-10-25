# Bitfocus 저장소 요청서 (2026-10-14, Astra 검토)

## 1. 신청 최종본 — 영어

**Module type**  
Software / application control

**Repository name**  
companion-module-cuetone-cueplayer

**Module id**  
cuetone-cueplayer

**Manufacturer**  
CueTone (operated by SI, South Korea)

**Product(s)**  
CuePlayer for macOS and Windows

**Short description**  
Control CuePlayer playback, background audio mode, and sound-effect pads over its HTTP API.

**Longer description or notes to reviewers**

> We are CueTone, the developer of CuePlayer and this module. CuePlayer is a free music playback application for live events on macOS and Windows.
>
> The module uses CuePlayer’s HTTP API v1, planned for the next CuePlayer releases: macOS 1.1.21 and Windows 1.0.24. These API-enabled releases are not yet available. API documentation is provided in the module’s HELP.md and our website manual.
>
> The API is disabled by default and can be enabled in CuePlayer settings on port 53100. It supports localhost-only access or local-network access with a Bearer token. No dedicated hardware is required. CuePlayer downloads: https://cuetone.cc/ko/player
>
> The module provides 16 actions, 12 feedbacks, playback and pad variables, and presets for a 15-key Stream Deck. It polls status every 300 ms without overlapping requests.
>
> It is written in TypeScript using companion-module-template-ts and is MIT-licensed. It passes companion-module-check and 37 tests against a mock server. It uses @companion-module/base ~2.1 and requires Companion 5.0 or later.
>
> CueTone will maintain the module. Contact: hello@cuetone.cc. GitHub: lazalus.

## 검토 메모 (Astra)

- **이름 규칙:** `cuetone-cueplayer`는 소문자 `manufacturer-product` 형태로 자연스럽습니다. 전체 저장소명은 `companion-module-cuetone-cueplayer`입니다. 다만 포털이 접두사를 자동으로 붙이는 입력란이라면 `cuetone-cueplayer`만 입력하세요. 기존 이름 충돌 여부는 별도 확인이 필요합니다.
- **Module type:** 위의 `Software / application control`은 설명용입니다. 포털의 실제 선택지 명칭을 확인하지 못했으므로, 드롭다운에서는 해당하는 항목을 선택해야 합니다.
- **제조사 직접 개발 여부:** “We are CueTone, the developer…”로 명확하게 밝혔습니다. 제품 브랜드는 CueTone, 운영사는 SI로 구분하면 됩니다.
- **API 공개·출시 여부:** **현재 가장 큰 검토 장애물은 API 지원 앱이 아직 출시되지 않았다는 점**입니다. 무료 다운로드가 있어도 현행 버전으로 검증할 수는 없습니다. 가능하면 지원 버전 출시 후 신청하거나, 리뷰어가 사용할 테스트 빌드와 접근 방법을 제공하세요. 사이트 설명서도 정확한 공개 URL을 추가하면 좋습니다. 문서 공개와 API 구현의 오픈소스 여부는 별개이므로 “open-source API”라고 쓰지 마세요.
- **검증 범위:** `37 tests against a mock server`는 정확한 표현입니다. 이를 실제 앱 연동 검증으로 표현하면 안 됩니다. 실앱 시험을 마치면 OS·앱 버전과 함께 결과를 덧붙이세요.
- **상표·라이선스:** 모듈의 MIT 라이선스와 CuePlayer의 무료 배포를 구분했습니다. 무료 앱이라고 오픈소스인 것은 아닙니다. 저장소의 LICENSE·의존성 라이선스를 확인하고, 로고 등을 포함한다면 사용 권한도 확인하세요.
- **유지보수:** 회사의 유지보수 의사, 이메일, GitHub 담당자가 있어 충분히 명확합니다. 응답 시간이나 영구 지원 같은 불필요한 보장은 넣지 않는 편이 좋습니다.

## 3. Companion 버전 지원 판단

**2026년 10월의 실제 Companion 버전별 사용자 비중은 알 수 없습니다.** 또한 여기서는 해당 시점의 포털 제출 정책과 `@companion-module/base ~2.1` 호환성 표를 실시간 확인하지 않았습니다. 아래 판단은 주신 “Companion 5.0 이상 필요” 조건을 전제로 합니다.

**권고는 우선 5.0 이상 지원으로 제출하되, 최소 버전을 명확하게 표시하는 것입니다.** 신규 모듈이고 앱 자체도 새 API 지원 버전으로 업데이트해야 하므로, 확인되지 않은 구버전 수요만으로 호환 코드를 늘릴 필요는 없습니다.

다만 앱 업데이트와 Companion 업데이트는 부담이 다릅니다. 운영 중인 Companion 시스템은 다른 모듈 때문에 업그레이드를 미루기도 하므로, 주요 고객에게 현재 사용하는 Companion 버전을 확인할 가치는 있습니다.

- **그대로 진행:** 대상 사용자가 5.0 이상을 사용하거나 업데이트 가능하고, 당시 포털의 허용 기준에 맞는 경우.
- **하위 버전 지원 검토:** 실제 고객이 구버전에 묶여 있고, 이전 base로도 필요한 기능을 구현할 수 있으며 실환경 회귀 시험을 할 수 있는 경우.
- **피해야 할 것:** 의존성이나 최소 버전 숫자만 낮춰 호환성을 주장하는 것. 하위 버전 지원은 코드·빌드·런타임 검증이 필요합니다.

현재로서는 **base 하향보다 API 지원 앱의 공개와 실앱 연동 검증을 먼저 완료하는 것이 리뷰어의 승인 판단에 더 직접적으로 도움이 됩니다.**

## 제출 기록

- 2026-10-14 큐플레이어 맥 1.1.21 · 윈도우 1.0.24 배포 뒤 제출 → https://developer.bitfocus.io/create-repository/17 (Pending). GitHub lazalus 로 로그인, 포털 이용약관 동의.
- 승인되면 GitHub 초대 수락 → 이 저장소 push → `v0.1.0` 태그 → 포털 Submit Version.
- 2026-10-26 저장소 요청 승인 → 진행:
  - 초대 수락(bitfocus-developer-portal 봇, 초대 339612386) → https://github.com/bitfocus/companion-module-cuetone-cueplayer (공개, 포털 템플릿 첫 커밋 61da67f 하나).
  - 템플릿 커밋을 `git merge -s ours`로 이력에만 합치고(내용은 이 모듈 그대로, 강제 push 없음) main push. 이후 이 저장소는 origin(lazalus)과 bitfocus 두 곳에 같이 push.
  - v0.1.4 태그는 Bitfocus CI(`yarn install --immutable`)가 yarn.lock 불일치로 실패. 태그는 저장소 규칙상 지울 수 없음 → yarn.lock 맞춰 0.1.5.
  - 포털은 0.x 태그를 미리보기판(prerelease)으로만 받아서(체크 해제 불가) 기능 그대로 **1.0.0** 으로 올림. v1.0.0 CI(Companion Module Checks · Node CI) 통과.
  - 포털 Submit Version: **v1.0.0, 정식판, 검토 대기(Pending)**. 검토자 메시지에 0.1.4/0.1.5 는 제출 전 빌드라고 적음.
  - 검토 통과하면 Companion 모듈 목록에 '정식'으로 뜸. 다음 판(효과음 판 넘기기 액션 등)은 태그 → 포털 Submit Version 을 다시.
- 2026-10-26 **1.1.0 (사용자 '배포하고 심사 올리자')**: bitfocus 저장소에 Dependabot(undici 8.12.3, #2) 커밋이 먼저 들어와 있어서 강제 push 없이 합침(c6e2221) → bitfocus · origin 에 main · v1.1.0 태그 push, Bitfocus CI(Companion Module Checks · Node CI) main · v1.1.0 모두 통과. 포털: 1.0.0 이 검토 대기여도 'Submit Version' 이 열리고 Git Tag 에 v1.1.0 이 미리 골라져 있음(미리보기판 체크 없음) → 처음엔 자동 권한 검사가 막았고, 사용자 허락('컴패니언 권한 허락해줄게 제출 진행해주고') 뒤 **v1.1.0 정식판(미리보기판 아님) 제출 · 포털 표시 Pending** (v1.0.0 도 Pending 그대로, 둘 다 검토 대기). 검토자 메시지: "1.1.0 adds pad page actions (next / previous / go to page), page variables, two feedbacks and page presets for CuePlayer Mac 1.1.53+ / Windows 1.0.63+. Older CuePlayer keeps working; the page actions just log an update hint. Otherwise identical to 1.0.0 (still pending review), plus the Dependabot undici bump."
- (이전) 1.1.0 준비 내용: 효과음 판(큐플레이어 맥 1.1.53 · 윈도우 1.0.63~) — 동작 효과음 다음 판 · 앞 판 · 판 고르기(1부터), 변수 pad_page_index · pad_page_count · pad_page_name · pad_elsewhere_name, 피드백 '효과음 판이 N번째' · '다른 판 효과음 나오는 중', 프리셋 '효과음' 묶음에 앞 판 · 판 이름(누르면 다음 판) · 다음 판 줄, 옛 큐플레이어면 변수 비고 404 에 업데이트 안내. 1.0.0 검토가 끝나면 bitfocus push → v1.1.0 태그 → 포털 Submit Version.
- 남은 일: 실물 Companion 으로 한 번 시험. (효과음 10칸은 이미 들어가 있음)
