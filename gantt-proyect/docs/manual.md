# Manual de Usuario — Gantt SaaS

## Introducción

**Gantt SaaS** es una aplicación web de gestión de proyectos basada en diagramas de Gantt, diseñada para equipos pequeños. Permite coordinar tareas, asignarlas a miembros del equipo y visualizar el progreso en tiempo real.

---

## Acceso a la aplicación

### Registro

1. Abre `http://localhost:3000` en tu navegador.
2. Haz clic en la pestaña **"Registrarse"**.
3. Completa el formulario:
   - **Correo electrónico**: Tu email (será tu identificador de acceso).
   - **Nombre de usuario**: Cómo aparecerás en el equipo.
   - **Rol**:
     - *Miembro del equipo*: Puede ver proyectos y actualizar el progreso de sus tareas.
     - *Líder de equipo*: Puede crear equipos, proyectos y asignar tareas.
   - **Contraseña**: Mínimo 6 caracteres.
4. Haz clic en **"Crear cuenta"**.

```
┌─────────────────────────────┐
│  GanttSaaS                  │
│  [Iniciar Sesión][Registrarse]│
│                             │
│  Correo: ________________   │
│  Usuario: _______________   │
│  Rol: [Miembro ▼]           │
│  Contraseña: ____________   │
│  Confirmar: _____________   │
│                             │
│       [Crear cuenta]        │
└─────────────────────────────┘
```

### Inicio de sesión

1. Ingresa tu **correo electrónico** y **contraseña**.
2. Haz clic en **"Iniciar Sesión"**.
3. Serás redirigido al panel principal.

---

## Panel principal (Dashboard)

Al iniciar sesión verás el **Dashboard** con las tarjetas de proyectos de tu equipo.

```
┌──────────────────────────────────────────────────┐
│ GanttSaaS  [Dashboard] [Gantt] [Equipo] [Perfil] │
├──────────────────────────────────────────────────┤
│ Proyectos                    [+ Nuevo proyecto]  │
│                                                  │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│ │Rediseño Web│  │App Móvil   │  │Backend API │  │
│ │  [activo]  │  │[completado]│  │  [activo]  │  │
│ │ 01/06→30/06│  │ 12 tareas  │  │  8 tareas  │  │
│ │ ▓▓▓░░ 60%  │  │ ▓▓▓▓▓ 100% │  │ ▓▓░░░ 40%  │  │
│ └────────────┘  └────────────┘  └────────────┘  │
└──────────────────────────────────────────────────┘
```

- **Clic en una tarjeta** → Abre la vista de Gantt del proyecto.
- **+ Nuevo proyecto** (solo líderes/admins) → Abre el formulario de creación.

---

## Vista de Gantt

Al hacer clic en un proyecto, accedes al diagrama de Gantt interactivo.

```
┌──────────────────────────────────────────────────────────────────┐
│ 📅 Rediseño Web  [✏️ Editar] [−] [+] [+ Tarea] [🗑 Borrar]      │
├────────────────┬─────────────────────────────────────────────────┤
│ Tareas         │  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15   │
├────────────────┼─────────────────────────────────────────────────┤
│ ● Investigación│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░             │
│   ● Entrevistas│     ████░░░░░░░░░░░░░░░                        │
│ ● Diseño       │           ████████████░░░░░░░░░░               │
│ ● Desarrollo   │                      ████████████████          │
│ ● Testing      │                                   ██████       │
└────────────────┴─────────────────────────────────────────────────┘
```

### Controles del Gantt

| Botón | Acción |
|-------|--------|
| `−` / `+` | Reducir/ampliar la escala temporal |
| `+ Tarea` | Crear una nueva tarea en este proyecto |
| `✏️ Editar` | Modificar los datos del proyecto |
| `🗑 Borrar` | Eliminar el proyecto (¡irreversible!) |
| *Clic en barra* | Editar la tarea correspondiente |

### Crear / editar una tarea

Al crear o hacer clic en una tarea:

```
┌─────────────────────────────────┐
│ Nueva Tarea                 [×] │
│                                 │
│ Nombre: _______________________  │
│ Descripción: __________________  │
│                                 │
│ Inicio: [2024-06-01]            │
│ Fin:    [2024-06-15]            │
│                                 │
│ Progreso: [45]%  Estado: [En progreso ▼] │
│                                 │
│ Asignar a: [María López ▼]      │
│ Subtarea de: [— Ninguna —  ▼]   │
│                                 │
│ Color: ● ● ● ● ● ● ● ●          │
│                                 │
│ [🗑 Eliminar] [Cancelar] [Guardar]│
└─────────────────────────────────┘
```

**Campos:**
- **Nombre**: Identificador de la tarea.
- **Fechas**: Rango de inicio y fin (define la posición y ancho de la barra).
- **Progreso**: 0–100%, se muestra como relleno oscuro en la barra.
- **Estado**: Pendiente / En progreso / Completado.
- **Asignar a**: Desplegable con los miembros del equipo.
- **Subtarea de**: Si es subtarea, selecciona la tarea padre.
- **Color**: 10 colores predefinidos para diferenciar tareas visualmente.

---

## Gestión de equipos

Solo los **líderes de equipo** y **administradores** pueden gestionar equipos.

### Crear un equipo

1. Ve a la sección **Equipo** en la barra lateral.
2. Haz clic en **"+ Crear equipo"**.
3. Ingresa el nombre del equipo y confirma.

### Invitar miembros

```
┌─────────────────────────────────────┐
│ Agregar miembro                 [×] │
│                                     │
│ Correo: correo@ejemplo.com          │
│ Rol: [Miembro ▼]                    │
│                                     │
│          [Cancelar] [Agregar]        │
└─────────────────────────────────────┘
```

El usuario invitado debe estar **registrado previamente** en la plataforma.

### Vista del equipo

```
┌────────────────────────────────────────────────────┐
│ Equipo Frontend                                    │
│ Líder: Ana García                                  │
│                                                    │
│ MIEMBROS                          [+ Invitar]      │
│ ┌────────────┬──────────────────┬─────┬─────────┐ │
│ │ Usuario    │ Correo           │ Rol │Acciones │ │
│ ├────────────┼──────────────────┼─────┼─────────┤ │
│ │ ana.garcia │ ana@empresa.com  │Líder│  —      │ │
│ │ luis.perez │ luis@empresa.com │Miemb│[Quitar] │ │
│ │ marta.ruiz │ marta@empresa.com│Miemb│[Quitar] │ │
│ └────────────┴──────────────────┴─────┴─────────┘ │
└────────────────────────────────────────────────────┘
```

---

## Perfil

En la sección **Perfil** puedes:
- Ver tu información (nombre, correo, rol, equipo).
- Cambiar tu contraseña proporcionando la actual y la nueva.

---

## Roles y permisos

| Acción | Admin | Líder | Miembro |
|--------|:-----:|:-----:|:-------:|
| Ver proyectos del equipo | ✅ | ✅ | ✅ |
| Crear proyectos | ✅ | ✅ | ❌ |
| Editar/borrar proyectos | ✅ | ✅* | ❌ |
| Crear tareas | ✅ | ✅ | ❌ |
| Editar tareas | ✅ | ✅ | Solo propias |
| Crear equipos | ✅ | ✅ | ❌ |
| Gestionar miembros | ✅ | ✅* | ❌ |
| Ver todos los equipos | ✅ | ❌ | ❌ |

*Solo los del propio equipo.

---

## Atajos y consejos

- **Zoom en el Gantt**: Usa los botones `−` y `+` de la barra de herramientas para ajustar la escala.
- **Subtareas**: Al crear una tarea, selecciona una tarea padre para crear jerarquía visual.
- **Colores**: Usa colores distintos para diferenciar fases o responsables.
- **Progreso**: Actualiza el % de progreso regularmente; se refleja como relleno en la barra del Gantt.
- **Estado**: Marcar como "Completado" cuando la tarea esté lista al 100%.
