"""
Configuração do projeto.
---------------------------------------------------------------
As variáveis NÃO sensíveis ficam definidas aqui. As variáveis
SENSÍVEIS (API key, e-mail da conta, ID de planilha) ficam no
arquivo .env na raiz do projeto e são carregadas automaticamente
por este módulo.
"""

import os

# ----------------------------------------------------------------------
# Carregamento do .env (sem dependências externas)
# ----------------------------------------------------------------------

def carregar_env(caminho=".env"):
    """Lê o arquivo .env e injeta as variáveis no ambiente (sem sobrescrever)."""
    if not os.path.exists(caminho):
        return
    with open(caminho, "r", encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, _, valor = linha.partition("=")
            chave = chave.strip()
            valor = valor.strip().strip('"').strip("'")
            os.environ.setdefault(chave, valor)


carregar_env()

# ----------------------------------------------------------------------
# Variáveis sensíveis (vêm do .env)
# ----------------------------------------------------------------------

API_KEY = os.environ.get("API_KEY", "")

# só usados se MODO_SAIDA = "sheets"
SERVICE_ACCOUNT_FILE = os.environ.get("SERVICE_ACCOUNT_FILE", "service_account.json")
MEU_EMAIL = os.environ.get("MEU_EMAIL", "seu_email@exemplo.com")
PLANILHA_ID = os.environ.get("PLANILHA_ID", "")

# ----------------------------------------------------------------------
# Variáveis não sensíveis
# ----------------------------------------------------------------------

RESULTADOS_POR_BUSCA = 30
DELAY_ENTRE_REQUISICOES = 0.5  # segundos, educado com a API e com os sites
TIMEOUT_SITE = 10

MAPS_BUSCAS = [
    {"query": "empresas da área de saúde em Patos PB", "tipo_negocio": "Saúde"},
]

IDS_CACHE_ARQUIVO = "ids_coletados.json"  # controla o que já foi coletado antes

# --- saída ---
MODO_SAIDA = "excel"  # "excel" ou "sheets"

ARQUIVO_EXCEL = "leads_maps.xlsx"
PLANILHA_NOME = "Leads Prospecção"

CAMPOS = ["nome", "telefone_whatsapp", "email", "tipo_negocio", "possui_site", "site", "link_origem", "fonte"]