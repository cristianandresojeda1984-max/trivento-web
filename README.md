# Trivento - Gestión Cultural (trivento-web)

Sitio estático + panel de administración (Decap CMS) para que una persona no técnica
pueda cargar **eventos** y **noticias** sin tocar código.

## Estructura

```
trivento-web/
├── index.html                 # Página principal (lee data/eventos.json y data/noticias.json)
├── netlify.toml                # Config de build/deploy de Netlify
├── admin/
│   ├── index.html              # Carga Decap CMS + Netlify Identity
│   └── config.yml              # Configuración del CMS (colecciones Eventos/Noticias)
├── content/
│   ├── eventos/*.md            # Cada evento cargado desde el CMS es un archivo acá
│   └── noticias/*.md           # Cada noticia cargada desde el CMS es un archivo acá
├── images/uploads/             # Imágenes subidas desde el CMS
├── scripts/build-content.js    # Genera data/*.json a partir de content/ en cada deploy
└── data/                       # Generado automáticamente en el build (no se versiona)
```

Cómo funciona el flujo de contenido: cuando el editor guarda un evento/noticia en `/admin`,
Decap CMS hace un commit a GitHub → Netlify detecta el commit y dispara un build → el build
corre `scripts/build-content.js`, que arma `data/eventos.json` y `data/noticias.json` →
`index.html` los lee con `fetch()` y pinta las tarjetas. Por eso cada publicación se refleja
sola, sin que nadie edite HTML a mano.

## 1. Crear el repositorio en GitHub

No tengo acceso directo a tu cuenta de GitHub desde acá, así que este paso lo hacés vos
(2 minutos):

1. Entrá a https://github.com/new
2. Nombre del repositorio: `trivento-web`
3. Dejalo **público o privado**, como prefieras (ambos funcionan con Netlify) — sin
   agregar README, .gitignore ni licencia (ya vienen en el ZIP).
4. Creá el repo, y luego subí este proyecto:

```bash
cd trivento-web
git init
git add .
git commit -m "Sitio inicial Trivento Gestión Cultural + panel Decap CMS"
git branch -M main
git remote add origin https://github.com/<TU_USUARIO>/trivento-web.git
git push -u origin main
```

## 2. Conectar el repositorio con Netlify (CI/CD)

1. Entrá a https://app.netlify.com y logueate con tu cuenta.
2. **Add new site → Import an existing project**.
3. Elegí **GitHub**, autorizá el acceso si te lo pide, y seleccioná el repositorio `trivento-web`.
4. Netlify va a detectar automáticamente `netlify.toml` (build command `node scripts/build-content.js`,
   publish directory `.`). Confirmá y desplegá.
5. A partir de acá, **cada commit a `main`** (incluidos los que hace Decap CMS al guardar
   contenido) dispara un deploy automático.

## 3. Activar Netlify Identity

1. En el panel del sitio: **Site configuration → Identity**.
2. Hacé clic en **Enable Identity**.
3. En **Registration preference**, elegí **Invite only** (así solo entra quien vos invites).

## 4. Habilitar Git Gateway

1. Dentro de **Identity → Services**, buscá **Git Gateway** y hacé clic en **Enable Git Gateway**.
   Esto le permite a Decap CMS hacer commits al repo en nombre del editor, sin que esa
   persona necesite (ni vea) credenciales de GitHub.

> **Nota importante:** Netlify marcó Git Gateway como *deprecado* (ya no recibe desarrollo activo),
> aunque a la fecha sigue funcionando y es la forma más simple de dar acceso a alguien sin
> cuenta de GitHub. Si en el futuro Netlify lo da de baja definitivamente, la alternativa es
> cambiar `admin/config.yml` a un backend `github` con OAuth (requiere que el editor tenga
> cuenta de GitHub, o un proxy de OAuth como DecapBridge). Te aviso esto para que no te agarre
> de sorpresa, pero hoy el enfoque que pediste funciona correctamente.

## 5. Invitar a la persona que va a administrar el sitio

1. En **Identity**, pestaña de usuarios, hacé clic en **Invite users**.
2. Cargá su email y enviá la invitación.
3. Esa persona va a recibir un mail con un link para poner su contraseña.
4. Una vez que la configure, puede entrar en cualquier momento a:

   **`https://<tu-sitio>.netlify.app/admin`** (o `midominio.com.ar/admin` si ya conectaste tu dominio propio)

   ahí ve dos colecciones — **Eventos** y **Noticias** — con botón "New Eventos" / "New Noticias",
   campos de título, fecha, imagen de portada y cuerpo/descripción, y botón para publicar.

## Personalización

- Colores, textos de portada y estilos: editar el `<style>` y el `<header class="hero">` en `index.html`.
- Si querés un dominio propio (`midominio.com.ar`): **Site configuration → Domain management → Add a domain**,
  y seguís las instrucciones de DNS que te da Netlify.
