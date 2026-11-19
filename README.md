# Artisan Marketplace

A full-stack marketplace that lets local artisans sell handmade goods directly to buyers, built mobile-first for sellers who may not be comfortable typing product listings.

**Highlight: voice product listing.** A seller describes a product out loud, in Hindi, English or a mix. The backend transcribes the audio with Whisper and uses Llama 3.1 to extract the name, price, quantity and description in English. The add-product form is then filled in automatically.

## Features

- **Phone OTP sign-up and password reset**: Firebase phone authentication. The server verifies the Firebase ID token before creating an account or changing a password.
- **Marketplace browsing**: product feed with cart, quantity picker and "buy now".
- **Multi-seller checkout**: one checkout is split into a separate order for each seller. Prices and totals are calculated on the server, and stock is reserved atomically so items can't be oversold.
- **Seller dashboard**: list products with image upload (Cloudinary), manage incoming orders through Pending → Confirmed → Packed → Shipped → Delivered. Cancelling or rejecting an order returns its stock.
- **Delivery issue resolution**: buyers report issues (not received, damaged, wrong item and so on). The issue closes once both buyer and seller mark it resolved.
- **AI gift advisor**: describe the occasion and recipient and get up to 3 in-stock product suggestions with reasons.
- **Shop open/closed toggle**: products from closed shops show as unavailable.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 (Create React App), React Router, Tailwind CSS, Spline 3D, Firebase Auth |
| Backend | Node.js, Express, MongoDB with Mongoose, JWT authentication |
| AI | Groq: Whisper large-v3 (speech to text), Llama 3.1 8B (structured extraction, gift advice) |
| Media | Cloudinary (image storage) via Multer |

## Architecture

```
React app ──(REST + Bearer JWT)──► Express API ──► MongoDB
     │                                 ├──► Groq (Whisper, Llama 3.1)
     └── Firebase phone OTP ──────────►├──► Firebase Admin (verifies OTP ID tokens)
                                       └──► Cloudinary (images)
```

- **Authentication:** login and registration return a JWT. Every request that reads or changes a user's data must include it. The server takes the user's identity from the token, never from IDs in the request body or URL.
- **Ownership checks:** sellers can only update their own orders, buyers can only report issues on their own orders, and users can only read their own order lists.
- **No secrets in the browser:** all AI calls run on the backend.

## Running locally

**Prerequisites:** Node.js 18+, a MongoDB connection string (for example MongoDB Atlas), a Firebase project with Phone sign-in enabled, a Cloudinary account and a Groq API key.

```bash
# Backend
cd backend
cp .env.example .env      # fill in the values
npm install
npm start                 # http://localhost:5000

# Frontend (in a second terminal)
cd frontend
cp .env.example .env      # fill in the values
npm install
npm start                 # http://localhost:3000
```

Both folders include an `.npmrc` with `legacy-peer-deps=true`, because `multer-storage-cloudinary` declares a peer dependency on an older Cloudinary SDK.

## API overview

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/users/register` | Firebase OTP token | Create account |
| POST | `/api/users/login` | none | Log in, returns JWT |
| PUT | `/api/users/reset-password` | Firebase OTP token | Reset password |
| PUT | `/api/users/update-profile` | JWT | Update own profile |
| GET | `/api/products/all` | none | Product feed |
| POST | `/api/products/add` | JWT | Add product as the logged-in seller |
| POST | `/api/upload` | JWT | Upload image to Cloudinary |
| POST | `/api/voice/analyze` | JWT | Voice to product details |
| POST | `/api/ai/gift-advice` | JWT | Gift suggestions |
| POST | `/api/orders/create` | JWT | Checkout (split by seller, stock reserved) |
| GET | `/api/orders/by-buyer/:id`, `/by-seller/:id` | JWT (own id only) | Order lists |
| PUT | `/api/orders/update-status/:id` | JWT (seller of order) | Update order status |
| PUT | `/api/orders/report-issue/:id`, `/resolve-issue/:id` | JWT (party to order) | Delivery issues |

## Possible next steps

- Online payments (for example Razorpay) in place of the current payment-method selection
- Product search, categories and seller ratings
- Automated tests for the order and stock logic
