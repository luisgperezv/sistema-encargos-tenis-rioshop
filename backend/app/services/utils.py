def formatear_pesos(valor: float) -> str:
    valor_entero = int(valor)
    return f"${valor_entero:,.0f}".replace(",", ".")


def normalizar_texto(texto: str) -> str:
    import unicodedata
    import re

    if not texto:
        return ""
    # Convert to lowercase and strip whitespace
    t = texto.strip().lower()
    # Normalize unicode to decompose accents, then filter out Mn category (non-spacing marks)
    t = "".join(
        c for c in unicodedata.normalize("NFKD", t) if unicodedata.category(c) != "Mn"
    )
    # Replace multiple spaces with a single space
    t = re.sub(r"\s+", " ", t)
    return t