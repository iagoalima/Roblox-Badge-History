# Verificador de histórico de emblemas Roblox

Script de linha de comando em Node.js que consulta o inventário de emblemas via Roblox Open Cloud, percorre todas as páginas retornadas e exporta os resultados ordenados por data de concessão, do mais recente para o mais antigo.

Conta inicial configurada: `impactoreal_lindo` — ID `1224165215`.

## Requisitos

- Node.js 20 ou superior (Node.js 24 também funciona).
- Uma chave Roblox Open Cloud com permissão de leitura de inventário.

## 1. Criar a chave de API

1. Acesse https://create.roblox.com/dashboard/credentials
2. Crie uma API key.
3. Nas permissões, adicione **Inventory** com acesso **Read**.
4. Restrinja a chave conforme as opções disponíveis e mantenha-a privada.
5. Não envie a chave para ninguém e não a publique no GitHub.

## 2. Configurar a chave

Copie `.env.example` para `.env` e preencha `ROBLOX_API_KEY`. O script não carrega arquivos `.env` automaticamente; para evitar dependências, passe a variável ao executar.

### Windows PowerShell

```powershell
$env:ROBLOX_API_KEY="SUA_CHAVE_AQUI"
npm start
```

### Windows CMD

```cmd
set ROBLOX_API_KEY=SUA_CHAVE_AQUI
npm start
```

### Linux / macOS

```bash
export ROBLOX_API_KEY="SUA_CHAVE_AQUI"
npm start
```

## 3. Executar

A conta configurada por padrão:

```bash
npm start
```

Outro nome de usuário:

```bash
npm start -- nomeDoJogador
```

Outro ID numérico:

```bash
npm start -- 123456789
```

## 4. Arquivos gerados

O script cria a pasta `output/` com:

- `*-badges.json`: relatório detalhado.
- `*-badges.csv`: planilha que pode ser aberta no Excel ou Google Sheets.

As datas são normalizadas em UTC. O script conta separadamente emblemas com data confirmada e emblemas sem data acessível.

## Limitações importantes

- A API Open Cloud respeita as permissões e a privacidade do Roblox. Se a consulta retornar `403`, o script não tenta contornar o bloqueio.
- O endpoint pode retornar apenas os emblemas que a API disponibiliza para aquele inventário.
- A data usada é `addTime`, campo que a API de inventário documenta como o momento em que o item foi adicionado ao inventário; para emblemas, isso corresponde ao momento em que foram concedidos.
- Se a API não retornar uma data, o script marca como `unavailable`; não usa a data de criação do emblema como substituta.
- O resultado é evidência técnica de registros retornados pela API, não uma conclusão automática sobre quem usou a conta ou por quanto tempo.
