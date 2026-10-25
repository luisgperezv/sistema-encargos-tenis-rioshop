"""
Preparación de imágenes para WhatsApp Cloud API.

Flujo real verificado: las plantillas envían la imagen como URL pública
(`header.parameters[].image.link`). Meta descarga esa URL de forma asíncrona y
rechaza (código 131053) archivos > 5 MB. Por eso:

1. La foto original en Cloudinary NUNCA se modifica ni se reemplaza.
2. Se construye una URL derivada con transformaciones de Cloudinary
   (escalado proporcional `c_limit`, sin recorte, JPEG).
3. Se descarga la versión derivada en streaming y se cuentan los bytes reales
   (no se confía en Content-Length). Si excede el límite seguro se prueba un
   nivel de optimización más agresivo.
"""

import re
import requests

# Límite de Meta para imágenes: 5 MB. Usamos margen de seguridad (~4.5 MB).
LIMITE_META_BYTES = 5 * 1024 * 1024
LIMITE_SEGURO_BYTES = int(4.5 * 1024 * 1024)
TIPOS_PERMITIDOS = ("image/jpeg", "image/png")
TIMEOUT_SEGUNDOS = 15

# Niveles de optimización, de mayor a menor calidad. c_limit = nunca recorta ni amplía.
NIVELES_TRANSFORMACION = [
    "c_limit,w_1600,h_1600,q_auto:good,f_jpg",
    "c_limit,w_1280,h_1280,q_75,f_jpg",
    "c_limit,w_1024,h_1024,q_65,f_jpg",
]

_PATRON_CLOUDINARY = re.compile(
    r"^(https?://res\.cloudinary\.com/[^/]+/image/upload/)(.+)$", re.IGNORECASE
)


class ErrorImagenWhatsapp(Exception):
    pass


def es_url_cloudinary(url: str) -> bool:
    return bool(url and _PATRON_CLOUDINARY.match(url.strip()))


def construir_url_transformada(url_original: str, transformacion: str) -> str:
    """Inserta la transformación justo después de /image/upload/ sin tocar el resto."""
    m = _PATRON_CLOUDINARY.match(url_original.strip())
    if not m:
        raise ErrorImagenWhatsapp("La URL no pertenece a Cloudinary")
    return f"{m.group(1)}{transformacion}/{m.group(2)}"


def medir_imagen_remota(url: str, limite: int = LIMITE_SEGURO_BYTES) -> tuple[int, str]:
    """
    Descarga en streaming y cuenta los bytes reales. Corta la descarga en cuanto
    supera el límite (no descarga archivos enormes completos).
    Retorna (bytes, content_type). Lanza ErrorImagenWhatsapp si no es válida.
    """
    try:
        with requests.get(url, stream=True, timeout=TIMEOUT_SEGUNDOS) as resp:
            if resp.status_code != 200:
                raise ErrorImagenWhatsapp(f"HTTP {resp.status_code} al obtener la imagen")
            content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if content_type not in TIPOS_PERMITIDOS:
                raise ErrorImagenWhatsapp(f"Tipo de contenido no soportado por WhatsApp: {content_type or 'desconocido'}")
            total = 0
            for chunk in resp.iter_content(chunk_size=64 * 1024):
                if not chunk:
                    continue
                total += len(chunk)
                if total > limite:
                    raise ErrorImagenWhatsapp(f"La imagen supera el límite seguro ({total} bytes leídos)")
            if total == 0:
                raise ErrorImagenWhatsapp("La imagen está vacía")
            return total, content_type
    except requests.RequestException as e:
        raise ErrorImagenWhatsapp(f"Error de red al verificar la imagen: {type(e).__name__}")


def preparar_imagen_whatsapp(url_original: str) -> dict:
    """
    Retorna {"url": url_para_whatsapp, "bytes": n, "transformacion": str|None}.
    Lanza ErrorImagenWhatsapp si no se logra una versión válida.
    """
    if not url_original or not str(url_original).strip():
        raise ErrorImagenWhatsapp("No hay imagen para enviar")
    url_original = str(url_original).strip()

    if not es_url_cloudinary(url_original):
        # Compatibilidad con fotos antiguas fuera de Cloudinary: solo validar.
        n, _ = medir_imagen_remota(url_original)
        return {"url": url_original, "bytes": n, "transformacion": None}

    ultimo_error = None
    for transformacion in NIVELES_TRANSFORMACION:
        url = construir_url_transformada(url_original, transformacion)
        try:
            n, _ = medir_imagen_remota(url)
            return {"url": url, "bytes": n, "transformacion": transformacion}
        except ErrorImagenWhatsapp as e:
            ultimo_error = e
            print(f"[MEDIA_WA] Nivel '{transformacion}' no válido: {e}", flush=True)

    raise ErrorImagenWhatsapp(f"No se pudo generar una versión válida para WhatsApp: {ultimo_error}")
