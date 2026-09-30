# Medical and insurance glossary starter — review draft

These original starter lists are not clinically validated or a complete bilingual dictionary. Have a qualified English/Bosnian interpreter review the mappings for your setting before use. Keep only relevant terms; technical context can influence recognition and translation, not guarantee correctness.

## Set up in Intera

1. Stop listening. Open Settings / Languages.
2. Keep Automatic / English ↔ Bosnian; select language restriction only if those are the languages spoken. Save preferences.
3. Paste relevant lines from `medical-recognition.txt` and/or `insurance-recognition.txt` into Recognition terms. These guide recognition; they are not translations.
4. After reviewing them, paste `starter-mappings-review-draft.txt` into Directional translation mappings. Each line is source = target. Reverse directions require separate lines; acronym expansion may not be reversible and should not be forced.
5. Select Save as a generic glossary for later sessions and click Apply glossary. Save preferences is separate from Apply glossary.
6. Start a new connection. Use ordinary synthetic sentences in both languages and inspect the original and translated meaning.

Intera accepts up to 100 recognition terms and 100 mappings, each value up to 100 characters. Duplicate recognition terms and duplicate mapping sources (case-insensitive) are rejected. Applying replaces the entire current glossary. Keeping an external copy is useful; updated builds also load the current glossary into the editor. Saved generic terms persist locally and are sent to Soniox with each new connection. They do not go to Whop.

Do not include patient names, dates of birth, IDs, policy numbers or case summaries. The glossary is not encrypted transcript storage; save generic terminology only.

## Insurance terms that need context review

Do not force deductible, copayment and coinsurance into one generic Bosnian word. They describe different payment structures. Use the applicable payer's explanation and have your interpreter approve a precise rendering; recognition terms can include the English terms without imposing an unreviewed translation. See the official [deductible](https://www.healthcare.gov/glossary/deductible/), [copayment](https://www.healthcare.gov/glossary/co-payment/) and [coinsurance](https://www.healthcare.gov/glossary/co-insurance/) definitions.

## Verify before relying on a list

Use at least one English and one Bosnian test sentence for each reviewed mapping. Include negatives, numeric values and surrounding words, not only isolated terms. Check that diacritics and intended meaning survive. Medication names, units and doses must remain faithful to the actual speech; do not map a brand to a dose or convert units through glossary rules. A glossary does not fix an absent translation stream; first complete `docs/TRANSLATION-TROUBLESHOOTING.md`.
