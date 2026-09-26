# 🚀 Panel Mr-Robot - SaaS IA WhatsApp

**Automatización con Inteligencia Artificial para negocios. Tu negocio trabajando 24/7 mientras duermes.**

---

## ✨ Funcionalidades

- ✅ **Responde clientes automáticamente** con IA conversacional
- ✅ **Agenda citas** sin intervención humana
- ✅ **Avisa cuando un cliente quiere hablar con un asesor**
- ✅ **Campañas de WhatsApp masivas** segmentadas
- ✅ **Panel de administración** completo para gestionar todo
- ✅ **Integración con MercadoPago** para cobros automáticos
- ✅ **Soporte multi-empresa** (varios negocios en una cuenta)
- ✅ **Notificaciones inteligentes** por email y WhatsApp

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| **Frontend Dashboard** | React + TypeScript + TailwindCSS |
| **Panel de Cliente** | Vite + React + TypeScript |
| **API Backend** | Node.js + Express + TypeScript |
| **Bot WhatsApp** | WhatsApp Web.js + TypeScript |
| **Base de Datos** | PostgreSQL + Redis |
| **IA** | OpenAI / Claude API |
| **Pagos** | MercadoPago |
| **Email** | Nodemailer + SMTP |
| **Deploy** | Docker + PM2 |

---

## 📁 Estructura del Proyecto

waas/
├── api/ # Backend API REST
├── bot/ # Bot de WhatsApp con IA
├── frontend/ # Dashboard de administración
├── panel/ # Panel para clientes finales
└── docker-compose.yml

---

## 🚀 Instalación

```bash
# Clonar
git clone https://github.com/CROW-MA/panel-mr-robot.git
cd panel-mr-robot.store

# Instalar dependencias
npm install
cd api && npm install
cd ../bot && npm install
cd ../frontend && npm install
cd ../panel && npm install
cd ..

# Configurar .env (copiar de .env.example)
cp .env.example .env
# Editar .env con tus claves

# Iniciar
docker-compose up -d

🔐 Variables de Entorno

Copiar .env.example a .env y completar:
Variable	Descripción
DB_HOST	Host de PostgreSQL
DB_PASSWORD	Contraseña de la base de datos
JWT_SECRET	Secreto para tokens JWT
WHATSAPP_API_KEY	API Key de WhatsApp
AI_API_KEY	API Key de OpenAI/Claude
STRIPE_SECRET_KEY	Clave secreta de Stripe
SMTP_PASS	Contraseña de email
🌐 URLs

    🔗 Landing Page: https://panel.mr-robot.store

    📊 Dashboard: https://panel.mr-robot.store

    🔌 API: https://api.mr-robot.store

📞 Soporte

¿Quieres automatizar tu negocio? Contáctanos:

    📧 Email: willgensuarez7@gmail.com
    💬 WhatsApp: Escríbenos +57 3244990285

Hecho con ❤️ por CROW-MA | Ethical Hacker & Full Stack Developer
