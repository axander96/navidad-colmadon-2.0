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

## GitHub Pages

Activa Pages con la fuente **GitHub Actions**. El workflow `.github/workflows/deploy.yml` compila y publica `dist` en cada push a `main`.
