# Презентация для совета директоров

Презентация MyGig Rewards Dashboard в формате [Marp](https://marp.app/) (Markdown).

## Файлы

- **`board-presentation.md`** — слайды презентации
- **`speaker-notes.md`** — подсказки для докладчика: что говорить, демо, ответы на возражения

## Как просматривать и показывать

### Вариант 1: VS Code + Marp (рекомендуется)

1. Установите расширение [Marp for VS Code](https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode).
2. Откройте `board-presentation.md`.
3. Нажмите «Open Preview to the Side» или используйте команду **Marp: Toggle Marp Preview**.
4. Для полноэкранного показа: в превью кнопка полноэкрана или **Marp: Open Preview**.

### Вариант 2: Экспорт в PDF/HTML

С Marp CLI (нужен Node.js):

```bash
npx @marp-team/marp-cli@latest presentation/board-presentation.md -o presentation/board-presentation.pdf
# или HTML:
npx @marp-team/marp-cli@latest presentation/board-presentation.md -o presentation/board-presentation.html
```

После этого можно показывать PDF в любой программе или открыть HTML в браузере.

### Вариант 3: Копирование в PowerPoint / Google Slides

Слайды в Markdown разделены `---`. Каждый блок между `---` — один слайд. Текст можно скопировать в слайды вручную и оформить по корпоративному шаблону.

## Структура презентации

1. Титул и повестка  
2. Проблема → Решение → Результат  
3. Бизнес-цели и выгоды (5 слайдов)  
4. Демонстрация (описание перед живым демо)  
5. Архитектура и интеграция  
6. Этапы внедрения  
7. Риски и митигация  
8. Рекомендация и запрос решения  

Демонстрация продукта проводится **вживую** между слайдами «Демонстрация продукта» и «Архитектура».
