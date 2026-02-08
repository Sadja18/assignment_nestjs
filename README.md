# Currency Rate Ingestion and Analytics Service  
**Take-Home Assignment Submission**

This repository contains a complete implementation of the Currency Rate Ingestion and Analytics Service as specified in the assignment brief. All functional and non-functional requirements have been fulfilled within the 6–10 hour scope. The solution is self-contained, well-documented, and ready for evaluation.

---

## Tech Stack

- **Runtime**: Node.js 22
- **Framework**: NestJS 11
- **Database**: PostgreSQL (tested with Neon free tier)
- **ORM**: TypeORM 0.3
- **HTTP Client**: `@nestjs/axios`
- **Validation**: `class-validator`, `class-transformer`
- **Rate Limiting**: `@nestjs/throttler`
- **Containerization**: Docker, Docker Compose
- **Language**: TypeScript (strict mode)

---

## Implemented Features

All required features from the assignment specification have been implemented:

1. **Third-Party API Integration**  
   - Fetches USD-based rates for 5+ currencies (INR, EUR, GBP, JPY, CAD) from `https://api.frankfurter.app`  
   - Implements 5-second timeout and 3-attempt exponential backoff retry logic  
   - Returns HTTP 503 on persistent failures

2. **PostgreSQL Data Storage**  
   - Uses `exchange_rates` table with columns: `baseCurrency`, `targetCurrency`, `rate`, `fetchedAt` (`timestamptz`), `fetchedAtMinute`  
   - Enforces uniqueness via composite constraint on `(baseCurrency, targetCurrency, fetchedAtMinute)` to prevent duplicates within minute windows  
   - Schema is fully compatible with PostgreSQL; no SQLite remnants in final code

3. **REST API Endpoints**  
   - `POST /rates/fetch`: Triggers ingestion and storage  
   - `GET /rates/latest?base=USD`: Returns latest rate per target currency using windowed query  
   - `GET /rates/average?base=USD&target=INR&period=24h`: Computes average over configurable time windows (1h/6h/12h/24h/7d)

4. **Background Processing**  
   - Cron job runs every 3 hours via `@Cron(CronExpression.EVERY_3_HOURS)`  
   - Executes same ingestion logic as manual endpoint  
   - Non-blocking and failure-isolated

5. **Observability & Reliability**  
   - `/health` endpoint returns `{ status: 'OK', timestamp: ISO8601 }`  
   - Structured logging with contextual metadata via custom `StructuredLogger`  
   - Environment-based configuration (no hardcoded secrets)

6. **Bonus: Security Features**  
   - **API Key Authentication**: All endpoints (except `/health`) require `X-API-Key` header or `api_key` query parameter  
   - **Rate Limiting**: 10 requests per minute per IP (configurable via env vars)

7. **DevOps**  
   - Dockerized with multi-stage `Dockerfile` (Node 22, non-root user)  
   - `docker-compose.yml` provided for local PostgreSQL development

---

## Development Journey

The implementation followed an intentional, incremental approach:

1. **Initial Setup**: Created NestJS project with health check endpoint.
2. **SQLite Prototyping**: Used SQLite with `synchronize: true` to rapidly validate core logic (duplicate prevention via `fetchedAtMinute`, rate saving).
3. **Frankfurter Integration**: Built resilient API client with retries and validation.
4. **Core APIs**: Implemented `/rates/fetch` and `/rates/latest`.
5. **PostgreSQL Migration**: Replaced SQLite with PostgreSQL by:
   - Switching `fetchedAt` to `timestamptz`
   - Parsing `PSQL_CONNECT` environment variable
   - Ensuring all queries remained database-agnostic
6. **Background Job**: Added cron scheduler colocated in `currency/schedular/`.
7. **Security & Polish**: Added API key auth, rate limiting, DTO validation, and structured logging.

This phased strategy ensured each layer was verified before proceeding, demonstrating production engineering discipline without over-engineering.

---

## Project Structure

Key directories and files reflect clean NestJS architecture:

```
src/
├── app.*                     # Root module and health check
├── common/
│   ├── structured-logger.ts  # Context-aware logging
│   └── guards/api-key.guard.ts # API key authentication
├── config/database.config.ts # Parses PSQL_CONNECT
└── currency/                 # Unified domain module
    ├── currency.controller.ts # REST endpoints
    ├── currency.service.ts   # Business logic
    ├── dto/                  # Validation objects
    ├── entities/exchange-rate.entity.ts # PostgreSQL schema
    ├── frankfurter/          # Third-party API client
    └── schedular/            # Cron job implementation
```

All currency-related logic is encapsulated in the `currency` module, ensuring high cohesion and testability.

---

## Local Setup and Run

**Prerequisites**: Node.js 22, Docker, Docker Compose

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment (create `.env`):
   ```env
   API_KEY=your-test-api-key
   THROTTLE_TTL=60
   THROTTLE_LIMIT=10
   ```

3. Start services:
   ```bash
   docker-compose up --build
   ```

4. Test endpoints:
   ```bash
   # Health check (no auth needed)
   curl http://localhost:3000/health

   # Fetch rates (requires auth)
   curl -H "X-API-Key: your-test-api-key" \
        -X POST http://localhost:3000/rates/fetch

   # Get latest rates
   curl -H "X-API-Key: your-test-api-key" \
        "http://localhost:3000/rates/latest?base=USD"

   # Get average
   curl -H "X-API-Key: your-test-api-key" \
        "http://localhost:3000/rates/average?base=USD&target=INR&period=24h"
   ```

The application connects to a local PostgreSQL instance defined in `docker-compose.yml`.

---

## Dependencies

Key packages used:

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`
- `@nestjs/typeorm`, `typeorm`, `pg`
- `@nestjs/axios`, `rxjs`
- `@nestjs/throttler`
- `class-validator`, `class-transformer`
- `pg-connection-string` (for parsing `PSQL_CONNECT`)

Full list in `package.json`.

---

## License

This project is licensed under the GNU General Public License v2.0. See the LICENSE file for details.
