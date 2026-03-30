# Bruno — Кастомная сборка

Форк [Bruno](https://www.usebruno.com/) с добавленной Git-интеграцией и системой авто-обновлений.

---

## Содержание

1. [Быстрый старт (разработка)](#1-быстрый-старт-разработка)
2. [Сборка exe](#2-сборка-exe)
3. [Публикация обновления](#3-публикация-обновления)
4. [Обзор добавленных фич](#4-обзор-добавленных-фич)
5. [Архитектура изменений](#5-архитектура-изменений)
6. [Конфигурация Auto-update](#6-конфигурация-auto-update)

---

## 1. Быстрый старт (разработка)

### Требования
- Node.js 18+
- Git

### Установка зависимостей

```bash
# Из корня репозитория
npm install

# Отдельно для каждого пакета (если нужно)
cd packages/bruno-app && npm install
cd packages/bruno-electron && npm install
```

### Запуск в режиме разработки

Нужно два терминала:

**Терминал 1 — React (bruno-app):**
```bash
cd packages/bruno-app
npm run dev
```
Ждём пока напишет `ready on http://localhost:3000`

**Терминал 2 — Electron (bruno-electron):**
```bash
cd packages/bruno-electron
npx electron .
```

> Важно: `npx electron .` запускать именно из `packages/bruno-electron`, не из корня.

---

## 2. Сборка exe

```bash
# Шаг 1 — собираем React
cd packages/bruno-app
npm run build

# Шаг 2 — собираем Electron в установщик
cd packages/bruno-electron
npm run dist:win
```

Готовый установщик появится в `packages/bruno-electron/out/`.
Файл называется примерно `Bruno Setup 2.0.0.exe`.

---

## 3. Публикация обновления

Для того чтобы пользователи получили уведомление об обновлении — нужно опубликовать новый GitHub Release.

### Настройка (один раз)

1. Создай GitHub токен: **Settings → Developer settings → Fine-grained personal access tokens**
   - Repository access: только нужный репо
   - Permissions → **Contents: Read and write**

2. Заполни данные в `packages/bruno-electron/src/utils/auto-updater.js`:
```js
const UPDATE_CONFIG = {
  provider: 'github',
  owner: 'твой-github-username',      // <-- заполнить
  repo: 'название-репозитория',        // <-- заполнить
  token: 'ghp_xxxxxxxxxxxxxxxxxx',     // <-- токен (read-only для клиентов)
  private: true
};
```

3. Заполни то же в `packages/bruno-electron/electron-builder-config.js`:
```js
publish: {
  provider: 'github',
  owner: 'твой-github-username',       // <-- заполнить
  repo: 'название-репозитория',         // <-- заполнить
  private: true
}
```

### Публикация новой версии

1. Обнови версию в `packages/bruno-electron/package.json`:
```json
"version": "2.1.0"
```

2. Собери и опубликуй:
```bash
cd packages/bruno-app
npm run build

cd packages/bruno-electron
GH_TOKEN=ghp_xxxxxxxxxx npm run dist:win -- --publish always
```

Это автоматически:
- Соберёт `.exe`
- Создаст GitHub Release с тегом `v2.1.0`
- Загрузит туда установщик и файл `latest.yml`

После этого все запущенные приложения увидят обновление при следующей проверке.

---

## 4. Обзор добавленных фич

### Клонирование коллекции из Git репозитория

В сайдбаре: ПКМ → **Clone Git Repository**

Поля:
- **Repository URL** — ссылка на репозиторий (напр. `https://github.com/org/project.git`)
- **Target Directory** — куда сохранить локально
- **Collection Path in Repository** — путь к папке с коллекцией внутри репо (напр. `work-order-addon/bruno-collection`)

Используется **sparse checkout** — скачивается только указанная папка, весь остальной код проекта (Java, gradle и т.д.) не загружается.

---

### Git настройки коллекции

Открывается через: шестерёнка коллекции → вкладка **Git**

Двухколоночный интерфейс:

**Левая колонка — настройки:**
| Поле | Описание |
|------|----------|
| Remote Repository URL | URL репозитория (`origin`) |
| Auto Commit & Push on Save | Авто-коммит при каждом сохранении запроса |
| Auto Pull (every 2 minutes) | Авто-пулл изменений с сервера каждые 2 минуты |
| Commit Message + Commit & Push | Ручной коммит с произвольным сообщением |

**Правая колонка — список изменений:**
- Показывает изменённые файлы с цветовыми маркерами: `M` (изменён), `A` (добавлен), `D` (удалён)
- Клик на файл → показывает diff (что было / что стало)
- Кнопка **↩** рядом с файлом → откатить изменения в этом файле

---

### Авто-коммит и пуш

Включается галочкой **Auto Commit & Push on Save**.

- Срабатывает при каждом сохранении запроса (Ctrl+S)
- Дебаунс 2 секунды — несколько быстрых сохранений объединяются в один коммит
- Сообщение коммита: `[Bruno] auto-save: 2024-01-15T10:30:00.000Z`
- Если push отклонён (другой человек успел запушить раньше) — автоматически делает rebase и повторяет push

---

### Авто-пулл

Включается галочкой **Auto Pull (every 2 minutes)**.

- Каждые 2 минуты тянет изменения с `origin`
- Использует `git pull --rebase` чтобы не создавать лишних merge-коммитов
- Защищён mutex от одновременного запуска с авто-коммитом

---

### Разрешение конфликтов

Если два человека одновременно изменили один файл — возникает merge-конфликт.

**Как это видно в приложении:**
1. В правой колонке Git настроек появляется секция **"Conflicts — click to resolve"** с красным `!`
2. Клик на конфликтующий файл открывает **редактор конфликтов**

**Редактор конфликтов:**
- Показывает две версии рядом: **Yours** (твои изменения) и **Theirs** (чужие изменения)
- Кнопка **Accept Ours** — принять свою версию для всех конфликтов
- Кнопка **Accept Theirs** — принять чужую версию для всех конфликтов
- Нижнее поле — редактируемый результат (можно совместить вручную)
- Кнопка **Resolve & Stage** — сохранить решение и пометить файл как разрешённый
- После разрешения всех конфликтов: кнопка **Continue Rebase & Push**
- Кнопка **Abort Rebase** — отменить rebase и вернуться к своим изменениям

---

### Авто-обновление

При запуске приложение через 8 секунд проверяет GitHub на наличие новой версии.

- Если есть обновление — появляется синяя полоска вверху с кнопкой **"Загрузить"**
- Загрузка идёт в фоне с прогресс-баром
- После загрузки — кнопка **"Перезапустить"**, установка происходит автоматически

---

### Поддержка форматов коллекций

Приложение распознаёт два формата коллекций:
- `bruno.json` — стандартный формат Bruno
- `opencollection.yml` — YML формат (используется в нашем проекте)

---

## 5. Архитектура изменений

### Изменённые файлы

```
packages/bruno-electron/
  src/
    utils/
      git.js                    — добавлен cloneSparseCollection
      auto-git.js               — авто-коммит/пуш/пулл с rebase логикой
      auto-updater.js           — NEW: electron-updater интеграция
    ipc/
      git.js                    — IPC хендлеры для всех git операций
    index.js                    — подключение auto-updater
  electron-builder-config.js    — publish конфиг для GitHub Releases

packages/bruno-app/
  src/
    components/
      CollectionSettings/
        GitSettings/
          index.js              — полный UI: список изменений, diff, конфликты
          StyledWrapper.js      — стили для git панели
      Sidebar/
        CloneGitRepository/
          index.js              — поле Collection Path
    pages/
      Bruno/
        index.js                — баннер авто-обновления

packages/bruno-electron/
  src/
    utils/
      filesystem.js             — поддержка opencollection.yml
```

### Ключевые IPC каналы

| Канал | Направление | Описание |
|-------|-------------|----------|
| `renderer:get-git-changed-files` | renderer → main | Получить список изменений |
| `renderer:get-git-file-diff` | renderer → main | Получить diff файла |
| `renderer:manual-git-commit-push` | renderer → main | Ручной коммит и пуш |
| `renderer:git-rebase-and-push` | renderer → main | Rebase + push |
| `renderer:git-discard-file` | renderer → main | Откатить файл |
| `renderer:git-get-conflict-content` | renderer → main | Содержимое конфликтного файла |
| `renderer:git-resolve-conflict` | renderer → main | Сохранить решение конфликта |
| `renderer:git-continue-rebase` | renderer → main | Продолжить rebase |
| `renderer:git-abort-rebase` | renderer → main | Отменить rebase |
| `renderer:download-update` | renderer → main | Скачать обновление |
| `renderer:install-update` | renderer → main | Установить и перезапустить |
| `main:update-available` | main → renderer | Доступна новая версия |
| `main:update-progress` | main → renderer | Прогресс загрузки |
| `main:update-downloaded` | main → renderer | Обновление загружено |

---

## 6. Конфигурация Auto-update

Файл: `packages/bruno-electron/src/utils/auto-updater.js`

```js
const UPDATE_CONFIG = {
  provider: 'github',
  owner: 'ТВОЙ_GITHUB_USERNAME',   // GitHub логин или организация
  repo: 'НАЗВАНИЕ_РЕПОЗИТОРИЯ',     // имя репо
  token: 'ТВОЙ_GITHUB_TOKEN',       // Fine-grained PAT, Contents: Read-only
  private: true
};
```

> Токен с правами **read-only** (Contents: Read) безопасно хранить в приложении — он не может изменять репозиторий, только читать файлы релизов.
