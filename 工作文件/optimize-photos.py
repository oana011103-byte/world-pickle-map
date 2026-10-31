#!/usr/bin/env python3
"""Create responsive WebP derivatives; keep source photos and their attribution intact."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
data = json.loads((root / '工作文件/entries_en.json').read_text())
photos = sorted({e['photo'] for e in data['china'] + data['world']})
out = root / 'assets/photos/optimized'
out.mkdir(exist_ok=True)
manifest = {}
for photo in photos:
    source = root / photo
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        variants = []
        # Bound portrait height too: cards never need a 1,280 px tall source.
        max_width = min(image.width, 960, round(image.width * 960 / image.height))
        for width in sorted({min(w, max_width) for w in (480, 960)}):
            height = round(image.height * width / image.width)
            target = out / f'{source.stem}-{digest[:8]}-{width}.webp'
            image.resize((width, height), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=80, method=6)
            variants.append({'src': str(target.relative_to(root)), 'width': width, 'height': height, 'bytes': target.stat().st_size})
        manifest[photo] = {'sourceSha256': digest, 'sourceBytes': source.stat().st_size,
                           'processing': 'EXIF orientation applied; resized without cropping to a maximum 960 px edge; WebP quality 80; source retained.', 'variants': variants}
(root / 'assets/photo-variants.json').write_text(json.dumps(manifest, indent=2) + '\n')
before = sum(p['sourceBytes'] for p in manifest.values())
after = sum(p['variants'][-1]['bytes'] for p in manifest.values())
preview = sum(p['variants'][0]['bytes'] for p in manifest.values())
print(f'{len(photos)} photos: {before:,} → {after:,} bytes ({1-after/before:.1%} smaller); 480px set: {preview:,} bytes')
