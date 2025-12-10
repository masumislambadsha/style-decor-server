# 🎨 Style Decor — Server

[![Release](https://img.shields.io/github/v/release/masumislambadsha/style-decor-server?label=release&color=informational)](https://github.com/masumislambadsha/style-decor-server/releases)
[![License](https://img.shields.io/github/license/masumislambadsha/style-decor-server?color=blue)](./LICENSE)
[![Status](https://img.shields.io/badge/status-%20completed-brightgreen.svg)](#)
[![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org/)
[![Repo Size](https://img.shields.io/github/repo-size/masumislambadsha/style-decor-server)](https://github.com/masumislambadsha/style-decor-server)

> Backend API for the Style Decor application — clean, fast, and production-ready.


---

## ✨ About
Style Decor Server is the backend service powering the Style Decor product suite. It provides RESTful endpoints for products, categories, users, carts/orders, and authentication, designed to integrate smoothly with web and mobile frontends.

Short purpose
- Power the Style Decor frontend with secure, scalable API endpoints and DB-backed data storage.

---

## 🔗 Live URL
- Production: `https://api.style-decor.example.com` (replace with actual URL)
- Staging: `https://staging.style-decor.example.com` (optional)

---

## ✨ Features
- 🔐 User Authentication & Authorization — JWT or Firebase Admin (configurable)
- 🛍️ Product Management — Create, read, update, delete products & categories
- 🧾 Order & Cart APIs — Handle checkout workflow and order persistence
- 📊 Progress / Metrics Endpoints — Health, uptime, and basic stats
- 🌐 CORS Enabled — Ready to serve web/mobile frontends
- 🐳 Docker-friendly — Easy containerization for deployment

---

## 🧰 Built With
- Node.js & Express — Lightweight asynchronous server
- MongoDB (mongodb / mongoose) — NoSQL data storage
- Firebase Admin SDK — (optional) auth & user management
- dotenv — Environment configuration
- cors — Cross-origin requests
- (Add any other libraries used in your repo)

---

## 📦 All NPM packages used
Replace this with the exact dependencies from your package.json (or run `jq -r '.dependencies | keys[]' package.json`):

- express
- cors
- dotenv
- mongodb (or mongoose)
- firebase-admin (if used)
- jsonwebtoken
- bcryptjs
- nodemon (dev)

To automatically list packages:
```bash
cat package.json | jq -r '.dependencies + .devDependencies | keys[]'
```

---

## 🚦 API Overview
Full API docs coming soon — basic endpoints (adjust to match your routes):

| Method | Endpoint                    | Description                     |
|--------|-----------------------------|---------------------------------|
| POST   | /api/auth/register          | User registration               |
| POST   | /api/auth/login             | User login                      |
| GET    | /api/health                 | Server health check             |
| GET    | /api/products               | List all products               |
| GET    | /api/products/:id           | Get product by id               |
| POST   | /api/products               | Create product (auth/admin)     |
| PUT    | /api/products/:id           | Update product (auth/admin)     |
| DELETE | /api/products/:id           | Delete product (auth/admin)     |
| GET    | /api/categories             | List categories                 |
| POST   | /api/orders                 | Create order (auth)             |
| GET    | /api/orders/:id             | Get order by id (auth)          |

> Tip: copy the exact routes from your `routes/` directory and paste them here for a full API table.

---

## 🚀 Quick Start

1. Clone the repo
```bash
git clone https://github.com/masumislambadsha/style-decor-server.git
cd style-decor-server
```

2. Install dependencies
```bash
npm install
# or
yarn
```

3. Copy env example and fill values
```bash
cp .env.example .env
# edit .env with your DB credentials, secrets, firebase key, etc.
```

4. Run in development
```bash
npm run dev
# or
node index.js
```

Server runs on `http://localhost:3000` (or the PORT set in `.env`).

---

## ⚙️ Environment Variables
Add a `.env` file with the following keys (adjust to your app):

```
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/style-decor
JWT_SECRET=your_jwt_secret
NODE_ENV=development

# If using Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Keep secrets out of source control — use GitHub Secrets for CI / Deployment.

---

## 🧪 Testing
- Example (if you add tests):
```bash
npm test
```
If there are currently no tests, consider adding Jest or Mocha and a simple integration test for `/api/health`.

---

## 🧩 Database & Auth Notes
- Collections: `users`, `products`, `categories`, `orders` (adapt as needed)
- Recommended indexes: `users(email)`, `products(name)`, `orders(userId, createdAt)`
- Auth: document whether you use JWT or Firebase Admin and how tokens are validated

---

## 🛠️ Development & Contribution
We welcome contributions! Please follow this flow:

1. Fork → Branch (feature/name) → Commit → PR
2. Run linters and tests before opening a PR
3. Describe your changes and link an issue (if relevant)

Suggested branch naming: `feature/<short-description>`, `fix/<short-description>`.

---


---

## 📄 License
This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

## 🤝 Connect
- GitHub: [masumislambadsha](https://github.com/masumislambadsha)
- Email: <mohammadbadsha468@example.com>
- Linkedin :  [Masum Islam Badsha](https://www.linkedin.com/in/masum-islam-badsha/)

---

> “Success is the sum of small efforts, repeated day in and day out.” — Robert Collier

---

If you like this project, give it a star! ⭐
