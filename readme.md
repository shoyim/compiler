# Compiler API 

---

## 🛠 O'rnatish va Ishga tushirish

### 1. Talablar
Tizimingizda quyidagilar o'rnatilgan bo'lishi kerak:
* [Docker](https://www.docker.com/products/docker-desktop)
* [Docker Compose](https://docs.docker.com/compose/install/)

### 2. Loyihani yuklab olish
```bash
git clone [https://github.com/shoyim/compiler.git](https://github.com/shoyim/compiler.git)
cd compiler
```

### 3. Konfiguratsiya

Loyiha avtomatik ravishda `./data/compiler` papkasini ma'lumotlar ombori sifatida ishlatadi. `docker-compose.yaml` faylida barcha kerakli `volumes` va `environment` sozlamalari sozlangan.

### 4. Build va Run

Konteynerni qurish va fon rejimida ishga tushirish:

```bash
docker compose up -d --build
```


3. Konteynerdan chiqing (`exit`) va servisni yangilang:
```bash
docker compose restart compiler_api
```



---

## API dan foydalanish

API server standart **2000**-portda ishlaydi.

### Kodni ishga tushirish (Execute)

**Endpoint:** `POST http://localhost:2000/api/v2/execute`

**Request Body:**

```json
{
    "language": "python",
    "version": "3.10.0",
    "files": [
        {
            "content": "print('Salom, Compiler!')"
        }
    ]
}

```

### O'rnatilgan tillar ro'yxatini olish

**Endpoint:** `GET http://localhost:2000/api/v2/runtimes`

---



**Loyiha muallifi:** [Shoyim](https://github.com/shoyim)
