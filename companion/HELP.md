## CueTone CuePlayer

큐톤 [큐플레이어](https://cuetone.cc/player)(행사 음악 플레이어)를 스트림덱·Companion 버튼으로 조작해요. 큐플레이어의 원격 조작 HTTP API v1 을 씁니다.

### 준비

1. 큐플레이어 **설정 → 원격 조작 → 원격 조작 받기** 를 켜요.
2. **같은 컴퓨터**에서 Companion 을 돌리면: 받을 곳 "이 컴퓨터 안의 프로그램만" 그대로, 이 모듈 주소는 `127.0.0.1`, 토큰은 비워 둬도 돼요.
3. **다른 컴퓨터**에서 조작하면: 받을 곳을 "같은 네트워크의 다른 기기도"로 바꾸고, 그 컴퓨터의 IP(설정 화면에 나와요)와 **토큰**을 이 모듈 설정에 넣어요. 처음 한 번 macOS 가 묻는 '들어오는 연결 허용'을 허용해야 해요.
4. 포트는 보통 그대로 `53100`.

| 설정           | 기본값    | 뜻                                                                                                                     |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| 주소 (IP)      | 127.0.0.1 | 큐플레이어가 도는 컴퓨터. 이름을 넣어도 되지만 IP 를 권해요                                                            |
| 포트           | 53100     | 큐플레이어 설정의 포트                                                                                                 |
| 토큰           | (비움)    | 같은 네트워크일 때 필수. 토큰은 그대로 보내지 않고 요청마다 서명해서 보내요(큐플레이어 맥 1.1.43 · 윈도우 1.0.49 이상) |
| 상태 확인 간격 | 300 ms    | 상태를 이만큼마다 한 번 물어봐요(요청은 겹치지 않음)                                                                   |

### 동작 (Actions)

곡 재생(처음부터, 목록에서 곡 고르기 · 앱에서 고른 곡 · ID 직접 입력), 재생/일시정지(재생 중이면 일시정지, 아니면 이어서), 일시정지, 이어서 재생, 즉시 정지(그 곡 처음 자리), 처음부터, 페이드 정지(그 곡 처음 자리), 다음 곡, 이전 곡, 위치로 이동(초), 앞뒤로 건너뛰기(±초), 보이스오버(켜기/끄기/바꾸기), 끝나면 정지(켜기/끄기/바꾸기), 한 곡 반복(켜기/끄기/바꾸기 — 10-21 이후 CuePlayer), 효과음 1~10 울리기, 효과음 칸 멈춤, 효과음 전부 멈춤.

곡 목록은 연결될 때, 30초마다, 지금 목록이 바뀔 때 다시 불러와요. 바꾸는 명령에는 매번 새 `requestId` 가 붙어 재시도로 두 번 울리지 않아요.

### 피드백 (Feedbacks)

재생 중 · 일시정지 · 페이드 중 · 멈춤(곡 없음) · 보이스오버 켜짐 · 끝나면 정지 켜짐 · 한 곡 반복 켜짐 · 효과음 N 울리는 중 · 방송 중 · 끝나기 N초 전 · 연결됨 · 연결 끊김 · 출력 장치 문제.
연결이 끊기면 모든 상태 피드백이 꺼지고 '연결 끊김'만 켜져요 — 마지막 초록색이 남지 않아요.

### 변수 (Variables)

| 변수                                       | 뜻                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `state` / `state_label`                    | 상태 (playing · paused · stopped · fading · disconnected / 한글)      |
| `current_title` / `current_playlist`       | 지금 곡 제목 / 그 곡의 목록 이름                                      |
| `remaining` / `remaining_seconds`          | 남은 시간 (m:ss) / 초                                                 |
| `elapsed`                                  | 지난 시간 (m:ss)                                                      |
| `next_title`                               | 다음에 이어질 곡                                                      |
| `previous_title` / `previous_playlist`     | 이전 곡 (⏮ 로 돌아갈 곡) / 그 곡의 목록 이름                          |
| `cued_title`                               | 올려 둔(대기) 곡                                                      |
| `pad_1_name`, `pad_2_name` … `pad_10_name` | 효과음 1~10번 칸 이름 (`pad_` + 칸 번호 + `_name`, 빈 칸은 비어 있음) |

쓸 때는 `$(cueplayer:previous_title)`, `$(cueplayer:pad_3_name)` 처럼 써요. 앞의 `cueplayer` 는 연결 이름에 따라 바뀌어요.

**이전 곡**은 큐플레이어 ⏮ 가 가는 곡이에요: 지금 곡이 든 목록에서 바로 앞 곡(파일을 못 찾는 곡은 건너뜀). 목록의 첫 곡이거나 곡이 없으면 비어 있어요. 곡이 바뀔 때마다 그 목록을 다시 읽어서, 행사 중에 목록 순서를 바꿔도 따라가요. (⏮ 는 곡이 3초 넘게 지났으면 먼저 그 곡 처음으로 가요 — 한 번 더 누르면 이전 곡.)

### 프리셋 — 스트림덱 15키 한 장

|                                |             |                     |           |          |
| ------------------------------ | ----------- | ------------------- | --------- | -------- |
| 재생/일시정지 (상태·남은 시간) | 페이드 정지 | 다음 (다음 곡 제목) | 즉시 정지 | 처음부터 |
| 보이스오버                     | 끝나면 정지 | 효과음 1            | 효과음 2  | 효과음 3 |
| 효과음 4                       | 효과음 5    | 효과음 6            | 효과음 7  | 효과음 8 |

재생 키: 곡 끝에서 다음 곡과 겹치는 동안에도 끝나 가는 곡의 남은 시간을 끝까지 보여 줘요. 재생 중 초록 → 끝나기 30초 전 주황 → 10초 전 빨강, 일시정지 노랑, 페이드 보라, 끊기면 회색. 효과음 키는 칸 이름을 보여 주고 울리는 동안 주황.
효과음 9·10번·효과음 전부 멈춤·이전 곡(이전 곡 제목 표시)·±10초·지금 곡 표시는 "효과음", "더 보기" 묶음에 있어요.

### 안 될 때

- **연결이 거부됐어요**: 큐플레이어가 꺼져 있거나 원격 조작이 꺼져 있어요(행사 중 화면 위 초록 '원격' 아이콘을 누르고 [원격 끄기]를 누르면 꺼져요). 다시 켜면 버튼이 저절로 돌아와요.
- **토큰이 없거나 틀려요**: 큐플레이어 설정의 토큰을 다시 복사해 넣어요(새로 만들면 예전 토큰은 안 돼요).
- **이 컴퓨터에서만 받도록 되어 있어요**: 큐플레이어 받을 곳을 '같은 네트워크'로 바꿔요.
- 믹서 모듈과 한 버튼에 묶을 수는 있지만, 두 기기 사이의 순서·완료는 보장되지 않아요.

---

### English

Controls CueTone **CuePlayer** (event music player) through its HTTP remote API v1.

1. In CuePlayer open **Settings → Remote control** and turn it on.
2. Same computer: keep host `127.0.0.1`, port `53100`, no token needed.
3. Another computer: set CuePlayer to accept the same network, then enter that computer's IP and the **token** shown in CuePlayer. The token itself is never sent over the network — every request is signed with it (HMAC, CuePlayer Mac 1.1.43 / Windows 1.0.49 or newer).

Actions cover go (pick a song from the playlist dropdown), play/pause toggle, pause, resume, stop, restart, fade stop, next, previous, seek, skip ±s, voice-over and stop-after-this-track (on/off/toggle), sound pads 1–10 trigger/stop and stop all. Feedbacks show playing, paused, fading, stopped, voice-over, stop-after-this-track, pad playing, announcing, remaining below N s, connected/disconnected and output problems; when the connection drops every state feedback turns off. A ready 15-key Stream Deck page is included in the presets; the "Previous" key in "More" shows the previous song's title, like "Next" shows the next one.

Variables (use as `$(cueplayer:name)`; `cueplayer` is your connection label):
`state`, `state_label`, `current_title`, `current_playlist`, `remaining` (m:ss), `remaining_seconds`, `elapsed`, `next_title`, `previous_title`, `previous_playlist`, `cued_title`, and one per sound pad: `pad_1_name`, `pad_2_name` … `pad_10_name` (`pad_` + slot number + `_name`, empty for an empty slot).

`previous_title` is the song CuePlayer's ⏮ goes back to: the one before the current song in its playlist (songs with a missing file are skipped). It is empty at the first song or when nothing is loaded. The list is re-read on every song change, so reordering it during the show is picked up. (Like the app, ⏮ first jumps to the start of the current song when it has played for more than 3 s.)
