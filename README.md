# companion-module-cuetone-cueplayer

[Bitfocus Companion](https://bitfocus.io/companion) 에서 큐톤 **큐플레이어**(행사 음악 플레이어)를 조작하는 모듈이에요.
큐플레이어의 원격 조작 HTTP API v1(`http://<주소>:53100/api/v1/…`)으로 재생·일시정지·페이드아웃·다음 곡·효과음 1~10 을 누르고, 상태(재생 중, 남은 시간, 다음 곡, 효과음 칸 이름)를 버튼 색과 글자로 보여 줘요. 스트림덱 15키 한 장 프리셋이 들어 있어요.

사용 설명은 [companion/HELP.md](./companion/HELP.md), 라이선스는 [LICENSE](./LICENSE)(MIT).

- `@companion-module/base` 2.1 → **Companion 5.0 이상**에서 돌아가요.
- 큐플레이어 쪽: 설정 → 원격 조작 → "원격 조작 받기" 켜기 (맥 먼저, 윈도우는 다음 판).

## 개발

```sh
corepack enable      # yarn 4 (package.json 의 packageManager)
yarn install
yarn build           # dist/ 만들기 (tsc)
yarn test            # vitest — 가짜 큐플레이어 서버(test/mock-cueplayer.mjs)로 시험
yarn lint
yarn package         # build + companion-module-build → cuetone-cueplayer-<버전>.tgz
```

큐플레이어 없이 버튼을 눌러 보려면 가짜 서버를 띄워요: `yarn mock` (또는 `node test/mock-cueplayer.mjs --port 53100 --token abc`).

## Companion 에 개발 모듈로 넣기

공식 문서: [Setting up a Dev Folder](https://companion.free/for-developers/module-development/local-modules)

1. 개발 모듈 폴더를 하나 만들어요. 예: `~/companion-dev/`
2. 그 안에 이 저장소를 두고 `yarn install && yarn build` 하거나, `yarn package` 로 만든 `.tgz` 를 풀어 `~/companion-dev/cuetone-cueplayer/` 에 둬요(풀린 폴더는 따로 빌드할 필요 없음).
3. Companion 런처 오른쪽 위 톱니 → **Advanced Settings → Developer** 에서 개발 폴더로 `~/companion-dev`(모듈 폴더의 **부모**)를 고르고 **Enable Developer Modules** 를 켜요.
4. Companion 웹 화면 → Connections → "CueTone: CuePlayer" 추가. 파일이 바뀌면 그 모듈만 다시 켜져요.

## 공개하기 (나중에)

공식 문서: [Releasing your module](https://companion.free/for-developers/module-development/module-lifecycle/releasing-your-module) (2026-10-14 확인)

1. [Bitfocus Developer Portal](https://developer.bitfocus.io) 에 GitHub 으로 로그인해 **저장소를 요청**해요. 이름은 `manufacturer-product` 꼴 → `cuetone-cueplayer` (저장소 `companion-module-cuetone-cueplayer`). 이름 문의는 요청 안에서, 그 밖의 질문은 Slack `#module-development`.
2. 저장소가 생기면 이 코드를 push 해요 (지금은 로컬 커밋만 있고 remote 없음).
3. `package.json` 버전을 올리고(`manifest.json` 버전은 빌드 때 package.json 값으로 덮임) `v0.1.0` 같은 태그를 push 하거나 GitHub release 를 만들어요.
4. 포털 **My Connections → 모듈 → Submit Version** 에서 태그를 골라 제출 → 상태 "Pending".
5. 자원봉사자가 검토하고, 고칠 점은 포털로 와요. 승인되면 바로 Companion 에서 받을 수 있어요.

큐플레이어 앱 배포는 모듈 등록과 묶지 않아요 — 모듈이 없어도 Companion 의 Generic HTTP 모듈로 같은 API 를 쓸 수 있어요.
