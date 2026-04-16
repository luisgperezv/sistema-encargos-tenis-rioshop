import requests
from app.core.config import settings


def obtener_url_whatsapp() -> str:
    return f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"


def obtener_headers_whatsapp() -> dict:
    return {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }


def normalizar_numero_whatsapp(numero: str) -> str:
    numero = numero.strip()
    numero = (
        numero.replace(" ", "")
        .replace("-", "")
        .replace("(", "")
        .replace(")", "")
        .replace("+", "")
    )

    if numero.startswith("57"):
        return numero

    return f"57{numero}"


def enviar_mensaje_texto(numero: str, mensaje: str):
    url = obtener_url_whatsapp()
    headers = obtener_headers_whatsapp()
    numero_formateado = normalizar_numero_whatsapp(numero)

    payload = {
        "messaging_product": "whatsapp",
        "to": numero_formateado,
        "type": "text",
        "text": {
            "body": mensaje
        }
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    return response.json()


def enviar_template_confirmacion_encargo(
    numero: str,
    nombre: str,
    referencia: str,
    talla_col: str,
    talla_eur: str,
    precio: str,
    abono: str,
    saldo: str,
    fecha_estimada: str
):
    url = obtener_url_whatsapp()
    headers = obtener_headers_whatsapp()
    numero_formateado = normalizar_numero_whatsapp(numero)

    payload = {
        "messaging_product": "whatsapp",
        "to": numero_formateado,
        "type": "template",
        "template": {
            "name": "confirmacion_encargo",
            "language": {
                "code": "es"
            },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nombre},
                        {"type": "text", "text": referencia},
                        {"type": "text", "text": talla_col},
                        {"type": "text", "text": talla_eur},
                        {"type": "text", "text": precio},
                        {"type": "text", "text": abono},
                        {"type": "text", "text": saldo},
                        {"type": "text", "text": fecha_estimada},
                    ]
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    return response.json()


def enviar_imagen_whatsapp(numero: str, image_url: str, caption: str | None = None):
    url = obtener_url_whatsapp()
    headers = obtener_headers_whatsapp()
    numero_formateado = normalizar_numero_whatsapp(numero)

    payload = {
        "messaging_product": "whatsapp",
        "to": numero_formateado,
        "type": "image",
        "image": {
            "link": image_url
        }
    }

    if caption:
        payload["image"]["caption"] = caption

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    return response.json()


def enviar_imagen_proveedor(numero: str, image_url: str, talla_eur: str):
    caption = f"Talla EUR: {talla_eur}"
    return enviar_imagen_whatsapp(numero, image_url, caption)