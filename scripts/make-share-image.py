#!/usr/bin/env python3
"""Draws the link-preview picture (1200x630) from the site logo: frontend/comrade-connect-all-universities.png
(also saved over frontend/og-image.png so the old address shows the new picture). Run by GitHub, needs Pillow and the Poppins font."""
import os, sys, tempfile, urllib.request
from PIL import Image, ImageDraw, ImageFont

OUT = 'frontend/comrade-connect-all-universities.png'
FONTS = [os.environ.get('CC_FONT', ''), '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf', '/usr/share/fonts/truetype/poppins/Poppins-Bold.ttf']
URLS = ['https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf',
        'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf']

def font_file():
    for f in FONTS:
        if f and os.path.exists(f): return f
    d = tempfile.mkdtemp()
    for u in URLS:
        try:
            p = os.path.join(d, 'Poppins-Bold.ttf'); urllib.request.urlretrieve(u, p)
            if os.path.getsize(p) > 50000: return p
        except Exception as e:
            print('font download failed:', u, e)
    return None

ff = font_file()
if not ff: print('WARNING: no Poppins font, picture not changed'); sys.exit(0)
F = lambda s: ImageFont.truetype(ff, s)

W, H = 1200, 630
im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)

# the logo: white mark from frontend/cc-mark.png, about 330 px wide, centred on the left
a = Image.open('frontend/cc-mark.png').convert('RGBA').getchannel('A')
box = a.point(lambda v: 255 if v > 8 else 0).getbbox()
if not box: print('WARNING: no logo found, picture not changed'); sys.exit(0)
m = a.crop(box); mw = 330; mh = int(m.height * mw / m.width)
if mh > 330: mh = 330; mw = int(m.width * mh / m.height)
m = m.resize((mw, mh), Image.LANCZOS)
im.paste(m, (90 + (330 - mw) // 2, (H - mh) // 2), m)

x = 462
for t, size, c, y in [('Comrade Connect', 66, 255, 215), ('Comrades at every university', 34, 195, 300), ('in Kenya', 34, 195, 345),
                      ('Campus feed  |  Safe marketplace  |  Hearts', 27, 150, 408)]:
    d.text((x, y), t, font=F(size), fill=c)

im.save(OUT, optimize=True)
im.save('frontend/og-image.png', optimize=True)
print('share picture ready', os.path.getsize(OUT), 'bytes')
