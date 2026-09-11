"""Deterministically extract generated strips using hatch-pet's shared-scale pipeline."""
import argparse
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('--skill-dir', required=True)
parser.add_argument('--action', required=True)
parser.add_argument('--source', required=True)
args = parser.parse_args()
sys.path.insert(0, str(Path(args.skill_dir) / 'scripts'))
from extract_strip_frames import remove_chroma_background, extract_stable_slot_frames
from despill_chroma_edges import decontaminate_image

root = Path(__file__).resolve().parents[1]
out = root / 'assets' / 'zhubao' / 'extra-actions' / args.action
out.mkdir(parents=True, exist_ok=True)
strip = remove_chroma_background(Image.open(args.source), (255, 0, 255), 96)
frames = extract_stable_slot_frames(strip, 8)
atlas = Image.new('RGBA', (1536, 208))
for i, frame in enumerate(frames):
    atlas.alpha_composite(frame, (i * 192, 0))
atlas, report = decontaminate_image(atlas, chroma_key=(255, 0, 255), strength=1, edge_radius=5, spill_tolerance=.15, minimum_saturation=.1)
frames = [atlas.crop((i*192, 0, (i+1)*192, 208)) for i in range(8)]
records = []
for i, frame in enumerate(frames):
    box = frame.getchannel('A').getbbox()
    assert box and box[0] >= 2 and box[1] >= 2 and box[2] <= 190 and box[3] <= 206, (i, box)
    records.append({'frame': i, 'bbox': box})
atlas.save(root / 'app-assets' / f'{args.action}.webp', lossless=True, exact=True)
atlas.save(out / 'atlas.png')
contact = Image.new('RGBA', (1536, 232), '#eeeae0')
draw = ImageDraw.Draw(contact)
for y in range(24, 232, 12):
    for x in range(0, 1536, 12):
        if (x//12+y//12)%2: draw.rectangle((x,y,x+11,y+11), fill='#c6cdc5')
for i, frame in enumerate(frames):
    contact.alpha_composite(frame, (i*192, 24))
    draw.text((i*192+6, 5), f'{args.action} {i+1}', fill='#223a2c')
contact.save(out / 'contact.png')
frames[0].save(out / 'preview.gif', save_all=True, append_images=frames[1:], duration=240, loop=0, disposal=2)
(out / 'validation.json').write_text(json.dumps({'ok': True, 'source': args.source, 'frames': records, 'despill': report}, indent=2))
print(f'{args.action}: 8 frames validated; {out}')
