# WebScraping — Coleta de Leads via Google Maps (Places API)

## Visão Geral

Projeto de web scraping que coleta informações de clientes/empresas a partir da
**Google Places API (New)**. Os leads são enriquecidos com dados extraídos do
site de cada empresa e salvos em **Excel (.xlsx)** ou **Google Sheets**,
conforme configuração.

## Arquivos do Projeto

| Arquivo | Descrição |
| --- | --- |
| `collector_maps.py` | Script principal: coleta, enriquece e exporta os leads. |
| `config.py` | Configuração não sensível (buscas, delays, colunas, modo de saída, etc.). |
| `.env` | Configuração sensível (API key, e-mail, ID da planilha). **Não commitar.** |
| `leads_maps.xlsx` | Arquivo de saída gerado pelo modo Excel (quando configurado). |
| `leads_maps.csv` | Exportação anterior em CSV (formato antigo). |
| `ids_coletados.json` | Cache de place IDs já processados (gerado na execução). |
| `service_account.json` | Credenciais da Service Account (modo Google Sheets). **Não commitar.** |
| `.gitignore` | Ignora arquivos sensíveis, cache e dados de saída. |

## Colunas dos Leads

| Coluna | Descrição |
| --- | --- |
| `nome` | Nome do estabelecimento. |
| `telefone_whatsapp` | Número do WhatsApp (prioridade), telefone nacional ou telefone encontrado no site. |
| `email` | E-mail extraído do site da empresa. |
| `tipo_negocio` | Segmento/ramo de atuação (ex.: Odontologia, Contabilidade). |
| `possui_site` | "Sim" ou "Não" — indica se a empresa tem site. |
| `site` | URL do site da empresa. |
| `link_origem` | Link do Google Maps (googleMapsUri). |
| `fonte` | Fonte de origem do lead (sempre "Google Maps"). |

## Como Funciona

1. **Busca** — para cada query configurada em `MAPS_BUSCAS`, chama o endpoint
   `places:searchText` da Places API e obtém uma lista de lugares.
2. **Cache de IDs** — place IDs já coletados em execuções anteriores são
   ignorados (lê/grava `ids_coletados.json`), economizando chamadas de API.
3. **Detalhes** — para cada lugar novo, chama o endpoint de detalhes do lugar
   (`places/{place_id}`) para obter nome, telefone nacional, site e link do Maps.
4. **Enriquecimento** — se a empresa tem site, o script visita a página e tenta
   extrair e-mail, link de WhatsApp e telefone via regex. Respeita o
   `robots.txt` de cada site e usa delay entre requisições.
5. **Telefone** — usa, em ordem de prioridade: WhatsApp do site → telefone
   nacional da API → telefone do site.
6. **Saída** — salva os leads novos em Excel (`.xlsx`) ou Google Sheets.

## Configuração

### Instalação

```bash
pip install requests openpyxl
```

Para o modo Google Sheets (`MODO_SAIDA = "sheets"`):

```bash
pip install gspread google-auth
```

### Google Places API

- Habilite a API: `https://console.cloud.google.com/apis/library/places-backend.googleapis.com`
- Gere uma **API_KEY** e defina-a no arquivo `.env` (`API_KEY=...`).

### Google Sheets (apenas se usar esse modo)

1. Ative as APIs Sheets e Drive no mesmo projeto do Google Cloud.
2. Crie uma **Service Account** em *IAM e administrador > Contas de serviço* e
   gere uma chave JSON (baixe o arquivo).
3. Aponte `SERVICE_ACCOUNT_FILE` para o caminho do `.json` (no `.env`).
4. Preencha `MEU_EMAIL` com seu e-mail (no `.env`) — sem isso a planilha fica
   visível só para a service account.
5. Deixe `PLANILHA_ID` em branco na 1ª execução: o script cria a planilha,
   compartilha com você e imprime o ID no console. Copie esse ID para
   `PLANILHA_ID` no `.env` nas próximas execuções para continuar na mesma planilha.

### Parâmetros principais

**`config.py` (não sensíveis):**

| Parâmetro | Descrição |
| --- | --- |
| `RESULTADOS_POR_BUSCA` | Nº máximo de resultados por query. |
| `DELAY_ENTRE_REQUISICOES` | Delay (s) entre requisições. |
| `TIMEOUT_SITE` | Timeout (s) ao visitar sites das empresas. |
| `MAPS_BUSCAS` | Lista de buscas: `{"query": ..., "tipo_negocio": ...}`. |
| `MODO_SAIDA` | `"excel"` ou `"sheets"`. |
| `ARQUIVO_EXCEL` | Nome do arquivo `.xlsx` de saída. |
| `CAMPOS` | Colunas exportadas. |

**`.env` (sensíveis):**

| Variável | Descrição |
| --- | --- |
| `API_KEY` | Chave da Google Places API. |
| `SERVICE_ACCOUNT_FILE` | Caminho do JSON da Service Account (modo sheets). |
| `MEU_EMAIL` | E-mail que recebe acesso à planilha (modo sheets). |
| `PLANILHA_ID` | ID da planilha Google Sheets (deixe vazio na 1ª execução). |

## Avisos Importantes

- **Cota da API**: a Places API tem cota gratuita mensal e cobra por chamada
  depois disso — considere limitar a cota diária no Google Cloud Console.
- **robots.txt**: ao enriquecer, o script respeita o `robots.txt` de cada site
  e usa delay entre requisições.
- **LGPD**: mesmo em prospecção B2B, guarde a base legal do tratamento
  (legítimo interesse costuma ser a mais usada), ofereça opção de descadastro
  no primeiro contato, e para ligações/SMS consulte a lista "Não Me Perturbe"
  (`naomeperturbe.com.br`) antes de discar.