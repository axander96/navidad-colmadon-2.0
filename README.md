# Navidad Colmadon 2.0

Aplicación para organizar los sorteos privados de Angelito y Plato Navideño con React/Vite en GitHub Pages y Cloudflare Workers + D1.

## Desarrollo local

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm run dev
```

La interfaz requiere `VITE_API_URL` apuntando al Worker para validar códigos reales. No se incluyen participantes ni platos ficticios.

## Cloudflare Worker y D1

1. Instala Wrangler dentro de `worker` e inicia sesión con `npx wrangler login`.
2. Crea la base: `npx wrangler d1 create navidad-colmadon-db`.
3. Sustituye `database_id` en `worker/wrangler.toml` por el identificador real.
4. Aplica la migración con `npm run db:migrate:remote` desde `worker`.
5. Configura los secretos directamente en Cloudflare:

```powershell
npx wrangler secret put CODE_PEPPER
npx wrangler secret put ADMIN_SETUP_KEY
```

6. Despliega con `npm run deploy`. El Worker publicado es `https://navidad-colmadon-api.alexanderrodriguezacevedo.workers.dev`. Configura esa URL como variable `VITE_API_URL` del entorno `github-pages` en GitHub Actions.

Los valores secretos no se guardan en Git ni en el frontend. La migración crea el evento, pero los 10 participantes y 10 platos deben registrarse desde el panel administrativo antes de publicar.

## Primer acceso del organizador

1. Si necesitas reemplazar la clave inicial, ejecuta desde `worker`:

```powershell
npx wrangler secret put ADMIN_SETUP_KEY
```

Wrangler solicitará la clave de forma interactiva; no la guardes en Git.

2. Abre la [aplicación publicada](https://axander96.github.io/navidad-colmadon-2.0/) y pulsa **Organizador**.
3. Pulsa **Configuración inicial** e introduce la clave, un usuario y una contraseña de al menos 12 caracteres.
4. Vuelve al formulario normal e inicia sesión. La configuración inicial solo funciona una vez.
5. Agrega exactamente 10 participantes y 10 platos. El código de cada participante se muestra solo al crearlo; cópialo o entrégalo en ese momento.
6. Cuando ambos contadores estén en `10/10`, pulsa **PUBLICAR EVENTO Y GENERAR SORTEOS**. Después de publicar no se permiten cambios.

El botón **REINICIAR SORTEO** solo aparece después de publicar. Reinicia los resultados y devuelve el evento a borrador, pero conserva todos los participantes, sus códigos y los platos. Requiere confirmación y luego debes volver a publicar para generar nuevas asignaciones.

## GitHub Pages

Activa Pages con la fuente **GitHub Actions**. El workflow `.github/workflows/deploy.yml` compila y publica `dist` en cada push a `main`.
