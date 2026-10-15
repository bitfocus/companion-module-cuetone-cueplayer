import base64, pathlib
HERE=pathlib.Path(__file__).parent
keys=sorted(p.stem for p in (HERE/'png').glob('*.png'))
lines=['// 자동 생성: assets/icons/build_icons.py → to_ts.py. 손으로 고치지 말 것',
       '// 글리프 = Material Icons Rounded (Apache-2.0), 정지 아이콘 = Cue Remote 앱 그대로',
       'export const Icons = {']
for k in keys:
    lines.append(f"\t{k}: '{base64.b64encode((HERE/'png'/f'{k}.png').read_bytes()).decode()}',")
lines.append('} as const\n')
(HERE.parent.parent/'src'/'icons.ts').write_text('\n'.join(lines))
print(len(keys),'icons')
