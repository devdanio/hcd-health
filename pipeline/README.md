# Pipeline Scripts

## Single Entry Point

Use this as the primary entrypoint:

```bash
pnpm run pipeline -- <command> [...args]
```

Show command help:

```bash
pnpm run pipeline -- help
```

## Available Commands

### `fetch-contacts`
Download all GHL contacts for a client.

```bash
pnpm run pipeline -- fetch-contacts <clientName> [outputPath] --env-file .env
```

### `contacts-to-db`
Insert GHL contacts JSONLD into `leads` and `lead_events`.

```bash
pnpm run pipeline -- contacts-to-db <clientName> [jsonldPath] --env-file .env
```

### `ehr-preprocess`
Normalize raw EHR export into patients JSONLD using `EHR_SYSTEM` from `client-config.ts`.

```bash
pnpm run pipeline -- ehr-preprocess <clientName> [inputFile] [outputFile] [--source-system <name>]
```

### `patients-to-db`
Insert normalized patient JSONLD into `patients` with idempotent keying.

```bash
pnpm run pipeline -- patients-to-db <clientName> [jsonldPath] --env-file .env
```

### `link-patients`
Link `leads` to `patients` for one client.

```bash
pnpm run pipeline -- link-patients <clientName> --env-file .env
```

### `reset-client`
Delete client data (`lead_patient_links`, `patient_values`, `lead_events`, `patients`, `leads`).

```bash
pnpm run pipeline -- reset-client <clientName> --env-file .env
```

### `run-client`
Run full pipeline for one client (with confirmation prompts).

```bash
pnpm run pipeline -- run-client <clientName> --env-file .env
```

Full refresh mode:

```bash
pnpm run pipeline -- run-client <clientName> --full-refresh --env-file .env
```

### `run-all`
Run full pipeline for all configured clients.

```bash
pnpm run pipeline -- run-all --env-file .env
```

## Direct Script Aliases (`pnpm` Scripts)

Each script also has a direct `pnpm` alias:

- `pipeline:fetch-contacts`
- `pipeline:contacts-to-db`
- `pipeline:ehr-preprocess`
- `pipeline:patients-to-db`
- `pipeline:link-patients`
- `pipeline:reset-client`
- `pipeline:run-client`
- `pipeline:run-all`
- `pipeline:preprocess-ehr` (legacy alias)
- `pipeline:client` (alias of `pipeline:run-client`)
- `pipeline:all` (alias of `pipeline:run-all`)

## Required Client Config Paths

Each client in `/Users/dan/Desktop/highcountrydigital.io/app/client-config.ts` must define:

- `GHL_RAW_DIR`
- `EHR_RAW_DIR`
- `EHR_NORMALIZED_DIR`

Raw EHR files must include a `MM-DD-YYYY` date token for automatic latest-file detection.

## Normalized EHR JSONLD Schema

One JSON object per line with:

- `firstName`
- `lastName`
- `phone` (E.164)
- `email`
- `firstApt` (`MM/DD/YYYY`)
- `lastApt` (`MM/DD/YYYY`)
- `cashCollectedCents`
- `insuranceBalanceCents`
- `patientBalanceCents`
- `externalId`

For `unifiedpractice`, these are currently `null`:

- `cashCollectedCents`
- `insuranceBalanceCents`
- `patientBalanceCents`
- `externalId`
