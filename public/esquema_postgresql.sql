-- Creación de Tipos (Enums)
CREATE TYPE tipo_cliente AS ENUM ('SOCIO', 'USUARIO');
CREATE TYPE tipo_transaccion AS ENUM ('INGRESO', 'EGRESO');
CREATE TYPE categoria_transaccion AS ENUM (
    'CONSUMO', 'APORTE', 'MULTA', 'RECONEXION', 'OTROS', /* Ingresos */
    'MANTENIMIENTO', 'MATERIALES', 'SUELDOS', 'EQUIPOS', 'ADMINISTRATIVOS' /* Egresos */
);
CREATE TYPE estado_asistencia AS ENUM ('ASISTIO', 'FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA');
CREATE TYPE estado_pago AS ENUM ('PENDIENTE', 'PAGADO');
CREATE TYPE fase_suministro AS ENUM ('MONOFASICO', 'TRIFASICO');
CREATE TYPE estado_cliente AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE invitados_reunion AS ENUM ('SOCIO', 'TODOS');
CREATE TYPE tipo_persona AS ENUM ('PERSONA', 'EMPRESA');

-- Tabla de Clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_persona tipo_persona DEFAULT 'PERSONA',
    nombres VARCHAR(100) NOT NULL,    -- Razón social o nombres
    apellidos VARCHAR(100),           -- Nullable para empresas
    dni VARCHAR(11) UNIQUE NOT NULL,  -- DNI (8) o RUC (11)
    direccion VARCHAR(150) NOT NULL,
    numero_direccion VARCHAR(10),
    referencia_direccion VARCHAR(150),
    telefono VARCHAR(15),
    correo VARCHAR(100),
    codigo_suministro VARCHAR(6),     -- Optimizado para < 9999 usuarios (ej. 9999 o S-9999)
    tipo tipo_cliente NOT NULL DEFAULT 'USUARIO',
    fase_suministro fase_suministro,
    estado estado_cliente NOT NULL DEFAULT 'ACTIVO',
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Suministros (Para manejar arrays de suministros en clientes)
CREATE TABLE cliente_suministros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    codigo_suministro VARCHAR(6) UNIQUE NOT NULL
);

-- Tabla de Consumos
CREATE TABLE consumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    codigo_suministro VARCHAR(6),
    fecha_lectura TIMESTAMP WITH TIME ZONE NOT NULL,
    mes VARCHAR(7) NOT NULL, -- Formato YYYY-MM
    kwh DECIMAL(8,2) NOT NULL,
    monto_calculado DECIMAL(8,2) NOT NULL,
    estado_pago estado_pago NOT NULL DEFAULT 'PENDIENTE',
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Transacciones
CREATE TABLE transacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo tipo_transaccion NOT NULL,
    categoria categoria_transaccion NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    descripcion TEXT,
    destinatario VARCHAR(100),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Reuniones
CREATE TABLE reuniones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    motivo VARCHAR(150) NOT NULL,
    lugar VARCHAR(150),
    temas TEXT,
    invitados invitados_reunion DEFAULT 'SOCIO',
    finalizada BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Asistencia (Relación N:M entre Reuniones y Clientes)
CREATE TABLE asistencias (
    reunion_id UUID REFERENCES reuniones(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    estado estado_asistencia NOT NULL,
    PRIMARY KEY (reunion_id, cliente_id)
);

-- Tabla de Multas
CREATE TABLE multas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    reunion_id UUID REFERENCES reuniones(id) ON DELETE SET NULL,
    monto DECIMAL(8,2) NOT NULL,
    motivo VARCHAR(150) NOT NULL,
    estado_pago estado_pago NOT NULL DEFAULT 'PENDIENTE',
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
