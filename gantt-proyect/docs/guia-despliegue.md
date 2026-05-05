# Guia de Despliegue - Gantt SaaS (PostgreSQL only)

## Requisitos

- Node.js 20+
- npm 10+
- Docker 24+ (opcional)
- Docker Compose 2+ (opcional)
- PostgreSQL 14+ accesible desde la aplicacion

## Ejecucion local

1. Instalar dependencias.

```bash
cd gantt-proyect
npm install
```

2. Crear archivo `.env` en la raiz.

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=cambia_esto_por_un_valor_largo_y_aleatorio
ALLOWED_ORIGINS=http://localhost:3000
DB_DRIVER=pg
DB_HOST=localhost
DB_PORT=5432
DB_USER=gantt
DB_PASSWORD=gantt
DB_NAME=gantt_db
```

3. Iniciar aplicacion.

```bash
npm start
```

Aplicacion: `http://localhost:3000`

## Docker Compose

El proyecto usa una topologia unica con PostgreSQL.

```bash
docker compose up -d --build
```

Comandos utiles:

```bash
docker compose logs -f gantt
docker compose down
docker compose down -v
```

## Variables de entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto HTTP |
| `NODE_ENV` | `development` | Entorno |
| `JWT_SECRET` | sin default seguro | Clave JWT (obligatoria) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Lista de origins separados por coma |
| `DB_DRIVER` | `pg` | Debe ser `pg`/`postgres`/`postgresql` |
| `DB_HOST` | `localhost` | Host PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_USER` | `gantt` | Usuario PostgreSQL |
| `DB_PASSWORD` | `gantt` | Password PostgreSQL |
| `DB_NAME` | `gantt` | Base de datos PostgreSQL |

## Seguridad minima de despliegue

- No commitear `.env`.
- Definir `JWT_SECRET` fuerte (32+ bytes aleatorios).
- Restringir `ALLOWED_ORIGINS` al dominio real de frontend.
- Exponer PostgreSQL solo en red interna si es produccion.
- Mantener backups periodicos de PostgreSQL.

Generar un secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Backup y restore (PostgreSQL)

Backup:

```bash
pg_dump -h <host> -p <port> -U <user> -d <db> -Fc -f backup.dump
```

Restore:

```bash
pg_restore -h <host> -p <port> -U <user> -d <db> --clean --if-exists backup.dump
```

## Script de administracion

Para promover un usuario a admin:

```bash
node make-admin.js usuario@correo.com
```

El script usa credenciales PostgreSQL desde variables de entorno (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

## Troubleshooting

### Error de CORS

Asegurar que el origin del navegador este incluido en `ALLOWED_ORIGINS`.

### Error de conexion a PostgreSQL

Verificar host/puerto/credenciales y que la BD este accesible desde el contenedor o host donde corre la app.

### Error por `DB_DRIVER`

La aplicacion es PostgreSQL-only. Usa `DB_DRIVER=pg`.
