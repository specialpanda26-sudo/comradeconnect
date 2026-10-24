from pathlib import Path
from PIL import Image
F = Path('frontend')
m = Image.open(F/'cc-mark.png').convert('RGBA')
m = m.crop(m.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
def tile(px, s):
    c = Image.new('RGBA', (px, px), (0, 0, 0, 255))
    w = int(px*s); h = int(m.height*w/m.width)
    c.alpha_composite(m.resize((w, h), Image.LANCZOS), ((px-w)//2, (px-h)//2))
    return c.convert('RGB')
tile(512, .64).save(F/'icon-512.png')
tile(192, .64).save(F/'icon-192.png')
tile(512, .50).save(F/'icon-maskable-512.png')
tile(180, .62).save(F/'apple-touch-icon.png')
for n in (32, 48, 96): tile(n, .78).save(F/f'favicon-{n}x{n}.png')
tile(96, .78).save(F/'favicon.png')
tile(64, .78).save(F/'favicon.ico', sizes=[(16,16),(32,32),(48,48),(64,64)])
print('icons done')
