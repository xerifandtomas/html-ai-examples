# Guía de Despliegue — Gantt SaaS

## Requisitos previos

| Herramienta | Versión mínima | Uso |
|-------------|---------------|-----|
| Node.js | 20.x | Ejecución local |
| npm | 10.x | Gestión de dependencias |
| Docker | 24.x | Despliegue en contenedor |
| Docker Compose | 2.x | Orquestación |

---

## Opción 1 — Ejecución local (desarrollo)

### 1. Clonar / preparar el proyecto

```bash
cd gantt-proyect
npm install
```

### 2. Iniciar el servidor

```bash
npm start
```

El servidor arranca en `http://localhost:3000`.

### 3. Variables de entorno (opcional)

Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=3000
JWT_SECRET=mi_secreto_seguro_aqui
DATABASE_PATH=./data/gantt.db
```

> ⚠️ **Nunca** compartas ni comités el archivo `.env` en el repositorio.

---

## Opción 2 — Docker (recomendado para producción)

### 1. Construir y levantar

```bash
cd gantt-proyect
docker compose up -d --build
```

La aplicación estará disponible en `http://localhost:3000`.

### 2. Ver logs

```bash
docker compose logs -f gantt
```

### 3. Detener

```bash
docker compose down
```

### 4. Detener y eliminar datos (⚠️ irreversible)

```bash
docker compose down -v
```

---

## Estructura de archivos

```
gantt-proyect/
├── server.js              # Punto de entrada Express
├── database.js            # Inicialización SQLite
├── middleware/
│   └── auth.js            # Validación JWT
├── routes/
│   ├── auth.js            # Autenticación
│   ├── teams.js           # Equipos
│   └── projects.js        # Proyectos y tareas
├── public/
│   ├── index.html         # Login / Registro
│   └── app.html           # Aplicación principal
├── data/                  # Directorio de la base de datos (creado automáticamente)
│   └── gantt.db           # SQLite (volumen Docker en producción)
├── Dockerfile
├── docker-compose.yml
└── docs/
    ├── manual.md
    └── guia-despliegue.md
```

---

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|----------|------------------|-------------|
| `PORT` | `3000` | Puerto HTTP del servidor |
| `JWT_SECRET` | `dev_secret_change_in_production` | Clave para firmar tokens JWT |
| `DATABASE_PATH` | `./data/gantt.db` | Ruta del archivo SQLite |
| `NODE_ENV` | `development` | Modo de ejecución |

> 🔒 Cambia siempre `JWT_SECRET` en producción por una cadena larga y aleatoria. Puedes generar una con:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

---

## Personalizar el puerto

**Local:**
```bash
PORT=8080 npm start
```

**Docker Compose** — edita `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"   # host:contenedor
```

---

## Proxy inverso con Nginx (producción)

Ejemplo de configuración para exponer en un dominio con HTTPS:

```nginx
server {
    listen 80;
    server_name gantt.midominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name gantt.midominio.com;

    ssl_certificate     /etc/letsencrypt/live/gantt.midominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gantt.midominio.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Copias de seguridad de la base de datos

La base de datos SQLite se almacena en el volumen Docker `gantt_data`. Para hacer una copia:

```bash
# Identificar el contenedor
docker compose ps

# Copiar el archivo .db al host
docker cp gantt-proyect-gantt-1:/app/data/gantt.db ./backup-$(date +%Y%m%d).db
```

Para restaurar:
```bash
docker cp ./backup-20240101.db gantt-proyect-gantt-1:/app/data/gantt.db
docker compose restart gantt
```

---

## Solución de problemas

### "Error: better-sqlite3 was compiled against a different Node.js version"

Reconstruye los módulos nativos:
```bash
npm rebuild better-sqlite3
```

O en Docker, limpia y reconstruye la imagen:
```bash
docker compose build --no-cache
```

### "EADDRINUSE: address already in use :::3000"

Otro proceso usa el puerto 3000. Cambia el puerto o detén el proceso:
```bash
# En Linux/Mac
lsof -ti:3000 | xargs kill
```

### La base de datos no persiste tras reiniciar Docker

Asegúrate de que el volumen `gantt_data` esté declarado en `docker-compose.yml` y que la variable `DATABASE_PATH` apunte a `/app/data/gantt.db`.

### Token JWT inválido / sesión expirada

Los tokens expiran en **7 días**. Simplemente vuelve a iniciar sesión. Si cambias `JWT_SECRET` en producción, todos los usuarios deberán volver a autenticarse.

---

## Primer usuario administrador

Por diseño, el primer usuario que se registra como "Líder de equipo" tiene ese rol. Para promover a un usuario a **admin** ejecuta el script incluido en el proyecto:

```bash
# Desde el host (ejecución local)
node make-admin.js tu@email.com

# Desde Docker
docker exec -it gantt-proyect-gantt-1 node make-admin.js tu@email.com
```

El script usa `better-sqlite3` (ya instalado) y respeta la variable `DATABASE_PATH` si la tienes configurada.

---

## Actualización de la aplicación

```bash
# Reconstruir con los últimos cambios
docker compose build --no-cache

# Reiniciar sin tiempo de inactividad
docker compose up -d gantt
```

Los datos persisten en el volumen Docker y no se ven afectados por la actualización.
