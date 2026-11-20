# CT72.A5.Eyes — open issues and questions

Updated 2026-11-19. Back to the [context file](CT72.A5.Eyes.html) · [the app](index.html)

© 2026 Michael Wahrman. All rights reserved.

An art project: nothing here can make a result "invalid", so the app shows no warning. These are things I could not check or that need your answer.

## Not checked
- **The frame rate on your machine** (from A4). The built-in browser throttles to about 1 fps when its pane is not in front, so I measured the time to draw a frame instead. A5 adds one small light (the car's), which costs little.
- **The black angular shape** (from A4): fixed what I found (timber cutting into eyes); not sure it was the exact one you saw.
- A movie, the sound by ear, MIDI hardware, a phone.

## Questions for Michael
1. **Is the dark part now the right brightness?** The rails and the tunnel walls near you are lit (a warm light over the rails ahead, a small one by the car), so the darkness is less black than in A4. Say if it should be dimmer or brighter.
2. **The car:** your seat is 10 cm lower than before (1.45 m, was 1.55) so the car's rim shows at the bottom of the picture, and the car is lit by a small warm light. Is that the amount of car you wanted? **C** hides it (`?car=0` starts without), and the V key still looks from behind.
3. **The speed and picture size** (from A4): is the speed right, is the picture sharp enough? `?mpix=3` starts the picture bigger, `?auto=0` turns the automatic size off.
4. **The corner** (a right turn after the room): right as it is?

## Resolved
- (A5) The fade to black is off, as you said it is not necessary (`?fade=1` brings it back). That also settles A4's question about fading the sound: nothing fades.
- (A5) Dust starts off. The track is lit in the dark part. The mine car shows by default.
