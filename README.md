# Roblox Badge History

Ferramenta de linha de comando feita em Node.js para consultar o histórico de emblemas de **qualquer conta Roblox** acessível pela Roblox Open Cloud. O programa pergunta no terminal qual conta deve ser consultada, mostra a data de criação do perfil, contabiliza os emblemas por ano e permite navegar pelos registros em ordem cronológica.

## Funcionalidades

- Aceita **nome de usuário** ou **ID numérico** informado durante a execução.
- Mostra o nome, o ID, o link do perfil e a **data de criação da conta**.
- Consulta todas as páginas de emblemas retornadas pela API.
- Exibe a quantidade total de emblemas e quantos têm data de concessão acessível.
- Agrupa os emblemas por ano, por exemplo:
  ```text
  Emblemas em 2020: 10
  Emblemas em 2021: 18
  Emblemas em 2022: 7
  ```
- Abre um menu interativo para listar todos os emblemas do mais recente para o mais antigo, do mais antigo para o mais recente ou filtrar um ano específico.
- Diferencia datas confirmadas de datas indisponíveis; não inventa datas para registros incompletos.
- Salva relatórios em JSON e CSV na pasta `output/`.

## Requisitos

- Node.js 20 ou superior.
- Uma chave da Roblox Open Cloud com permissão **Inventory: Read**.
- Acesso ao terminal e à internet.

## 1. Criar uma chave da API

1. Acesse o [painel de credenciais Roblox](https://create.roblox.com/dashboard/credentials).
2. Crie uma API key.
3. Configure a permissão **Inventory** com acesso **Read**.
4. Restrinja a chave conforme as opções disponíveis e mantenha-a privada.

**Segurança:** não compartilhe sua chave e nunca a publique no GitHub. Se uma chave real for enviada ao repositório por engano, revogue-a e crie outra.

## 2. Configurar a chave no código

Abra o arquivo `src/index.js` e localize esta linha no início do arquivo:

```js
const API_KEY = "COLE_SUA_CHAVE_AQUI";
```

Substitua `COLE_SUA_CHAVE_AQUI` pela sua chave Roblox Open Cloud. Mantenha as aspas. **Não faça commit nem envie o arquivo com sua chave real para um repositório público.** Para uso pessoal, uma alternativa mais segura é carregar a chave de uma variável de ambiente, em vez de gravá-la no código.

## 3. Instalar e executar

Clone ou baixe este repositório e, no terminal, entre na pasta do projeto:

```bash
git clone https://github.com/iagoalima/Roblox-Badge-History.git
cd Roblox-Badge-History
npm start
```

O programa solicitará o nome de usuário ou o ID da conta Roblox:

```text
Nome de usuário ou ID Roblox: impactoreal_lindo
```

Você pode digitar, por exemplo, `impactoreal_lindo` ou `1224165215`. Não é necessário editar o código para escolher a conta: a informação é preenchida diretamente no terminal.

## 4. Resumo e menu interativo

Depois da consulta, o programa mostra a data de criação da conta e o resumo do histórico, incluindo a quantidade total de emblemas, quantos têm data acessível e a quantidade por ano.

Em seguida, aparece um menu semelhante a este:

```text
========== CONSULTA DE EMBLEMAS ==========
1. Ver todos por ordem cronológica (mais recentes primeiro)
2. Ver emblemas de um ano específico
3. Listar do mais recente ao mais antigo
4. Listar do mais antigo ao mais recente
5. Encerrar
```

Escolha uma opção digitando o número correspondente. Ao selecionar um ano, são exibidos apenas os emblemas cuja data de concessão pôde ser confirmada naquele ano.

## 5. Relatórios exportados

O programa cria a pasta `output/` e salva:

- `NOME-badges.json`: relatório detalhado, com informações da conta, totais, contagens anuais e emblemas.
- `NOME-badges.csv`: tabela que pode ser aberta no Excel ou no Google Sheets.

Os registros incluem o nome e ID do emblema, URL, data de concessão quando disponível e o estado da data.

## Limitações e interpretação dos dados

- A Roblox Open Cloud respeita as permissões e as restrições de privacidade da plataforma. Se a API retornar `403`, o programa informa o bloqueio e **não tenta contorná-lo**.
- A contagem por ano inclui apenas emblemas cuja data de concessão foi retornada e pôde ser interpretada. Os registros sem data ficam contabilizados separadamente e não são atribuídos a um ano.
- A data de criação da conta vem da API de usuários do Roblox; a data de concessão do emblema vem dos dados de inventário retornados pela Open Cloud.
- A quantidade exibida é a quantidade de registros retornados pela API, não uma garantia de que a API exponha todos os emblemas de qualquer perfil.
- Datas são exibidas/agrupadas em UTC. Uma data indisponível **não significa** que não houve atividade.
- O relatório é um resumo técnico dos dados disponibilizados pelas APIs; isoladamente, não comprova quem utilizou uma conta ou por quanto tempo.

## Tecnologias

- Node.js (ES Modules)
- Roblox Users API
- Roblox Open Cloud Inventory API
- `fetch` nativo do Node.js — sem dependências externas
