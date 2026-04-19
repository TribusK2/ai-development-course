---
description: "Write a section of a learning plan. Usage: /write-section"
name: "write-section"
argument-hint: "section-number"
language: "pl"
output-format: "markdown"
---

Przygotuj teorię oraz tematy zadań praktycznych dla sekcji planu nauki. Sekcje są ponumerowane w spisie treści, np. 1.1, 2.3 itd. Odpowiedz tylko na temat sekcji wskazanej w argumencie; nie pisz o innych sekcjach.

## Spis treści

Przeczytaj spis treści zapisany w [spis_tresci](../../spis_tresci.txt).

Oczekiwany format spisu treści: każda linia zawiera numer sekcji i tytuł, np. `2.1 — Nazwa sekcji` lub `2.1. Nazwa sekcji`. Jeśli format jest inny, spróbuj rozpoznać numer sekcji na początku linii.

## Numer sekcji

- Odczytaj argument podany po `/write-section`.
- Akceptowalny format numeru sekcji: `^\d+(\.\d+)*$` (np. `2`, `2.1`, `2.1.3`).
- Jeśli argument jest numerem sekcji (np. `2.1`), znajdź odpowiadającą mu sekcję w spisie treści i zapisz jej tytuł.
- Odczytaj też tytuł modułu, do którego należy ta sekcja (np. `Moduł 2: Ekosystem Vibe Coding i AI-first ID`), aby zidentyfikować kontekst.
- Jeśli argument nie pasuje do wzorca lub nie znaleziono sekcji, odpowiedz komunikatem o błędzie i zakończ. Przykładowy komunikat: `Błąd: nieprawidłowy numer sekcji. Użyj formatu np. "2" lub "2.1".`

## Zadanie

- Utwórz nowy plik markdown w folderze `sections`, o nazwie odpowiadającej numerowi sekcji, np. `2.1.md`. Jeśli folder `sections` nie istnieje — utwórz go.
- Upewnij się, że nazwa pliku jest bezpieczna: zamień niedozwolone znaki (np. `/`, `\\`, `:`, `*`, `?`) na podkreślenia.
- Napisz w języku polskim teorię dla sekcji wskazanej w argumencie.
- Preferowana długość teorii: 4-7 podpunktów tematycznych, każdy po 200–400 słów (około 3–6 akapitów). Teoria powinna być zwięzła, ale kompletna i obejmować wszystkie kluczowe pojęcia i umiejętności związane z tą sekcją.
- Tam gdzie to potrzebne, przedstaw przykłady lub analogie.
- Używaj w przykładach Bash, JavaScript, Angular, Angular-Material, NodeJS, MongoDB, Github, AWS, AWS-Lambda (serverless), Docker (tylko w developmencie). Użyj innych języków programowania lub pseudokodu tylko wtedy jeśli nie da się praktycznie zastosować wymienionych technologii.
- Napisz tematy zadań praktycznych (tylko tematy, bez rozwiązań) dla sekcji wskazanej w argumencie. Generuj 4 tematy: 1 łatwy, 2 średnie, 1 zaawansowany.
- Zachowaj strukturę i formatowanie odpowiadające skryptowi naukowemu, ale w przyjemnej formie — używaj nagłówków, list punktowanych, pogrubień, tabel itp.

## Weryfikacja

- Po napisaniu teorii i tematów zadań, sprawdź czy nie zawierają one błędów merytorycznych, są kompletne i zgodne z tytułem sekcji.
- Sprawdź czy nie ma błędów ortograficznych lub gramatycznych.
- Sprawdź czy tłumaczenia pojęć anglojęzycznych są poprawne i spójne z resztą materiału.
- Jeśli wykryjesz jakiekolwiek problemy, popraw je przed zakończeniem.
