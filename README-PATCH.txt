VCAJ Awards + Powerplay fix patch

This patch is designed for the repository ZIP the user supplied. It contains only files to replace/add at the repository root; it is NOT a replacement for the full repository.

Files included:
- scorer.html, scorer.js, scorer-ui.css: Admin-controlled Powerplay setup and scorer display.
- live.html, live.js: Public live panel Powerplay status banner.
- awards-smart-compatible.js: stores award scope in the admin award record.
- season-awards.html, season-awards.js: public Awards page now reads awards saved from Admin Awards panel.
- public-awards.html, public-awards.js: alternate public Awards page also reads Admin-saved awards.

Upload/replace only these files in the existing GitHub repository. Do not delete other repository files. Make a backup first. Test on a Practice Match and test saving/editing an award before using it during a live match.

Validation performed: JavaScript syntax checks and ZIP/file-presence checks. Firebase/GitHub Pages live integration has NOT been tested from this environment.
