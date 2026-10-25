#!/usr/bin/env python3
"""스트림덱 버튼 아이콘(72×72 투명 PNG): 위쪽 가운데 30px 아이콘, 아래는 Companion 글자 자리.
글리프 = Material Icons Rounded(Apache-2.0, 안드로이드 Cue Remote 와 같은 계열), 정지 두 개 = 앱 StopIcons 그대로."""
import pathlib, re, subprocess, tempfile
HERE = pathlib.Path(__file__).parent
SRC = HERE / 'src'; OUT = HERE / 'png'; OUT.mkdir(exist_ok=True)
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
S = 30; X = (72 - S) // 2; Y = 9

def glyph(name, color='#FFFFFF'):
    svg = (SRC / f'{name}.svg').read_text()
    inner = re.sub(r'^<svg[^>]*>|</svg>$', '', svg.strip())
    return f'<svg width="{S}" height="{S}" viewBox="0 0 24 24" fill="{color}">{inner}</svg>'

def fade():
    return (f'<svg width="{S}" height="{S}" viewBox="0 0 30 30"><defs><linearGradient id="g" x1="0" x2="1">'
            '<stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/>'
            '<stop offset="1" stop-color="#fff" stop-opacity=".06"/></linearGradient></defs>'
            '<rect x="3" y="3" width="24" height="24" rx="5.3" fill="url(#g)"/></svg>')

def stop_red():
    return f'<svg width="{S}" height="{S}" viewBox="0 0 30 30"><rect x="3" y="3" width="24" height="24" rx="5.3" fill="#E5484D"/></svg>'

def badge(n):
    fs = 15 if n < 10 else 13
    return (f'<svg width="{S}" height="{S}" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="#FFFFFF" fill-opacity=".16"/>'
            f'<text x="15" y="15" dy=".36em" text-anchor="middle" font-family="-apple-system,Helvetica" font-weight="800" font-size="{fs}" fill="#fff">{n}</text></svg>')

ICONS = {
    'play': glyph('play_arrow'), 'pause': glyph('pause'), 'next': glyph('skip_next'), 'previous': glyph('skip_previous'),
    'restart': glyph('replay'), 'voiceover': glyph('record_voice_over'), 'stop_after': glyph('stop_circle'), 'repeat_one': glyph('repeat_one'),
    'announce': glyph('campaign'), 'back10': glyph('replay_10'), 'fwd10': glyph('forward_10'), 'pads_stop': glyph('music_off'),
    'now': glyph('music_note'), 'warning': glyph('warning'), 'link': glyph('laptop_mac'), 'go': glyph('play_circle'),
    'page_prev': glyph('chevron_left'), 'page_next': glyph('chevron_right'), 'page': glyph('layers'),
    'fade': fade(), 'stop': stop_red(), **{f'pad{n}': badge(n) for n in range(1, 11)},
}

with tempfile.TemporaryDirectory() as tmp:
    for key, svg in ICONS.items():
        html = pathlib.Path(tmp) / f'{key}.html'
        html.write_text(f'<html><body style="margin:0;background:transparent"><div style="position:absolute;left:{X}px;top:{Y}px;width:{S}px;height:{S}px">{svg}</div></body></html>')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                        '--force-device-scale-factor=1', '--window-size=72,72', f'--screenshot={OUT / (key + ".png")}', html.as_uri()],
                       check=True, capture_output=True)
print(len(ICONS), 'icons →', OUT)
