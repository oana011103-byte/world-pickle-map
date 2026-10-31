#!/usr/bin/env python3
"""把海岸线 + 整理好的英文条目灌进模板，生成 index.html"""
import json, pathlib
here = pathlib.Path(__file__).parent
tpl = (here / 'template2.html').read_text()
land = (here / 'land-hi.json').read_text()
china = (here / 'china.json').read_text()
prov = (here / 'provinces.json').read_text()
jd = (here / 'jiuduan.json').read_text()
data = json.loads((here / 'entries_en.json').read_text())
variants = json.loads((here.parent / 'assets/photo-variants.json').read_text())
for entry in data['china'] + data['world']:
    entry['photoVariants'] = variants[entry['photo']]['variants']
coords = json.loads((here / 'china_coords.json').read_text())
for e in data['china']:
    c = coords.get(e['id'])
    if c: e['lat'], e['lon'] = c[0], c[1]
payload = json.dumps({'china': data['china'], 'world': data['world']}, ensure_ascii=False, separators=(',', ':'))
out = here.parent / 'index.html'
out.write_text(tpl.replace('__DATA__', payload).replace('__LAND__', land).replace('__CHINA__', china).replace('__PROV__', prov).replace('__JD__', jd))
print('写出', out, out.stat().st_size, 'bytes')
