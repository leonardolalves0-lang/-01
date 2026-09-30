# Painel financeiro – Água de Coco do João

Painel de controle financeiro (fechamento, dias da semana, pagamentos, custos, margem por produto, projeção e lançamentos), pronto para publicar na Vercel.

## O que vem na pasta

```
public/index.html   Painel completo (uma página só)
api/login.js        Confere usuário e senha no servidor e abre a sessão
api/logout.js       Encerra a sessão
api/session.js      Informa se a sessão ainda vale
api/data.js         Lê e grava os dados no banco (Upstash Redis)
api/_lib.js         Funções de apoio (banco, sessão, respostas)
api/_seed.js        Dados de partida (agosto/2026), gravados só no primeiro acesso
vercel.json         Configuração da Vercel e cabeçalhos de segurança
.env.example        Lista das variáveis de ambiente
```

Não há dependências para instalar nem etapa de build.

## Publicar na Vercel (passo a passo)

1. **Suba a pasta para um repositório** no GitHub (pode ser privado).
   Alternativa sem GitHub: instale a Vercel CLI e rode `vercel` dentro da pasta.
2. **Crie o projeto:** na Vercel, *Add New… › Project*, importe o repositório.
   Em *Framework Preset* escolha **Other**. Deixe Build Command e Install Command vazios.
3. **Conecte o banco de dados:** no projeto, abra **Storage › Create Database** (ou *Browse Marketplace*),
   escolha **Upstash for Redis** e conecte ao projeto. A Vercel cria sozinha as variáveis
   `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
4. **Defina o acesso:** em **Settings › Environment Variables**, crie:
   | Variável | Exemplo | Para que serve |
   |---|---|---|
   | `PAINEL_USUARIO` | `joao` | Usuário do login |
   | `PAINEL_SENHA` | uma senha forte | Senha do login |
   | `SESSION_SECRET` | texto aleatório de 32+ caracteres | Assina o cookie da sessão |

   Para gerar o `SESSION_SECRET`: `openssl rand -base64 48` (ou qualquer gerador de senhas com 48 caracteres).
5. **Faça um novo deploy** (*Deployments › Redeploy*) para as variáveis valerem.
6. Abra o endereço do projeto e entre com o usuário e a senha. No primeiro acesso, os dados de agosto/2026 são gravados no banco.

## Como funciona o acesso

- Usuário e senha são conferidos **no servidor**, nunca no navegador.
- Depois do login, o navegador recebe um cookie de sessão protegido (HttpOnly, Secure), válido por 12 horas.
- Sem sessão válida, a API não entrega nenhum dado.
- Após 8 tentativas erradas, o endereço de IP fica bloqueado por 15 minutos.
- **Trocar a senha:** altere `PAINEL_SENHA` na Vercel e faça um novo deploy.
- **Derrubar todas as sessões abertas:** troque o `SESSION_SECRET` e faça um novo deploy.

## Dados

- Ficam no Upstash Redis, nas chaves `coco:config` (cadastros) e `coco:meses` (um item por mês).
- **Backup:** em *Lançamentos › Exportar todos os meses* você baixa uma planilha completa. Ela pode ser importada de volta a qualquer momento.
- Os dados desta versão são **separados** do painel que está no Claude. A cópia inicial foi feita em 30/09/2026. Se lançar algo no painel do Claude depois disso, exporte a planilha de lá e importe aqui.

## Rodar no computador (opcional)

```
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

## Custos e plano

O painel usa pouco recurso e cabe nos planos gratuitos do Upstash. Na Vercel, o plano **Hobby** é para uso pessoal e não comercial. Para uso de uma empresa, os termos pedem o plano **Pro**. Confira as condições atuais em vercel.com/pricing antes de publicar.
