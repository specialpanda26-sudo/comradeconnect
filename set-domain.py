# Usage: python3 set-domain.py yourdomain.com [google-verification-code]
# Replaces YOUR-DOMAIN.com in frontend/ with your real domain (no https://, no slash), and fills the Search Console code.
import sys,re,glob
if len(sys.argv)<2: sys.exit('Usage: python3 set-domain.py yourdomain.com [google-code]')
d=sys.argv[1].replace('https://','').replace('http://','').strip('/')
code=sys.argv[2] if len(sys.argv)>2 else None
for f in ['frontend/index.html','frontend/robots.txt','frontend/sitemap.xml']:
    s=open(f,encoding='utf-8').read().replace('YOUR-DOMAIN.com',d)
    if f.endswith('index.html'):
        if code: s=s.replace('PASTE_YOUR_SEARCH_CONSOLE_CODE_HERE',code)
        else: s=re.sub(r'<meta name="google-site-verification" content="PASTE_YOUR_SEARCH_CONSOLE_CODE_HERE">','',s)
    open(f,'w',encoding='utf-8').write(s)
print('done for',d)
