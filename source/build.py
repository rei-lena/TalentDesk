import json, pathlib
src = pathlib.Path(__file__).parent / 'src'
shell = (src/'shell.html').read_text()
css = (src/'app.css').read_text()
packet = (src/'packet.html').read_text()
status = (src/'status.html').read_text()
js = "\n".join((src/f).read_text() for f in ['core.js','storage.js','google.js','ui_main.js','ui_views.js','actions.js'])
js = js.replace("'use strict';", "'use strict';\nconst PACKET_TEMPLATE = " + json.dumps(packet).replace('</', '<\\/') + ";\nconst STATUS_TEMPLATE = " + json.dumps(status).replace('</', '<\\/') + ";", 1)
assert '</script' not in js.lower()
out = shell.replace('/*CSS*/', css).replace('/*JS*/', js)
print('built', len(out)//1024, 'KB')
import shutil
dist = pathlib.Path(__file__).resolve().parent.parent  # repo root = the live site
(dist/'index.html').write_text(out)
for f in ['manifest.webmanifest','sw.js','icon-192.png','icon-512.png']: shutil.copy(pathlib.Path(__file__).parent/'assets'/f, dist/f)
(dist/'.nojekyll').write_text('')
print('dist ok')
