import os
from decimal import Decimal
from datetime import date, datetime

# Configurar variables de entorno antes de importar
os.environ["DATABASE_URL"] = "sqlite:///./test_pos.db"
os.environ["SECRET_KEY"] = "testsecret"
os.environ["ADMIN_USER"] = "admin"
os.environ["ADMIN_PASSWORD"] = "password"

from app.database import Base, engine, SessionLocal
from app.models.inventario import Inventario
from app.models.inventario_talla import InventarioTalla
from app.models.venta_operacion import VentaOperacion
from app.models.venta import Venta
from app.models.cliente import Cliente
from app.models.encargo import Encargo
from app.schemas.venta import VentaCheckoutCreate, VentaCheckoutItem
from app.services.ventas import procesar_checkout, crear_venta_desde_encargo_si_no_existe
from fastapi import HTTPException

# Setup database
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Seed
cliente = Cliente(nombre="Luis Perez", telefono="3001234567")
db.add(cliente)
db.flush()

prod1 = Inventario(
    marca="Nike",
    referencia="Air Max 90",
    costo=100000.0,
    precio_sugerido=180000.0,
    talla_eur="40",
    talla_col="38",
    cantidad=3,
    estado="disponible",
    fecha_ingreso="2026-07-11"
)
db.add(prod1)
db.flush()

talla1 = InventarioTalla(inventario_id=prod1.id, talla_eur="40", talla_col="38", cantidad=2)
talla2 = InventarioTalla(inventario_id=prod1.id, talla_eur="41", talla_col="39", cantidad=1)
db.add(talla1)
db.add(talla2)

prod2 = Inventario(
    marca="Adidas",
    referencia="Ultraboost",
    costo=120000.0,
    precio_sugerido=220000.0,
    talla_eur="42",
    talla_col="40",
    cantidad=1,
    estado="disponible",
    fecha_ingreso="2026-07-11"
)
db.add(prod2)
db.flush()

talla3 = InventarioTalla(inventario_id=prod2.id, talla_eur="42", talla_col="40", cantidad=1)
db.add(talla3)

db.commit()

# --- RUN TESTS ---

# Test 1: Checkout de un solo producto
checkout_data_1 = VentaCheckoutCreate(
    items=[
        VentaCheckoutItem(inventario_talla_id=talla1.id, cantidad=1, precio_unitario=Decimal("180000.00"))
    ],
    metodo_pago="efectivo",
    cliente_id=cliente.id,
    cliente_nombre=cliente.nombre,
    cliente_telefono=cliente.telefono,
    observaciones="Prueba 1"
)
operacion1 = procesar_checkout(db, checkout_data_1, origen="inventario")
assert operacion1.total_bruto == Decimal("180000.00")
assert operacion1.costo_total == Decimal("100000.00")
assert operacion1.utilidad_total == Decimal("80000.00")
assert operacion1.cantidad_items == 1
assert len(operacion1.detalles) == 1
assert operacion1.detalles[0].operacion_id == operacion1.id
assert talla1.cantidad == 1

# Test 2: Checkout con dos productos diferentes
checkout_data_2 = VentaCheckoutCreate(
    items=[
        VentaCheckoutItem(inventario_talla_id=talla1.id, cantidad=1, precio_unitario=Decimal("180000.00")),
        VentaCheckoutItem(inventario_talla_id=talla3.id, cantidad=1, precio_unitario=Decimal("220000.00"))
    ],
    metodo_pago="tarjeta",
    cliente_nombre="Cliente Casual",
    cliente_telefono="3119999999"
)
operacion2 = procesar_checkout(db, checkout_data_2, origen="inventario")
assert operacion2.total_bruto == Decimal("400000.00")
assert operacion2.costo_total == Decimal("220000.00")
assert operacion2.utilidad_total == Decimal("180000.00")
assert operacion2.cantidad_items == 2
assert talla3.cantidad == 0
assert prod2.estado == "agotado"
assert talla1.cantidad == 0

# Test 3: Insuficiente stock (debe hacer rollback y no disminuir stock)
try:
    checkout_data_3 = VentaCheckoutCreate(
        items=[
            VentaCheckoutItem(inventario_talla_id=talla2.id, cantidad=2, precio_unitario=Decimal("180000.00"))
        ],
        metodo_pago="efectivo"
    )
    procesar_checkout(db, checkout_data_3)
    assert False, "Debe lanzar error por stock insuficiente"
except HTTPException as e:
    assert e.status_code == 400
    assert "Stock insuficiente" in e.detail

# El stock de talla2 debe seguir siendo 1
assert talla2.cantidad == 1

# Test 4: Inexistente talla
try:
    checkout_data_4 = VentaCheckoutCreate(
        items=[
            VentaCheckoutItem(inventario_talla_id=99999, cantidad=1, precio_unitario=Decimal("100000.00"))
        ],
        metodo_pago="efectivo"
    )
    procesar_checkout(db, checkout_data_4)
    assert False, "Debe lanzar error por talla inexistente"
except HTTPException as e:
    assert e.status_code == 404

# Test 5: Duplicados
try:
    checkout_data_5 = VentaCheckoutCreate(
        items=[
            VentaCheckoutItem(inventario_talla_id=talla2.id, cantidad=1, precio_unitario=Decimal("180000.00")),
            VentaCheckoutItem(inventario_talla_id=talla2.id, cantidad=1, precio_unitario=Decimal("180000.00"))
        ],
        metodo_pago="efectivo"
    )
    procesar_checkout(db, checkout_data_5)
    assert False, "Debe lanzar error por duplicados"
except HTTPException as e:
    assert e.status_code == 400
    assert "duplicados" in e.detail

# Test 6: Encargo entregado
encargo = Encargo(
    cliente_id=cliente.id,
    referencia="Encargo Air Force",
    talla_eur="40",
    talla_col="38",
    precio=250000.0,
    estado="entregado",
    saldo=0.0,
    costo_base=130000.0,
    costo_envio=20000.0,
    costo_despachador=10000.0,
    costo_total=160000.0,
    utilidad_estimada=90000.0,
    metodo_pago="nequi",
    fecha_entregado="2026-07-11",
    foto="http://image.url",
    fecha_creacion=datetime.utcnow()
)
db.add(encargo)
db.flush()

venta_enc = crear_venta_desde_encargo_si_no_existe(db, encargo)
assert venta_enc is not None
assert venta_enc.encargo_id == encargo.id
assert venta_enc.origen == "encargo"
assert venta_enc.operacion_id is None

db.close()
print("¡TODAS LAS PRUEBAS DE SERVICIO PASARON EXITOSAMENTE!")
