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


def enviar_template_confirmacion_encargo_foto(
    numero: str,
    image_url: str,
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
            "name": "confirmacion_encargo_foto",
            "language": {
                "code": "es"
            },
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "image",
                            "image": {
                                "link": image_url
                            }
                        }
                    ]
                },
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


def enviar_template_proveedor_encargo(
    numero: str,
    referencia: str,
    talla_eur: str
):
    url = obtener_url_whatsapp()
    headers = obtener_headers_whatsapp()
    numero_formateado = normalizar_numero_whatsapp(numero)

    payload = {
        "messaging_product": "whatsapp",
        "to": numero_formateado,
        "type": "template",
        "template": {
            "name": "notificacion_proveedor_encargo",
            "language": {
                "code": "es"
            },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": referencia},
                        {"type": "text", "text": talla_eur}
                    ]
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    return response.json()


def enviar_template_proveedor_foto(
    numero: str,
    image_url: str,
    referencia: str,
    talla_eur: str
):
    url = obtener_url_whatsapp()
    headers = obtener_headers_whatsapp()
    numero_formateado = normalizar_numero_whatsapp(numero)

    payload = {
        "messaging_product": "whatsapp",
        "to": numero_formateado,
        "type": "template",
        "template": {
            "name": "notificacion_proveedor_foto",
            "language": {
                "code": "es"
            },
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "image",
                            "image": {
                                "link": image_url
                            }
                        }
                    ]
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": referencia},
                        {"type": "text", "text": talla_eur}
                    ]
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    return response.json()

def enviar_template_encargo_en_local(
    numero: str,
    image_url: str,
    nombre: str,
    referencia: str,
    saldo: str
):
    url = obtener_url_whatsapp()
    headers = obtener_headers_whatsapp()
    numero_formateado = normalizar_numero_whatsapp(numero)

    payload = {
        "messaging_product": "whatsapp",
        "to": numero_formateado,
        "type": "template",
        "template": {
            "name": "encargo_en_local_foto",
            "language": {
                "code": "es"
            },
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "image",
                            "image": {
                                "link": image_url
                            }
                        }
                    ]
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nombre},
                        {"type": "text", "text": referencia},
                        {"type": "text", "text": saldo},
                    ]
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)

    print("WHATSAPP EN LOCAL:", response.json())

    return response.json()

def enviar_mensaje_texto(numero: str, texto: str):
    url = obtener_url_whatsapp()
    headers = obtener_headers_whatsapp()
    numero_formateado = normalizar_numero_whatsapp(numero)

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": numero_formateado,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": texto
        }
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    return response.json()


def descargar_y_subir_media_whatsapp(media_id: str) -> str | None:
    """
    Descarga una imagen de WhatsApp usando su ID, la sube a Cloudinary
    y retorna la URL persistente segura.
    """
    try:
        import io
        import cloudinary
        import cloudinary.uploader
        
        # 1. Configurar Cloudinary usando los settings existentes
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

        # 2. Consultar Graph API para obtener la URL temporal
        url_info = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{media_id}"
        headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}
        
        res_info = requests.get(url_info, headers=headers, timeout=15)
        if res_info.status_code != 200:
            print(f"[MEDIA] Error al obtener info de media {media_id}: {res_info.text}")
            return None
            
        media_data = res_info.json()
        download_url = media_data.get("url")
        if not download_url:
            print(f"[MEDIA] No se encontró download URL para media {media_id}")
            return None

        # 3. Descargar bytes de la imagen con la cabecera de autenticación
        res_download = requests.get(download_url, headers=headers, timeout=30)
        if res_download.status_code != 200:
            print(f"[MEDIA] Error al descargar archivo de media {media_id} desde {download_url}")
            return None

        # 4. Subir a Cloudinary
        file_bytes = io.BytesIO(res_download.content)
        resultado = cloudinary.uploader.upload(
            file_bytes,
            folder="tenisrioshop/mensajes",
            resource_type="image",
            public_id=f"media_{media_id}",
            overwrite=True,
        )
        
        secure_url = resultado.get("secure_url")
        print(f"[MEDIA] Imagen de WhatsApp {media_id} subida con éxito a Cloudinary: {secure_url}")
        return secure_url
    except Exception as e:
        print(f"[MEDIA] Error procesando descarga/subida de WhatsApp media {media_id}: {str(e)}")
        return None
