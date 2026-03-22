# Compiler API

> Ko'p tilli kod kompilyatsiya va bajarish uchun ochiq API — o'zbek dasturchilari uchun qulay interfeys.

**Repo:** [github.com/shoyim/compiler](https://github.com/shoyim/compiler)

---

## Mundarija

- [Loyiha haqida](#loyiha-haqida)
- [Qo'llab-quvvatlanadigan tillar](#qollab-quvvatlanadigan-tillar)
- [API endpointlari](#api-endpointlari)
  - [Runtimelar ro'yxati](#runtimelar-royxati)
  - [Kodni bajarish](#kodni-bajarish)
  - [Interaktiv bajarish (WebSocket)](#interaktiv-bajarish-websocket)
- [Ishlash tamoyili](#ishlash-tamoyili)
- [Xavfsizlik](#xavfsizlik)
- [O'rnatish va ishga tushirish](#ornatish-va-ishga-tushirish)
- [Litsenziya](#litsenziya)

---

## Loyiha haqida

**Compiler API** — bu brauzer yoki ilovangizdan to'g'ridan-to'g'ri istalgan dasturlash tilida kod yozish va bajarishga imkon beruvchi REST API. Konteyner ichida **Isolate** sandbox texnologiyasi yordamida xavfsiz tarzda ishlaydi.

Port `2000` da HTTP server sifatida ishlaydi va CLI hamda veb ilovalar bilan muloqot qilishi mumkin.

---

## Qo'llab-quvvatlanadigan tillar

Quyidagi dasturlash tillari qo'llab-quvvatlanadi:

`awk` `bash` `befunge93` `brachylog` `brainfuck` `bqn` `c` `c++` `cjam` `clojure` `cobol`
`coffeescript` `cow` `crystal` `csharp` `csharp.net` `d` `dart` `dash` `dragon` `elixir`
`emacs` `emojicode` `erlang` `file` `forte` `forth` `fortran` `freebasic` `fsharp.net`
`fsi` `go` `golfscript` `groovy` `haskell` `husk` `iverilog` `japt` `java` `javascript`
`jelly` `julia` `kotlin` `lisp` `llvm_ir` `lolcode` `lua` `matl` `nasm` `nasm64` `nim`
`ocaml` `octave` `osabie` `paradoc` `pascal` `perl` `php` `ponylang` `powershell` `prolog`
`pure` `pyth` `python` `python2` `racket` `raku` `retina` `rockstar` `rscript` `ruby`
`rust` `samarium` `scala` `smalltalk` `sqlite3` `swift` `typescript` `basic` `basic.net`
`vlang` `vyxal` `yeethon` `zig`

---

## API Endpointlari

### Runtimelar ro'yxati

O'rnatilgan barcha runtime muhitlarini qaytaradi.

```
GET /api/v2/runtimes
```

**Javob namunasi:**

```json
[
  {
    "language": "bash",
    "version": "5.1.0",
    "aliases": ["sh"]
  },
  {
    "language": "python",
    "version": "3.10.0",
    "aliases": ["py", "python3"]
  }
]
```

---

### Kodni bajarish

Berilgan til va fayllar asosida kodni sandbox muhitida bajaradi.

```
POST /api/v2/execute
```

**So'rov parametrlari:**

| Parametr               | Tur     | Majburiy | Tavsif |
|------------------------|---------|----------|--------|
| `language`             | string  | ✅       | Bajarilishi kerak bo'lgan til nomi yoki aliasi |
| `version`              | string  | ✅       | Til versiyasi (SemVer formatida) |
| `files`                | array   | ✅       | Kod fayllari massivi. Birinchi fayl asosiy fayl hisoblanadi |
| `files[].name`         | string  | ❌       | Fayl nomi (yo'lsiz) |
| `files[].content`      | string  | ✅       | Fayl mazmuni |
| `files[].encoding`     | string  | ❌       | Kodlash usuli: `utf8`, `base64`, `hex`. Standart: `utf8` |
| `stdin`                | string  | ❌       | Standart kirishga uzatiladigan matn. Standart: `""` |
| `args`                 | array   | ❌       | Dasturga uzatiladigan argumentlar. Standart: `[]` |
| `compile_timeout`      | number  | ❌       | Kompilyatsiya uchun maksimal vaqt (ms). Standart: `10000` |
| `run_timeout`          | number  | ❌       | Bajarish uchun maksimal vaqt (ms). Standart: `3000` |
| `compile_cpu_time`     | number  | ❌       | Kompilyatsiya uchun maksimal CPU vaqti (ms). Standart: `10000` |
| `run_cpu_time`         | number  | ❌       | Bajarish uchun maksimal CPU vaqti (ms). Standart: `3000` |
| `compile_memory_limit` | number  | ❌       | Kompilyatsiya uchun xotira chegarasi (bayt). Standart: `-1` (cheksiz) |
| `run_memory_limit`     | number  | ❌       | Bajarish uchun xotira chegarasi (bayt). Standart: `-1` (cheksiz) |

**So'rov namunasi:**

```json
{
  "language": "python",
  "version": "3.10.0",
  "files": [
    {
      "name": "main.py",
      "content": "print('Salom, Dunyo!')"
    }
  ],
  "stdin": "",
  "args": [],
  "compile_timeout": 10000,
  "run_timeout": 3000,
  "compile_cpu_time": 10000,
  "run_cpu_time": 3000,
  "compile_memory_limit": -1,
  "run_memory_limit": -1
}
```

**Muvaffaqiyatli javob (`200 OK`):**

```json
{
  "language": "python",
  "version": "3.10.0",
  "run": {
    "stdout": "Salom, Dunyo!\n",
    "stderr": "",
    "output": "Salom, Dunyo!\n",
    "code": 0,
    "signal": null,
    "message": null,
    "status": null,
    "cpu_time": 12,
    "wall_time": 180,
    "memory": 1024000
  }
}
```

> **Eslatma:** Kompilyatsiya bosqichi talab qiladigan tillar uchun (C, C++, Go, Java va h.k.) javobda `compile` kaliti ham bo'ladi.

**Xato holatlari (`status` maydonlari):**

| Kod  | Ma'no |
|------|-------|
| `RE` | Runtime xatosi (Runtime Error) |
| `SG` | Signal bilan tugash (Signal) |
| `TO` | Vaqt tugashi (Timeout) |
| `OL` | stdout hajmi oshib ketdi (Output Limit) |
| `EL` | stderr hajmi oshib ketdi (Error Limit) |
| `XX` | Ichki xato (Internal Error) |

**Noto'g'ri so'rov (`400 Bad Request`):**

```json
{
  "message": "html-5.0.0 runtime is unknown"
}
```

---

### Interaktiv bajarish (WebSocket)

> ⚠️ Bu endpoint faqat lokal API orqali mavjud — ochiq (public) API da ishlamaydi.

Jarayonlar bilan real vaqt rejimida ishlash uchun WebSocket ulanishi o'rnatiladi.

```
WS /api/v2/connect
```

**Xabar turlari:**

| Tur        | Yo'nalish          | Tavsif |
|------------|--------------------|--------|
| `init`     | Mijoz → Server     | Ish boshlash (execute endpointidagi parametrlar, lekin `stdin` siz) |
| `runtime`  | Server → Mijoz     | Runtime muhiti haqida ma'lumot |
| `stage`    | Server → Mijoz     | Joriy bosqich: `compile` yoki `run` |
| `data`     | Ikki tomonlama     | stdin, stdout yoki stderr ma'lumotlari |
| `signal`   | Mijoz → Server     | Jarayonga signal yuborish (masalan, to'xtatish) |
| `exit`     | Server → Mijoz     | Bosqich tugashi va chiqish kodi |
| `error`    | Server → Mijoz     | Xato xabari (WebSocket yopilishidan oldin) |

**Ishlash namunasi:**

```
Mijoz WebSocket ulanishini /api/v2/connect ga o'rnatadi

< {"type":"init", "language":"python", "version":"*", "files":[{"content":"input()"}]}
> {"type":"runtime", "language":"python", "version":"3.10.0"}
> {"type":"stage", "stage":"run"}
< {"type":"data", "stream":"stdin", "data":"Salom!\n"}
> {"type":"data", "stream":"stdout", "data":"Salom!\n"}
> {"type":"exit", "stage":"run", "code":0, "signal":null}
```

**WebSocket xato kodlari:**

| Kod   | Sabab |
|-------|-------|
| `4000` | Allaqachon ishga tushirilgan |
| `4001` | Ishga tushirish vaqti tugadi (1 soniyada `init` yuborilmadi) |
| `4002` | Xato xabari yuborildi |
| `4003` | Hali ishga tushirilmagan |
| `4004` | Faqat `stdin` oqimiga yozish mumkin |
| `4005` | Noto'g'ri signal |

---

## Ishlash tamoyili

**Compiler API** yuqori darajada quyidagicha ishlaydi:

1. API so'rov qabul qiladi va manba kodni vaqtinchalik faylga yozadi.
2. Kod **Isolate sandbox** muhitida bajariladi.
3. Bajarilishi talab qiladigan tillar (C, C++, Java, Go va h.k.) avval kompilyatsiya qilinadi, so'ng bajariladi.
4. Natija (stdout, stderr, chiqish kodi) mijozga qaytariladi.
5. Barcha vaqtinchalik fayllar avtomatik tozalanadi.

---

## Xavfsizlik

Tizim **Isolate** sandbox texnologiyasini ishlatadi. Bu Linux namespace, chroot, bir nechta imtiyozsiz foydalanuvchilar va cgroup mexanizmlarini birlashtiradi.

Xavfsizlik choralari:

- 🚫 Tarmoqqa chiqish odatda o'chirilgan
- 🔒 Har bir bajarish alohida, izolyatsiyalangan Linux namespace'da ishlaydi
- 👤 Har bir bajarish alohida imtiyozsiz foydalanuvchi bilan ishlaydi
- ⚙️ Maksimal jarayonlar soni — `256` (fork bomb'lardan himoya)
- 📁 Maksimal fayl soni — `2048`
- ⏱️ CPU va wall-time chegarasi — standart `3 soniya`
- 🧠 Xotira iste'moli chegaralanadi
- 📤 stdout — maksimal `1024` belgi (cheksiz chiqishdan himoya)
- 🔫 Noto'g'ri ishlaydigan kod SIGKILL bilan to'xtatiladi
- 🧹 Har bajarilishdan so'ng vaqtinchalik fayl maydoni tozalanadi

---

## O'rnatish va ishga tushirish

### Talablar

- Docker o'rnatilgan bo'lishi kerak
- Port `2000` bo'sh bo'lishi kerak

### Ishga tushirish

```bash
git clone https://github.com/shoyim/compiler.git
cd compiler
docker compose up -d
```

API `http://localhost:2000` manzilida ishlaydi.

### Tekshirish

```bash
curl http://localhost:2000/api/v2/runtimes
```

---

## Postman kolleksiyasi

Loyiha bilan birga Postman kolleksiyasi ham berilgan. Uni import qilib, barcha endpointlarni qulay tarzda sinab ko'rishingiz mumkin.

Fayl: `Compiler_Api_postman_collection.json`

---

## Litsenziya

Ushbu loyiha [MIT litsenziyasi](LICENSE) ostida tarqatiladi.

---
