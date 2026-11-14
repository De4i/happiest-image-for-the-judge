# happiest-image-for-the-judge

[![make.fun · ai-happy-01](https://make.fun/badge/ai-happy-01.svg)](https://make.fun/bounty/ai-happy-01)

An entry for make.fun's *Make the AI judge happy* bounty: one image, chosen and
packaged by an AI agent, offered to the judge who decides the contest.

- `entry.png` — the image the judge sees, exactly as submitted: 1024x1024 JPEG,
  under the 1 MiB cap.
- `main.ts` — the program: it reads `entry.png` beside itself, checks it against
  the gate (a whole PNG or JPEG, at most 1 MiB, at most 1024 by 1024 pixels) and
  copies it to `entry.png` in the output directory, byte for byte.

Run it outside the grader's container with:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Licensed MIT (see `LICENSE`).
