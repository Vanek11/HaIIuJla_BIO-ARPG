# AGENTS.md — правила работы с проектом HaIIuJla_BIO-ARPG

## Обязательные правила

1. **Каждое изменение документировать и коммитить.**
   После любой правки: краткое описание что/зачем изменено (в ответе пользователю
   и/или в README/CHANGELOG) + отдельный git-коммит с понятным сообщением.

2. **Проверка перед коммитом.** Минимум: `node --check` для изменённых js-файлов;
   для UI-правок — smoke-тест через puppeteer (`$env:LOCALAPPDATA\Temp\opencode\pptr`).

## Команды проекта

- Сборка Tailwind: `npm i tailwindcss @tailwindcss/cli` (временно) →
  `npx @tailwindcss/cli -i css/tailwind.input.css -o css/tailwind.min.css --minify`
  → после сборки удалить node_modules и package*.json
- Проверка синтаксиса: `node --check js/<файл>.js`
- Пуш: `git push` (ветка main, remote origin = github.com/Vanek11/HaIIuJla_BIO-ARPG)

## Структура

- `index.html` — вся разметка экранов
- `js/data.js` — игровые данные (STAGES, TRAININGS, ITEM_POOL, DUEL_BOTS, MUSIC_TRACKS…)
- `js/game.js` — логика и рендер
- `js/events.js` — делегирование кликов ([data-call] / [data-args])
- `js/background.js` — фон-канвас + кастомный курсор
- `css/game.css` — стили темы; `css/tailwind.min.css` — собранный Tailwind (не править руками)
- `images/` — формы (webp); `images/items/` — svg предметов

## Нюансы

- PowerShell 5.1: не читать/писать UTF-8 файлы через Get-Content/Set-Content —
  только [IO.File]::ReadAllText/WriteAllText с UTF8-энкодингом (иначе кириллица ломается)
- Иконки: только бесплатный набор FA6 (`fa-person-breast`, `fa-boot`, `fa-baseball-cap` — Pro, не работают)
- Сейвы: при добавлении полей в state ничего делать не нужно — deepMerge в loadGame
