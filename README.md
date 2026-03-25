# Algorithmic_Trading_Simulator

## Guidelines

### Repository Setup

1. Clone the repository:
   ```bash
   git clone <repository_url>
   ```

### Working on a Feature (Git Workflow)

We use the `develop` branch for all active development. **Do not commit directly to the `main` branch.**

#### 1. Sync with `develop`

Before starting a new feature, ensure your local `develop` branch is up to date:

```bash
git checkout develop
git pull origin develop
```

#### 2. Create a Feature Branch

Create a new branch for your feature off `develop` using a descriptive name:

```bash
git checkout -b feat/your-feature-name
```

#### 3. Make Changes and Commit

Make your code changes, stage them, and commit with a clear message:

```bash
git add .
git commit -m "feat: descriptive message about your changes"
```

#### 4. Push Your Feature Branch

Once your work is complete and committed, push your branch directly to the remote repository:

```bash
git push -u origin feat/your-feature-name
```

#### 5. Open PR and Check Conflicts on GitHub

On GitHub, select the develep branch and click **Compare & pull request** for your pushed feature branch, then confirm the branch selectors are:

- **base** = `develop` (the branch you want to merge _into_)
- **compare** = `feat/your-feature-name` (the branch you want to merge _from_)

Use the compare view to review the changes and check if GitHub shows merge conflicts before creating the PR.

#### 6. If Conflicts Exist, Sync `develop` into Your Feature Branch

If the PR shows conflicts, bring the latest `develop` into your feature branch:

```bash
git checkout develop
git pull origin develop
git checkout feat/your-feature-name
git merge develop
```

Resolve conflicts in your editor, then commit and push:

```bash
git add .
git commit -m "chore: resolve merge conflicts with develop"
git push origin feat/your-feature-name
```

#### 7. Merge PR

After conflicts are resolved and checks pass, the PR can be reviewed and merged by a seniors.


---

## Backend Setup (Go Server)

### Step 1: Navigate to Backend Directory

```bash
cd server
```

---

### Step 2: Initialize Go Module

Use a single shared module path for the entire team (same as GitHub repo):

```bash
go mod init github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator
```

---

### Step 3: Install Dependencies

Install all dependencies automatically:

```bash
go mod tidy
```

This reads imports from the codebase and installs everything (similar to `requirements.txt` in Python).

---

### Step 4: Run Docker 

Run the docker-compose file to run the databases

```bash
docker compose up
```

or if you want to free the terminal 

```bash
docker compose up -d
```

---

### Step 5: Run the Server

```bash
go run cmd/synthetic-bull/main.go
```

Server will start at:

```
http://localhost:8080
```

---

### Step 5: Test Endpoints

```bash
curl http://localhost:8080/ping
curl http://localhost:8080/health
```

---

### Step 6: WebSocket Endpoint

```
ws://localhost:8080/ws
```

Use Postman or any WebSocket client to test real-time communication.

---

## Server Folder Structure (Overview)

```text
backend/
├── cmd/
│   └── synthetic-bull/
│       └── main.go
├── internal/
│   ├── matching/
│   ├── simulation/
│   ├── transport/
│   │   ├── http/
│   │   └── websocket/
│   ├── auth/
│   ├── user/
│   ├── store/
│   └── models/
```

---
# Client Setup Guide

## Requirements
 - Node Installed

## Step 1
From root directory, run the code below:

```
cd client
```

## Step 2
```
npm i
```

## Step 3
```
npm run dev
```

## Architecture & Current Status

### Core Matching Engine

The backend is currently powered by an **in-memory, concurrent matching engine built in Go**.

- **Unidirectional Data Flow**  
  The REST API handles incoming requests and passes them into a buffered Go channel (`orderStream`).

- **Deterministic Execution**  
  A dedicated background goroutine processes the order queue sequentially, ensuring strict **Price-Time priority** without race conditions.

- **Background Logging**  
  Executed trades are passed through a `tradeStream` channel to a background worker for asynchronous caching and logging.

---

## API Reference

The primary entry points for interacting with the simulation are listed below:

| Endpoint        | Method | Description |
|----------------|--------|-------------|
| `/health`      | GET    | Health check to verify the server is running |
| `/order`       | POST   | Submit a new Limit or Market order |
| `/ws`          | WS     | WebSocket endpoint for real-time market data |

---

### Example: `POST /order` Payload

```json
{
  "symbol": "TECH",
  "side": "buy",
  "type": "limit",
  "price": 150.50,
  "quantity": 100
}
