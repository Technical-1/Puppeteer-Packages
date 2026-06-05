---
"@technical-1/pdf": minor
---

`pageToPdf` deep-merges the `margin` per side, so a partial margin keeps the
unspecified sides at the 1cm default instead of dropping them to 0.
