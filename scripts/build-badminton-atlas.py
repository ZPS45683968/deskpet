#!/usr/bin/env python3
"""Compose and validate the generated eight-frame badminton action."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


CELL = (192, 208)
FRAME_COUNT = 8


def checkerboard(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size, (245, 245, 240, 255))
    draw = ImageDraw.Draw(image)
    tile = 12
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(222, 225, 218, 255))
    return image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames-dir", required=True)
    parser.add_argument("--qa-source", help="Optional cleaned 1536x208 atlas used for previews and contact sheet.")
    parser.add_argument("--png-out", required=True)
    parser.add_argument("--atlas-out", required=True)
    parser.add_argument("--preview-out", required=True)
    parser.add_argument("--contact-out", required=True)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir)
    frames = []
    records = []
    errors = []
    for index in range(FRAME_COUNT):
        frame_path = frames_dir / f"{index:02d}.png"
        if not frame_path.is_file():
            errors.append(f"missing frame {index}")
            continue
        frame = Image.open(frame_path).convert("RGBA")
        if frame.size != CELL:
            errors.append(f"frame {index} is {frame.size}, expected {CELL}")
            continue
        alpha = frame.getchannel("A")
        bbox = alpha.getbbox()
        if not bbox:
            errors.append(f"frame {index} is empty")
            continue
        edge_pixels = sum(1 for x in range(CELL[0]) for y in range(CELL[1]) if alpha.getpixel((x, y)) and (x < 2 or y < 2 or x >= CELL[0] - 2 or y >= CELL[1] - 2))
        if edge_pixels:
            errors.append(f"frame {index} touches the outer two-pixel edge ({edge_pixels} pixels)")
        frames.append(frame)
        records.append({"frame": index, "bbox": bbox, "edge_pixels": edge_pixels})

    if errors or len(frames) != FRAME_COUNT:
        Path(args.json_out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json_out).write_text(json.dumps({"ok": False, "errors": errors, "frames": records}, indent=2), encoding="utf-8")
        raise SystemExit("; ".join(errors) or "frame validation failed")

    atlas = Image.new("RGBA", (CELL[0] * FRAME_COUNT, CELL[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * CELL[0], 0))
    Path(args.png_out).parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.png_out, "PNG")
    Path(args.atlas_out).parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.atlas_out, "WEBP", lossless=True, method=6)

    if args.qa_source:
        qa_atlas = Image.open(args.qa_source).convert("RGBA")
        if qa_atlas.size != (CELL[0] * FRAME_COUNT, CELL[1]):
            raise SystemExit(f"QA atlas is {qa_atlas.size}, expected {(CELL[0] * FRAME_COUNT, CELL[1])}")
        frames = [qa_atlas.crop((index * CELL[0], 0, (index + 1) * CELL[0], CELL[1])) for index in range(FRAME_COUNT)]

    durations = [280, 220, 200, 180, 170, 220, 260, 300]
    Path(args.preview_out).parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(args.preview_out, save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=2)

    contact = checkerboard((CELL[0] * FRAME_COUNT, CELL[1] + 24))
    draw = ImageDraw.Draw(contact)
    draw.rectangle((0, 0, contact.width, 23), fill=(31, 55, 42, 255))
    for index, frame in enumerate(frames):
        contact.alpha_composite(frame, (index * CELL[0], 24))
        draw.text((index * CELL[0] + 7, 6), f"badminton {index + 1}", fill=(255, 255, 255, 255))
    Path(args.contact_out).parent.mkdir(parents=True, exist_ok=True)
    contact.save(args.contact_out)

    result = {
        "ok": True,
        "source_png": str(Path(args.png_out).resolve()),
        "atlas": str(Path(args.atlas_out).resolve()),
        "size": atlas.size,
        "cell": CELL,
        "frames": records,
        "preview": str(Path(args.preview_out).resolve()),
        "contact_sheet": str(Path(args.contact_out).resolve())
    }
    Path(args.json_out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
