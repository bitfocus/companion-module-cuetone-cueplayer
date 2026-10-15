from PIL import Image, ImageDraw, ImageFont
F='/System/Library/Fonts/AppleSDGothicNeo.ttc'
K=72*3; G=24; PAD=40
BASE=(28,28,31); PURPLE=(103,71,238); GREEN=(31,157,85); ORANGE=(232,89,12)
keys=[('pause','1:23',GREEN),('fade','페이드',None),('next','축가 반주',None),('stop','즉시 정지',None),('restart','처음부터',None),
      ('voiceover','보이스오버',PURPLE),('stop_after','끝나면 정지',None),('pad1','팡파레',None),('pad2','웅장한 팡파레',ORANGE),('pad3','드럼롤',None),
      ('pad4','수상자 호명',None),('pad5','정답',None),('pad6','오답',None),('pad7','시간 종료',None),('pad8','깜짝 공개',None)]
W=PAD*2+5*K+4*G; H=PAD*2+3*K+2*G+70
im=Image.new('RGB',(W,H),(12,12,14)); d=ImageDraw.Draw(im)
d.text((PAD,18),'CuePlayer · Stream Deck 15키 프리셋 (재생 중 · 보이스오버 켜짐 · 효과음 2번 울리는 중)',font=ImageFont.truetype(F,26,index=6),fill=(220,220,226))
for i,(ic,txt,bg) in enumerate(keys):
    r,c=divmod(i,5); x=PAD+c*(K+G); y=PAD+50+r*(K+G)
    key=Image.new('RGB',(72,72),bg or BASE)
    icon=Image.open(f'png/{ic}.png').convert('RGBA'); key.paste(icon,(0,0),icon)
    kd=ImageDraw.Draw(key); f=ImageFont.truetype(F,13 if len(txt)>4 else 14,index=6)
    w=kd.textlength(txt,font=f)
    if w>68: f=ImageFont.truetype(F,11,index=6); w=kd.textlength(txt,font=f)
    kd.text(((72-w)/2,48),txt,font=f,fill=(255,255,255))
    key=key.resize((K,K),Image.LANCZOS)
    m=Image.new('L',(K,K),0); ImageDraw.Draw(m).rounded_rectangle((0,0,K-1,K-1),radius=22,fill=255)
    im.paste(key,(x,y),m)
im.save('preview-15key.png')
