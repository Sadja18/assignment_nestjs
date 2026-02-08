# Currency Rate Ingestion and Analytics Service  
**Take-Home Assignment Submission**

This repository contains a complete implementation of the Currency Rate Ingestion and Analytics Service as specified in the assignment brief. All functional and non-functional requirements have been fulfilled using NestJS 11, PostgreSQL, and production-grade patterns within a constrained timebox.

---

## Tech Stack

- **Runtime**: Node.js 22  
- **Framework**: NestJS 11  
- **Database**: PostgreSQL (tested with Neon free tier)  
- **ORM**: TypeORM 0.3  
- **HTTP Client**: `@nestjs/axios`  
- **Validation**: `class-validator`, `class-transformer`  
- **Authentication**: Static API key via custom guard  
- **Containerization**: Docker, Docker Compose  
- **Language**: TypeScript (strict mode)

---

## Implemented Features

All required features from the assignment specification are fully implemented:

1. **Third-Party API Integration**  
   - Fetches USD-based exchange rates for five target currencies (INR, EUR, GBP, JPY, CAD) from `https://api.frankfurter.app`  
   - Implements 5-second timeout and retry logic with exponential backoff  
   - Returns HTTP 503 on persistent upstream failures

2. **PostgreSQL Data Storage**  
   - Uses a dedicated `exchange_rates` table with proper schema:  
     - `baseCurrency`, `targetCurrency` (VARCHAR(3))  
     - `rate` (DECIMAL(15,6))  
     - `fetchedAt` (TIMESTAMPTZ)  
     - `fetchedAtMinute` (INTEGER) — derived for deduplication  
   - Enforces uniqueness via composite constraint on `(baseCurrency, targetCurrency, fetchedAtMinute)` to prevent duplicate records within the same minute window

3. **REST API Endpoints**  
   - `POST /rates/fetch`: Triggers immediate ingestion and storage  
   - `GET /rates/latest?base=USD`: Returns the most recent rate for each target currency using a windowed query (`ROW_NUMBER() OVER PARTITION BY`)  
   - `GET /rates/average?base=USD&target=INR&period=24h`: Computes arithmetic mean over configurable time windows (1h, 6h, 12h, 24h, 7d)

4. **Background Processing**  
   - Scheduled ingestion every 3 hours using `@Cron(CronExpression.EVERY_3_HOURS)`  
   - Runs asynchronously without blocking HTTP requests  
   - Reuses the same ingestion logic as the manual endpoint

5. **Observability & Reliability**  
   - `/health` endpoint returns `{ status: 'OK', timestamp: ISO8601 }`  
   - Structured logging with contextual metadata via custom logger  
   - Environment-based configuration (no hardcoded secrets)

6. **Bonus: Security**  
   - **Static API Key Authentication**: All endpoints (except `/health`) require an `X-API-Key` header or `api_key` query parameter  
   - Configured via `API_KEY` environment variable

7. **DevOps**  
   - Dockerized with multi-stage `Dockerfile` (Node 22, non-root user)  
   - `docker-compose.yml` provided for local PostgreSQL development

---

## Development Journey

The implementation followed a deliberate, incremental approach to manage risk and validate assumptions early:

1. **Foundation Setup**: Initialized NestJS project with health check endpoint.
2. **SQLite Prototyping**: Used SQLite with `synchronize: true` to rapidly validate core data flow—particularly duplicate prevention via `fetchedAtMinute`—without infrastructure overhead.
3. **Frankfurter Integration**: Built resilient API client with timeout, retries, and response validation.
4. **Core APIs**: Implemented `/rates/fetch` and `/rates/latest` against the validated data layer.
5. **PostgreSQL Migration**: Replaced SQLite with PostgreSQL by:
   - Updating entity to use `timestamptz`
   - Parsing `PSQL_CONNECT` environment variable
   - Ensuring all queries remained database-agnostic
6. **Background Job**: Added cron scheduler colocated in the `currency` module.
7. **Security & Polish**: Added API key auth, DTO validation, and structured logging.

This phased strategy ensured each layer was verified before proceeding, demonstrating engineering discipline without over-engineering.

---

## File Structure

The codebase follows clean NestJS modular architecture with feature-based organization:

```
src/
├── app.*                     # Root module and health check
├── common/
│   ├── structured-logger.ts  # Context-aware logging utility
│   └── guards/api-key.guard.ts # API key authentication guard
├── config/database.config.ts # Parses PSQL_CONNECT into TypeORM config
└── currency/                 # Unified domain module
    ├── currency.controller.ts # REST endpoints
    ├── currency.service.ts   # Business logic
    ├── dto/                  # Validation objects (LatestRatesDto, AverageRatesDto)
    ├── entities/exchange-rate.entity.ts # PostgreSQL schema
    ├── frankfurter/frankfurter.service.ts # Third-party API client
    └── schedular/schedular.service.ts # Cron job implementation
```

All currency-related logic is encapsulated in the `currency` module, ensuring high cohesion and testability.

---

## Control Flow

1. **Manual Ingestion (`POST /rates/fetch`)**  
   - Controller → `CurrencyService.fetchAndSaveRates('USD')`  
   - Service → `FrankfurterService.fetchLatest()`  
   - Frankfurter → Validates response → Returns rates  
   - Service → Saves each rate if not duplicate (using `fetchedAtMinute`)  

2. **Latest Rates (`GET /rates/latest`)**  
   - Controller → `CurrencyService.getLatestRates(base)`  
   - Service → Executes windowed query:  
     ```sql
     SELECT *, ROW_NUMBER() OVER (
       PARTITION BY targetCurrency 
       ORDER BY fetchedAt DESC
     ) AS rn
     FROM exchange_rates
     WHERE baseCurrency = ?
     ```
   - Filters to `rn = 1` → Returns latest rate per target

3. **Average Rates (`GET /rates/average`)**  
   - Controller → Validates period (1h/6h/12h/24h/7d)  
   - Service → Computes start date → Queries `AVG(rate)` over time window

4. **Background Job**  
   - `SchedulerService` triggers `fetchAndSaveRates('USD')` every 3 hours  
   - Same path as manual ingestion → Ensures consistency

5. **Authentication**  
   - `ApiKeyGuard` runs on all routes except `/health`  
   - Checks `X-API-Key` header or `api_key` query param against `API_KEY` env var

---

## Local Setup

**Prerequisites**: Node.js 22, Docker, Docker Compose

1. Install dependencies:  
   ```bash
   npm install
   ```

2. Create `.env`:  
   ```env
   API_KEY=your-test-key
   PSQL_CONNECT=postgresql://postgres:postgres@localhost/currency_db?sslmode=disable
   ```

3. Start services:  
   ```bash
   docker-compose up --build
   ```

4. Test:  
   ```bash
   curl http://localhost:3000/health
   curl -H "X-API-Key: your-test-key" -X POST http://localhost:3000/rates/fetch
   ```

---

## License

This project is licensed under the GNU General Public License v2.0. See the LICENSE file for details.