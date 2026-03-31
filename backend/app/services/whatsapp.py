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

    response = requests.post(url, headers=headers, json=payload)

    return response.json()