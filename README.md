# nitida | SEO + GEO

Ferramenta interna para criar perfis editoriais de sites e otimizar conteudo para busca tradicional e engines generativas.

## Rodar localmente

```bash
cp .env.example .env.local
# preencha DATABASE_URL, DIRECT_URL e GEMINI_API_KEY
npm install
npm run db:generate
npm run db:push
npm run dev -- --port 3007
```

Abra `http://localhost:3007`. Como ainda nao existe nenhum usuario, a tela de login mostra "Crie a conta de administrador" — essa primeira conta vira admin e pode cadastrar as demais em Usuarios. O scan e a geracao retornam erro controlado enquanto nenhum provedor de IA estiver configurado (nem via env, nem via tela).

`GEMINI_API_KEY`/`GEMINI_MODEL` sao só o fallback inicial (usado enquanto nenhum admin configurou nada pela tela). `GEMINI_API_KEY` e gerada em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Autenticacao

Contas sao individuais (nome, e-mail, senha), sem cadastro publico — so um admin cria novos acessos, pela tela Usuarios. Sessoes ficam no banco (tabela `sessions`) e expiram em 14 dias. Nao ha mais senha unica compartilhada (`APP_PASSWORD` foi removida).

## Provedor de IA

Qualquer admin pode trocar o provedor e a chave usados no scan e na geracao de conteudo, pela tela "Modelo de IA" — sem precisar mexer em variavel de ambiente ou redeploy. Suporta Google Gemini, OpenAI (ChatGPT), Anthropic (Claude) e Groq (Llama e outros, via API compativel com OpenAI). A configuracao fica na tabela `ai_settings` (chave sempre mascarada na tela, visivel so pra admins). Logica de despacho por provedor em [`src/lib/ai-provider.ts`](src/lib/ai-provider.ts).

## API

- `GET /api/sites` lista sites.
- `POST /api/sites` cria um site.
- `GET|PUT /api/sites/:id` consulta ou atualiza um perfil.
- `POST /api/sites/:id/scan` respeita `robots.txt`, le sitemap, extrai HTML com Cheerio e gera o perfil com o provedor de IA configurado.
- `POST /api/gerar-conteudo` recebe `multipart/form-data` com `site_id`, `texto` e imagens opcionais.
- `GET /api/geracoes?site_id=` consulta o historico.
- `GET /api/auth/status`, `POST /api/auth/setup` (so quando nao ha nenhum usuario), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- `GET|POST /api/users`, `PUT|DELETE /api/users/:id` — gestao de usuarios, restrita a admins.
- `GET|PUT /api/settings/ai` — provedor/modelo/chave de IA, restrita a admins.

## Deploy

Na Vercel, configure `DATABASE_URL`, `DIRECT_URL` e (opcional, so como fallback) `GEMINI_API_KEY`/`GEMINI_MODEL`. Execute `npm run db:push` uma vez contra o banco Postgres de producao antes do primeiro uso. Depois do primeiro deploy, acesse a URL publicada para criar a conta de administrador e, se quiser, trocar o provedor de IA pela tela.

O modelo de dados esta em [`prisma/schema.prisma`](prisma/schema.prisma).
