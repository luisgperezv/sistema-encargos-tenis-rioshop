def formatear_pesos(valor: float) -> str:
    valor_entero = int(valor)
    return f"${valor_entero:,.0f}".replace(",", ".")