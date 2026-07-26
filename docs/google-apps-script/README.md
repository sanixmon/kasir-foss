# Google Apps Script Setup Guide

Follow these steps to set up the Google Sheets database and deploy the Apps Script Web App.

## Step 1: Create Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet named `kasir-db`.
2. Create 4 sheet tabs at the bottom with exact names:
   - `ActiveSessions`
   - `Transactions`
   - `Settings`
   - `Users`

### Headers:

- **`ActiveSessions`** tab (Row 1):  
  `id` | `nama` | `items` | `start_time` | `tanggal` | `queue_no` | `pay_awal` | `created_at`

- **`Transactions`** tab (Row 1):  
  `id` | `no` | `queue_no` | `nama` | `tanggal` | `start_time` | `end_time` | `items` | `ot` | `ot_dur` | `total_base` | `total_ot` | `total_tol` | `grand_total` | `total_all` | `pay_awal` | `cash` | `qris` | `shift`

- **`Settings`** tab (Row 1):  
  `Key` | `Value`

- **`Users`** tab (Row 1):  
  `username` | `password` | `role`

---

## Step 2: Add Apps Script Code

1. In your Google Spreadsheet, click **Extensions** > **Apps Script**.
2. Replace all contents in `Code.gs` with the code from [`docs/google-apps-script/Code.gs`](./Code.gs).
3. Click **Save** (disk icon).

---

## Step 3: Deploy as Web App

1. Click **Deploy** (top right blue button) > **New deployment**.
2. Select type: **Web App**.
3. Set configuration:
   - **Description**: Kasir Trial Web App API
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. Grant necessary permissions when prompted.
6. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/.../exec`).

---

## Step 4: Configure Frontend

Add the URL to your `.env` file or environment variables:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```
