#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import re
import shutil

sidebar = Path("src/app/layout/sidebar/sidebar.ts")
routes = Path("src/app/app.routes.ts")

if not sidebar.is_file() or not routes.is_file():
    raise SystemExit("ERRO: arquivos Angular não encontrados.")

s = sidebar.read_text(encoding="utf-8")
r = routes.read_text(encoding="utf-8")

# ==========================================
# 1. ATUALIZAR SIDEBAR
# ==========================================

start_marker = """    {
      label: 'ADMINISTRAÇÃO',"""

end_marker = """    {
      label: 'PORTAIS',"""

start = s.find(start_marker)
end = s.find(end_marker, start)

if start == -1 or end == -1:
    raise SystemExit(
        "ERRO: grupo Administração não encontrado. "
        "Nenhum arquivo foi alterado."
    )

old_section = s[start:end]

expected = {
    "Documentos e Prazos": "/documentos",
    "Central de Alertas": "/alertas",
    "Usuários e Permissões": "/administracao/usuarios",
    "Configurações Gerais": "/administracao/configuracoes",
}

found = re.findall(
    r"label:\s*'([^']+)'\s*,\s*route:\s*'([^']+)'",
    old_section
)

found_dict = dict(found)

if len(found) != len(found_dict):
    raise SystemExit(
        "ERRO: existem entradas administrativas duplicadas."
    )

for label, route in found:
    if label not in expected or expected[label] != route:
        raise SystemExit(
            f"ERRO: entrada administrativa inesperada: {label}. "
            "Nenhum arquivo foi alterado."
        )

for required in ["Documentos e Prazos", "Central de Alertas"]:
    if required not in found_dict:
        raise SystemExit(
            f"ERRO: módulo existente não encontrado: {required}"
        )

admin_menu = """    {
      label: 'ADMINISTRAÇÃO',
      items: [
        {
          label: 'Documentos e Prazos',
          route: '/documentos'
        },
        {
          label: 'Central de Alertas',
          route: '/alertas'
        },
        {
          label: 'Usuários e Permissões',
          route: '/administracao/usuarios'
        },
        {
          label: 'Configurações Gerais',
          route: '/administracao/configuracoes'
        }
      ]
    },

"""

new_sidebar = s[:start] + admin_menu + s[end:]

# ==========================================
# 2. ATUALIZAR ROTAS
# ==========================================

routes_start = """      /*
       * ADMINISTRAÇÃO
       */"""

routes_end = """      /*
       * PORTAL
       */"""

rs = r.find(routes_start)
re_ = r.find(routes_end, rs)

if rs == -1 or re_ == -1:
    raise SystemExit(
        "ERRO: seção Administração não encontrada nas rotas. "
        "Nenhum arquivo foi alterado."
    )

if "import { ComingSoon }" not in r:
    raise SystemExit(
        "ERRO: importação do componente ComingSoon não encontrada."
    )

all_paths = re.findall(
    r"path:\s*'([^']+)'",
    r
)

for required in ["documentos", "alertas"]:
    if required not in all_paths:
        raise SystemExit(
            f"ERRO: rota existente não encontrada: {required}"
        )

new_routes = [
    (
        "administracao/usuarios",
        "Usuários e Permissões"
    ),
    (
        "administracao/configuracoes",
        "Configurações Gerais"
    ),
]

additions = ""

for path, title in new_routes:
    if path not in all_paths:
        additions += f"""      {{
        path: '{path}',
        component: ComingSoon,
        title: '{title} | AgroFly'
      }},
"""

new_routes_content = (
    r[:re_] + additions + "\n" + r[re_:]
    if additions else r
)

# ==========================================
# 3. CRIAR BACKUPS E SALVAR
# ==========================================

timestamp = datetime.now().strftime(
    "%Y%m%d-%H%M%S-%f"
)

changes = [
    (sidebar, s, new_sidebar),
    (routes, r, new_routes_content)
]

# Criar todos os backups antes de alterar arquivos.
for path, original, updated in changes:
    if original != updated:
        backup = path.with_name(
            path.name + ".bak-" + timestamp
        )
        shutil.copy2(path, backup)
        print(f"Backup criado: {backup}")

for path, original, updated in changes:
    if original != updated:
        path.write_text(updated, encoding="utf-8")
        print(f"Atualizado: {path}")
    else:
        print(f"Sem alterações: {path}")

print("\nAdministração atualizada com sucesso!")
PY

echo
echo "Verificando compilação do Angular..."
npm run build
