# Native Kotlin POS (kasir-mobile) Refactoring & Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor and modernize the native Android Kotlin POS application (`kasir-mobile`) into a clean MVVM/Clean Architecture codebase with Jetpack Compose (tablet landscape-optimized), 100% domain parity with the web app (10:59 overtime tolerance, 06:00 shift rollover, queue management), Retrofit API integration with Google Apps Script / SQLite backend, and robust ESC/POS Bluetooth thermal printing (58mm/80mm).

**Architecture:** Clean Architecture + MVVM with Android Jetpack. Jetpack Compose UI layer optimized for tablet landscape (Master-Detail / Persistent Sidebar navigation), pure Kotlin Domain layer for deterministic rental & shift calculations (tested via JUnit 5), Data layer with Retrofit & OkHttp (offline cache with Room/DataStore), and an isolated Bluetooth & ESC/POS Print Manager module.

**Tech Stack:** Kotlin 2.0+, Jetpack Compose, Material 3, Android Jetpack (ViewModel, Navigation Compose, StateFlow), Coroutines & Flow, Retrofit 2 + Moshi / KotlinX Serialization, Android Bluetooth Classic RFCOMM (SPP), JUnit 5 + MockK + Turbine.

**Spec:** Ported from EVREN HOUSE Kasir POS web architecture (`kasir-db`) specifications:
- Overtime Engine with 10:59 Tolerance
- 06:00 AM Shift Rollover & Queue Management
- Role-Based Access Control & Admin Escalation
- ESC/POS Thermal Printing (58mm/80mm)
- Google Apps Script & SQLite Backend API contracts

## Global Constraints

- **Platform:** Android 8.0+ (API level 26 minimum, API level 34 target).
- **Orientation:** Locked to Tablet Landscape (`android:screenOrientation="sensorLandscape"`).
- **Overtime Rule:** Grace period 0m to 10m59s (`floor(actualOver) < 11` is free). OT starts at minute 11. 11–40 min is half-hour rate, 41–60 min is full-hour rate.
- **Shift Rollover:** 06:00 AM daily cutoff (`timestamp - 6 hours`).
- **Currency:** Indonesian Rupiah (IDR) format `Rp XX.XXX` (no decimal cents).
- **Bluetooth Printer:** Maintain Bluetooth Classic RFCOMM SPP connection (`00001101-0000-1000-8000-00805F9B34FB`) with auto-reconnect and ESC/POS command formatting for 58mm (32 chars/line) and 80mm (48 chars/line).

---

## File Structure Map

```
kasir-mobile/
├── app/
│   ├── build.gradle.kts
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   └── java/com/evrenhouse/kasir/
│       │       ├── KasirApplication.kt
│       │       ├── core/
│       │       │   ├── constants/AppConstants.kt
│       │       │   ├── utils/CurrencyFormatter.kt
│       │       │   └── utils/DateTimeUtils.kt
│       │       ├── domain/
│       │       │   ├── model/
│       │       │   │   ├── RentalItem.kt
│       │       │   │   ├── ActiveSession.kt
│       │       │   │   ├── Transaction.kt
│       │       │   │   ├── OvertimeResult.kt
│       │       │   │   ├── ItemCalculation.kt
│       │       │   │   └── RentalTotals.kt
│       │       │   └── usecase/
│       │       │       ├── CalculateOvertimeUseCase.kt
│       │       │       ├── CalculateRentalUseCase.kt
│       │       │       ├── ShiftRolloverUseCase.kt
│       │       │       └── ValidateAdminPasswordUseCase.kt
│       │       ├── data/
│       │       │   ├── remote/
│       │       │   │   ├── KasirApiService.kt
│       │       │   │   ├── dto/ (SessionDto, TransactionDto, ApiResponses)
│       │       │   │   └── AuthInterceptor.kt
│       │       │   ├── local/
│       │       │   │   ├── UserPreferences.kt
│       │       │   │   └── StationCatalog.kt
│       │       │   └── repository/
│       │       │       ├── AuthRepository.kt
│       │       │       ├── RentalRepository.kt
│       │       │       └── TransactionRepository.kt
│       │       ├── bluetooth/
│       │       │   ├── BluetoothPrinterManager.kt
│       │       │   ├── EscPosCommandBuilder.kt
│       │       │   └── ReceiptTemplateFormatter.kt
│       │       └── ui/
│       │           ├── theme/ (Color.kt, Theme.kt, Type.kt)
│       │           ├── components/ (CommonButtons, StatusBadges, ModalDialogs)
│       │           ├── navigation/ (NavRoutes.kt, AppNavHost.kt)
│       │           ├── auth/ (LoginScreen.kt, RoleSelectionScreen.kt, AuthViewModel.kt)
│       │           ├── dashboard/ (DashboardScreen.kt, SessionCard.kt, DashboardViewModel.kt)
│       │           ├── rental/ (CalculateRentalDialog.kt, EditSessionDialog.kt, RentalViewModel.kt)
│       │           ├── payment/ (PaymentDialog.kt, QrPaymentView.kt, PaymentViewModel.kt)
│       │           ├── history/ (HistoryScreen.kt, DeletionLogScreen.kt, HistoryViewModel.kt)
│       │           └── settings/ (SettingsScreen.kt, BluetoothPairingDialog.kt, SettingsViewModel.kt)
│       └── test/
│           └── java/com/evrenhouse/kasir/
│               ├── domain/CalculateOvertimeUseCaseTest.kt
│               ├── domain/ShiftRolloverUseCaseTest.kt
│               ├── domain/CurrencyFormatterTest.kt
│               └── bluetooth/EscPosCommandBuilderTest.kt
```

---

## Tasks

### Task 1: Project Scaffolding, Dependencies & Tablet Configuration

**Files:**
- Modify: `build.gradle.kts`
- Modify: `app/build.gradle.kts`
- Modify: `app/src/main/AndroidManifest.xml`
- Create: `app/src/main/java/com/evrenhouse/kasir/KasirApplication.kt`

**Interfaces:**
- Produces: Application setup with Compose BOM, Retrofit2, Coroutines, JUnit5 testing dependencies, landscape tablet manifest locks.

- [ ] **Step 1: Configure Root and App build.gradle.kts**
- [ ] **Step 2: Update AndroidManifest.xml for Tablet Landscape & Bluetooth Permissions**
- [ ] **Step 3: Create KasirApplication.kt**
- [ ] **Step 4: Verify gradle sync and build**

---

### Task 2: Domain Layer — 10:59 Overtime Tolerance & Rental Pricing Engine

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/domain/model/RentalItem.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/domain/model/OvertimeResult.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/domain/model/ItemCalculation.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/domain/model/RentalTotals.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/domain/usecase/CalculateOvertimeUseCase.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/domain/usecase/CalculateRentalUseCase.kt`
- Test: `app/src/test/java/com/evrenhouse/kasir/domain/CalculateOvertimeUseCaseTest.kt`

**Interfaces:**
- Produces: `CalculateOvertimeUseCase.execute(elapsedMin: Double, limitMin: Double): OvertimeResult`
- Produces: `CalculateRentalUseCase.calculateItem(item: SessionItem, catalogItem: CatalogItem, elapsedMin: Double, returnQty: Int?): ItemCalculation`

- [ ] **Step 1: Write JUnit 5 Unit Tests for 10:59 Overtime Calculation**
- [ ] **Step 2: Implement CalculateOvertimeUseCase and CalculateRentalUseCase**
- [ ] **Step 3: Run Tests and Verify All Pass**

---

### Task 3: Domain Layer — 06:00 AM Shift Rollover & Rupiah Currency Formatting

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/core/constants/AppConstants.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/core/utils/CurrencyFormatter.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/domain/usecase/ShiftRolloverUseCase.kt`
- Test: `app/src/test/java/com/evrenhouse/kasir/domain/ShiftRolloverUseCaseTest.kt`
- Test: `app/src/test/java/com/evrenhouse/kasir/core/utils/CurrencyFormatterTest.kt`

**Interfaces:**
- Produces: `ShiftRolloverUseCase.getShiftDate(timestampMs: Long = System.currentTimeMillis()): String`
- Produces: `ShiftRolloverUseCase.isShiftExpired(sessionShiftDate: String, currentShiftDate: String): Boolean`
- Produces: `CurrencyFormatter.formatRupiah(amount: Double): String`

- [ ] **Step 1: Write Unit Tests for Shift Rollover & Rupiah Formatting**
- [ ] **Step 2: Implement ShiftRolloverUseCase & CurrencyFormatter**
- [ ] **Step 3: Run Tests and Verify All Pass**

---

### Task 4: Data Layer — Retrofit API Service & Google Apps Script / Backend Models

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/data/remote/KasirApiService.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/data/remote/dto/ApiModels.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/data/remote/AuthInterceptor.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/data/repository/RentalRepository.kt`

**Interfaces:**
- Consumes: Google Apps Script Web App / SQLite API endpoints (`fetch_data`, `add_session`, `claim_session`, `edit_session`, `delete_session`, `delete_txn`, `backup_db`, `login_cashier`, `login_admin`)
- Produces: `RentalRepository.fetchAllData(): Flow<Resource<PosDataPayload>>`, `RentalRepository.addSession(session: ActiveSession): Result<ActiveSession>`

- [ ] **Step 1: Define DTOs matching Web API Contracts**
- [ ] **Step 2: Implement Retrofit Service & Repositories**
- [ ] **Step 3: Add AuthInterceptor for Bearer Token Handling**

---

### Task 5: Bluetooth Module & ESC/POS Thermal Printing Wrapper

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/bluetooth/BluetoothPrinterManager.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/bluetooth/EscPosCommandBuilder.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/bluetooth/ReceiptTemplateFormatter.kt`
- Test: `app/src/test/java/com/evrenhouse/kasir/bluetooth/EscPosCommandBuilderTest.kt`

**Interfaces:**
- Produces: `BluetoothPrinterManager.scanPairedDevices(): List<BluetoothDevice>`
- Produces: `BluetoothPrinterManager.connect(device: BluetoothDevice): Flow<PrinterConnectionState>`
- Produces: `BluetoothPrinterManager.printReceipt(transaction: Transaction, paperWidth: PaperWidth = 58mm): Result<Unit>`

- [ ] **Step 1: Wrap Existing Bluetooth SPP Socket Connection with Coroutines & StateFlow**
- [ ] **Step 2: Implement ESC/POS Command Builder for 58mm & 80mm**
- [ ] **Step 3: Implement 1:1 Receipt Template Formatter**

---

### Task 6: UI Layer — Tablet Landscape Navigation Shell & Theme

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/theme/Color.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/theme/Theme.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/navigation/NavRoutes.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/navigation/AppNavHost.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/components/AppSidebar.kt`

- [ ] **Step 1: Implement Material3 Dark/Light Theme Matching Web CSS Variables**
- [ ] **Step 2: Create AppSidebar & Landscape Layout Scaffolding**

---

### Task 7: UI Layer — Cashier Login, Role Switcher & Admin Escalation

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/auth/LoginScreen.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/auth/RoleSelectionScreen.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/auth/PasswordVerificationDialog.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/auth/AuthViewModel.kt`

- [ ] **Step 1: Implement RoleSelectionScreen with Avatar Badges**
- [ ] **Step 2: Implement Admin Escalation Interceptor Dialog**

---

### Task 8: UI Layer — Live Rental Dashboard & Active Stations Grid

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/dashboard/DashboardScreen.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/dashboard/SessionCard.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/dashboard/StartRentalDialog.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/dashboard/DashboardViewModel.kt`

- [ ] **Step 1: Implement Live Timer & Dynamic Overtime Badge in SessionCard**
- [ ] **Step 2: Implement StartRentalDialog**

---

### Task 9: UI Layer — Calculate Rental Modal, 10:59 Overtime & Partial Return Splitter

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/rental/CalculateRentalDialog.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/rental/ItemCalculationRow.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/rental/RentalViewModel.kt`

- [ ] **Step 1: Implement CalculateRentalDialog**
- [ ] **Step 2: Wire CalculateRentalUseCase to State**

---

### Task 10: UI Layer — Payment Modal & Bluetooth Receipt Printing Handoff

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/payment/PaymentDialog.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/payment/QrPaymentView.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/payment/PaymentViewModel.kt`

- [ ] **Step 1: Implement PaymentDialog**
- [ ] **Step 2: Connect Print Handoff on Successful Checkout**

---

### Task 11: UI Layer — History Tab (Shift-Grouped) & Deletion Audit Log

**Files:**
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/history/HistoryScreen.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/history/DeletionLogScreen.kt`
- Create: `app/src/main/java/com/evrenhouse/kasir/ui/history/HistoryViewModel.kt`

- [ ] **Step 1: Implement HistoryScreen with Shift Grouping**
- [ ] **Step 2: Implement Reprint Receipt & Admin Delete Transaction Dialog**

---

### Task 12: CI/CD & GitHub Actions Workflow for Android Build

**Files:**
- Create: `.github/workflows/android-build.yml`

- [ ] **Step 1: Create GitHub Actions Workflow for Debug APK Build & Unit Tests**
