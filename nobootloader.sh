#!/data/data/com.termux/files/usr/bin/bash
set -e
[ -d comradeconnect-main ] && cd comradeconnect-main
[ -d comradeconnect ] && cd comradeconnect
[ -f frontend/index.html ] || { echo "Run this inside the comradeconnect folder"; exit 1; }

sed -i '/^<div id="ccboot"/d;/getElementById(.ccboot.)/d' frontend/index.html
sed -i 's/html\[data-capp\]{background:#000}/html[data-capp]{background:#fbf1ed}/;s/html\[data-capp\] #ccboot{background:#000;color:#fff}//' frontend/index.html
sed -i 's/#000000/#fbf1ed/g' android-wrapper/capacitor.config.json

git add -A
git commit -m "Remove black boot loader; splash starts with Comrade Connect branding"
git push https://github.com/specialpanda26-sudo/comradeconnect.git HEAD:main
