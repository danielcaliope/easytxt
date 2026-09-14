# nitida | SEO + GEO

Ferramenta interna para criar perfis editoriais de sites e otimizar conteudo para busca tradicional e engines generativas.

## Rodar localmente

```bash
cp .env.example .env.local
# preencha DATABASE_URL, DIRECT_URL, GEMINI_API_KEY e APP_PASSWORD
npm install
npm run db:generate
npm run db:push
npm run dev -- --port 3007
```

Abra `http://localhost:3007`.

Sem `APP_PASSWORD`, o acesso fica aberto para desenvolvimento local. Em producao, configure a senha compartilhada. O scan e a geracao retornam erro controlado enquanto `GEMINI_API_KEY` nao estiver configurada.

`GEMINI_API_KEY` e gerada em [aistudio.google.com/apikey](https://aistudio.google.com/apikey). `GEMINI_MODEL` e opcional (padrao `gemini-flash-latest`).

## API

- `GET /api/sites` lista sites.
- `POST /api/sites` cria um site.
- `GET|PUT /api/sites/:id` consulta ou atualiza um perfil.
- `POST /api/sites/:id/scan` respeita `robots.txt`, le sitemap, extrai HTML com Cheerio e gera o perfil com Gemini.
- `POST /api/gerar-conteudo` recebe `multipart/form-data` com `site_id`, `texto` e imagens opcionais.
- `GET /api/geracoes?site_id=` consulta o historico.

## Deploy

Na Vercel, configure `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL` opcional e `APP_PASSWORD`. Execute `npm run db:push` uma vez contra o banco Postgres de producao antes do primeiro uso.

O modelo de dados esta em [`prisma/schema.prisma`](prisma/schema.prisma).
