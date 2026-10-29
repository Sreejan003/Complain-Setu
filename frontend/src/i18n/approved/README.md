Place supplied official translations here as `<locale>/<namespace>.json`, using the same semantic keys as `locales/en`. Only add wording whose approval has actually been supplied. These files merge **after** drafts and take precedence without editing React pages.

Terminology approval alone does not enable an entire language. After the whole locale has been translated and tested, record the native review, approval reference, and `coverageComplete: true` in `reviews.json`. Run `npm run check:i18n` before changing its status to `approved`. All non-English languages currently remain unreviewed development previews.

Script variants require their own registry entry, resources, font, review and BCP 47 tag; the existing variants list documents configurable alternatives and does not falsely advertise untranslated alternate scripts.
