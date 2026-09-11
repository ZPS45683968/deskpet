# Zhubao look mechanics

Zhubao is a soft, round seated panda with large physical eyes, a separately readable head, small ears, a stable lower-body base, and a bamboo sprig held between both paws. Looking around should feel like attention, not like the whole sticker rotating.

## Natural motion

- The lower torso, feet, seated baseline, and bamboo-to-paw contact stay anchored.
- Both physical eyes lead by rotating together inside the original black eye patches; highlights, pupils, eyelids, and visible eye surface move as one coherent eye construction.
- The nose and muzzle shift slightly toward the target, followed by a restrained head yaw or pitch. Head shape and facial proportions do not stretch.
- The nearer cheek/ear becomes slightly more visible on horizontal turns; the far cheek/ear becomes slightly occluded. Ears follow the head with only a tiny lag.
- The bamboo stays centered in the paws. Its leafy top may lag the head by a small amount but never detaches, flips sides, or teleports.
- No whole-sprite rotation, skew, scale pulsing, body sliding, replacement eyes, detached marks, shadows, or effects.

## Cardinal pose families

- `000 up`: pupils and eye surfaces aim upward; eyelids open slightly; nose tips upward; chin lifts a little while the seated base and bamboo remain fixed.
- `090 screen-right`: pupils, nose tip, muzzle, and head turn unmistakably toward the image's right edge; more of Zhubao's screen-left cheek is visible and the far screen-right cheek compresses slightly.
- `180 down`: pupils and eye surfaces aim down toward the bamboo; eyelids lower slightly; muzzle and chin tuck; the head bows without shrinking the body.
- `270 screen-left`: pupils, nose tip, muzzle, and head turn unmistakably toward the image's left edge; more of Zhubao's screen-right cheek is visible and the far screen-left cheek compresses slightly.

## Motion budget

Each 22.5-degree step changes eye aim by one even increment, then head yaw/pitch by a smaller even increment, with at most a tiny ear and bamboo-leaf follow-through. Head scale, seated baseline, torso center, paw contacts, and bamboo stem position remain stable. The `157.5 -> 180` and `337.5 -> 000` boundaries must be exactly one smooth step with no snap or reversal.
