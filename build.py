#!/usr/bin/env python3
"""Concatena los módulos ES en un solo js/app.js sin import/export.

Mismo patrón que Mis cosas/MIS APPS/build.py (ver ese archivo para la
explicación completa de por qué existe: file:// bloquea <script
type="module">). Los archivos fuente se quedan como ES modules de verdad
para que `node --test` los siga importando.

Uso: python build.py   (correr después de tocar cualquier archivo de js/)
"""
import hashlib
import re
import pathlib
import sys

ARCHIVOS_SHELL_SW = ['index.html', 'css/estilos.css', 'js/app.js', 'manifest.json']

RAIZ = pathlib.Path(__file__).parent

PAQUETES = {
    'taqueria': {
        'salida': 'js/app.js',
        'archivos': [
            'js/dinero.js', 'js/cambio.js', 'js/modelo.js', 'js/catalogo.js',
            'js/ticket.js', 'js/almacen.js', 'js/cronometro.js', 'js/ui.js',
        ],
    },
}


def _quitar_imports(texto: str) -> str:
    return re.sub(r'^import\s[\s\S]*?from\s+[\'"].*?[\'"];?\s*$\n?', '', texto, flags=re.MULTILINE)


def _rutas_importadas(texto: str) -> list[str]:
    return re.findall(r'^import\s[\s\S]*?from\s+[\'"](.*?)[\'"];?\s*$', texto, flags=re.MULTILINE)


# El empaquetador no entiende "import { x as y }" -- solo expone el nombre
# ORIGINAL exportado como global (`const x = modulo.x;`), nunca crea el
# alias `y`. Un import con alias se borra igual que cualquier otro
# (_quitar_imports) y el código que usa `y` revienta con "y is not defined"
# en tiempo de ejecución, sin ningún aviso al construir. Pasó de verdad
# (agregarProducto as agregarAlCarrito, taqueria, 2026-08-03) y no lo agarró
# ninguna prueba porque node --test corre los módulos fuente reales, donde
# el alias sí funciona -- solo se ve en el bundle.
def _validar_sin_alias(nombre: str, cfg: dict) -> None:
    for ruta_rel in cfg['archivos']:
        ruta = RAIZ / ruta_rel
        for linea in re.findall(r'^import\s[\s\S]*?from\s+[\'"].*?[\'"];?\s*$', ruta.read_text(encoding='utf-8'), flags=re.MULTILINE):
            if re.search(r'\bas\b', linea):
                sys.exit(f'ERROR [{nombre}]: {ruta_rel} tiene un import con alias ("as") -- '
                          f'el bundle solo expone el nombre original como global, el alias queda indefinido:\n  {linea.strip()}')


# Sin esto, un import a un archivo que no está en la lista de `archivos` del
# paquete se borra en silencio (_quitar_imports) y el nombre queda indefinido
# en tiempo de ejecución -- justo el bug que dejó Face ID muerto sin ningún
# error visible en MIS APPS. Revisa ANTES de generar nada.
def _validar_imports(nombre: str, cfg: dict) -> None:
    incluidos = {(RAIZ / r).resolve() for r in cfg['archivos']}
    for ruta_rel in cfg['archivos']:
        ruta = RAIZ / ruta_rel
        for importado in _rutas_importadas(ruta.read_text(encoding='utf-8')):
            resuelto = (ruta.parent / importado).resolve()
            if resuelto not in incluidos:
                sys.exit(f'ERROR [{nombre}]: {ruta_rel} hace "import ... from \'{importado}\'" '
                         f'pero ese archivo no está en PAQUETES["{nombre}"]["archivos"] -- '
                         f'agrégalo o el import se va a borrar en silencio y quedará indefinido.')


# Cada archivo CON exports se envuelve como `const <nombre_del_archivo> =
# (function(){...})();` a nivel global del bundle. Si el archivo SIN exports
# (el punto de entrada, ej. ui.js) declara a nivel superior un `let`/`const`/
# `function` con ese mismo nombre, es una redeclaración -- SyntaxError, el
# bundle entero no corre. Pasó de verdad con `catalogo` (taqueria,
# 2026-08-03): catalogo.js se envolvía en `const catalogo = ...` y ui.js
# tenía `let catalogo = obtenerCatalogo();` al nivel superior. Sin consola
# abierta a la mano, esto se ve exactamente igual que "la app no hace nada".
def _validar_colision_con_nombres_de_archivo(nombre: str, cfg: dict) -> None:
    stems = {pathlib.Path(r).stem for r in cfg['archivos']}
    for ruta_rel in cfg['archivos']:
        ruta = RAIZ / ruta_rel
        crudo = ruta.read_text(encoding='utf-8')
        if _nombres_exportados(crudo):
            continue  # este archivo SÍ se envuelve en IIFE -- sus propios top-level no chocan con nada externo
        declarados = re.findall(r'^(?:let|const|var)\s+([A-Za-z0-9_]+)', crudo, flags=re.MULTILINE)
        declarados += re.findall(r'^(?:async\s+)?function\s+([A-Za-z0-9_]+)', crudo, flags=re.MULTILINE)
        for nombre_var in declarados:
            if nombre_var in stems:
                sys.exit(f'ERROR [{nombre}]: {ruta_rel} declara "{nombre_var}" a nivel superior, '
                          f'pero ese es el nombre de variable que build.py ya usa para envolver '
                          f'{nombre_var}.js -- renombra una de las dos cosas.')


def _nombres_exportados(texto: str) -> list[str]:
    return re.findall(r'^export\s+(?:async\s+function|function|const|class)\s+([A-Za-z0-9_]+)', texto, flags=re.MULTILINE)


def _quitar_prefijo_export(texto: str) -> str:
    return re.sub(r'^export\s+(function|const|async function|class)\s', r'\1 ', texto, flags=re.MULTILINE)


def construir_paquete(nombre: str, cfg: dict) -> None:
    _validar_imports(nombre, cfg)
    _validar_sin_alias(nombre, cfg)
    _validar_colision_con_nombres_de_archivo(nombre, cfg)
    vistos: dict[str, str] = {}
    partes = [f'// ARCHIVO GENERADO por build.py (paquete "{nombre}") -- no editar a mano.\n'
              '// Edita los archivos fuente y vuelve a correr: python build.py\n']

    for ruta_rel in cfg['archivos']:
        ruta = RAIZ / ruta_rel
        crudo = ruta.read_text(encoding='utf-8')
        exportados = _nombres_exportados(crudo)
        for n in exportados:
            if n in vistos:
                sys.exit(f'ERROR [{nombre}]: "{n}" se exporta en {vistos[n]} Y en {ruta_rel} -- '
                         f'chocarían como globales. Renombra uno de los dos antes de empaquetar.')
            vistos[n] = ruta_rel

        cuerpo = _quitar_prefijo_export(_quitar_imports(crudo))
        var = pathlib.Path(ruta_rel).stem
        partes.append(f'\n// ── {ruta_rel} ──────────────────────────────────────────\n')
        if exportados:
            partes.append(f'const {var} = (function () {{\n{cuerpo}\n'
                          f'  return {{ {", ".join(exportados)} }};\n}})();\n')
            for n in exportados:
                partes.append(f'const {n} = {var}.{n};\n')
        else:
            partes.append(cuerpo)  # ui.js: nada exportado, es el punto de entrada

    salida = RAIZ / cfg['salida']
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(''.join(partes), encoding='utf-8')
    print(f'OK [{nombre}] -> {cfg["salida"]} ({salida.stat().st_size} bytes)')


# El navegador solo revisa un service worker "nuevo" byte por byte contra el
# que ya tiene -- si sw.js no cambia, nunca lo reactiva, y el CACHE viejo se
# queda sirviendo para siempre aunque index.html/css/js sí hayan cambiado.
# En vez de pedirle a alguien que suba un número a mano cada vez (así lo
# hace MIS APPS, y ya se le ha olvidado más de una vez -- ver
# CLAUDE.md/memoria), el nombre del CACHE se deriva de un hash del shell:
# cualquier cambio real en index.html/css/js/manifest cambia el hash, sw.js
# cambia de contenido, el navegador lo nota solo.
def _actualizar_version_cache_sw() -> None:
    h = hashlib.sha256()
    for ruta_rel in ARCHIVOS_SHELL_SW:
        h.update((RAIZ / ruta_rel).read_bytes())
    version = h.hexdigest()[:10]
    sw_path = RAIZ / 'sw.js'
    original = sw_path.read_text(encoding='utf-8')
    nuevo, n = re.subn(r"const CACHE = 'taqueria-[^']*';", f"const CACHE = 'taqueria-{version}';", original)
    if n == 0:
        sys.exit('ERROR: no encontré "const CACHE = \'taqueria-...\';" en sw.js -- '
                 'revisa que no se haya renombrado esa línea.')
    if nuevo != original:
        sw_path.write_text(nuevo, encoding='utf-8')
        print(f'OK [sw.js] CACHE -> taqueria-{version}')
    else:
        print(f'OK [sw.js] CACHE ya estaba al día (taqueria-{version})')


def main():
    for nombre, cfg in PAQUETES.items():
        construir_paquete(nombre, cfg)
    _actualizar_version_cache_sw()  # tiene que ir AL FINAL: depende de js/app.js ya escrito


if __name__ == '__main__':
    main()
