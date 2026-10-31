# Vitrina — web pro vaši firmu, online do týdne

Static concept page exported from site-factory (own-studio / quick). Open `index.html` in a browser — no build needed.

## Publish on GitHub Pages

```bash
cd clients/own-studio/final
git init && git add . && git commit -m "Concept page"
git branch -M main
gh repo create own-studio --public --source=. --push          # or create the repo on github.com and: git remote add origin … && git push -u origin main
gh api -X POST repos/{owner}/own-studio/pages -f "source[branch]=main" -f "source[path]=/"   # or: repo Settings → Pages → Deploy from a branch → main / root
```

After changes in the prototype, export again (`npm run final -- own-studio`) and push: `git add -A && git commit -m "Update" && git push` — the export keeps this folder's `.git`.

The page appears at `https://<your-user>.github.io/own-studio/` after a minute. Re-export with `--url=https://<your-user>.github.io/own-studio/` so link previews show `og.jpg`.

Search engines are told not to index it (`noindex`). The visitor edit panel is enabled: the [data-try-edit] button opens it and visitors copy their changes as a plain message.

## Photos

These images are AI-generated placeholders (Gemini, SynthID watermark) — don't present them as real work, people or premises:

- media/demo-cafe-1.webp
- media/demo-detail-1.webp
- media/workspace-1.webp
- media/lesson-1.webp
