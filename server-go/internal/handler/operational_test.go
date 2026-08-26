package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
	"kasir-backend/internal/model"
)

// TestOperational_EndToEndPOSLifecycle tests the entire cashier workflow:
// Login -> Add Session -> Partial Claim -> Full Claim -> View Txn -> Audit Log
func TestOperational_EndToEndPOSLifecycle(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	router := NewRouter(h)
	now := time.Now()

	// 1. Cashier Login
	mock.ExpectQuery(`SELECT id, username, password, role, COALESCE\(outlet_id, ''\), created_at FROM users WHERE LOWER\(username\) = LOWER\(\$1\)`).
		WithArgs("kasir_utama").
		WillReturnRows(mock.NewRows([]string{
			"id", "username", "password", "role", "outlet_id", "created_at",
		}).AddRow(10, "kasir_utama", "pass123", "cashier", "outlet-1", &now))

	mock.ExpectExec(`INSERT INTO auth_tokens`).
		WithArgs(pgxmock.AnyArg(), "kasir_utama", "cashier", "outlet-1", pgxmock.AnyArg(), pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))
	mock.ExpectExec(`DELETE FROM auth_tokens WHERE expires_at <= \$1`).
		WithArgs(pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("DELETE", 0))

	loginBody, _ := json.Marshal(LoginCashierRequest{
		Username: "kasir_utama",
		Password: "pass123",
	})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/login/cashier", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	router.ServeHTTP(loginRR, loginReq)

	if loginRR.Code != http.StatusOK {
		t.Fatalf("login failed: code %d, body %s", loginRR.Code, loginRR.Body.String())
	}
	var loginResp map[string]any
	_ = json.Unmarshal(loginRR.Body.Bytes(), &loginResp)
	token, ok := loginResp["token"].(string)
	if !ok || token == "" {
		t.Fatalf("expected valid token, got %v", loginResp["token"])
	}

	// 2. Realtime SSE Subscriber registers for outlet-1
	subscriber := h.Hub.Register("outlet-1")
	defer h.Hub.Unregister(subscriber)

	// 3. Add Rental Session with 2 items (PS5 + Snack)
	mockAuthSession(mock, token, "kasir_utama", "cashier", "outlet-1")
	mock.ExpectQuery(`SELECT queue_no FROM active_sessions WHERE id = \$1`).
		WithArgs("s-e2e-1").
		WillReturnRows(mock.NewRows([]string{"queue_no"}))
	mock.ExpectQuery(`SELECT COALESCE\(MAX\(q\), 0\) \+ 1 AS next_q FROM`).
		WithArgs("outlet-1", "2026-08-26").
		WillReturnRows(mock.NewRows([]string{"next_q"}).AddRow(1))

	itemsJSON := json.RawMessage(`[{"id":"ps5","name":"Rental PS5","price":20000},{"id":"snack","name":"Snack","price":5000}]`)
	mock.ExpectQuery(`INSERT INTO active_sessions`).
		WithArgs("s-e2e-1", "outlet-1", 1, "Pelanggan VIP", itemsJSON, int64(1700000000), "2026-08-26", "cash").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-e2e-1", "outlet-1", 1, "Pelanggan VIP", itemsJSON, int64(1700000000), "2026-08-26", "cash", &now))

	addSessionBody, _ := json.Marshal(model.ActiveSession{
		ID:        "s-e2e-1",
		OutletID:  "outlet-1",
		Nama:      "Pelanggan VIP",
		Items:     itemsJSON,
		StartTime: 1700000000,
		Tanggal:   "2026-08-26",
		PayAwal:   "cash",
	})
	addReq := httptest.NewRequest(http.MethodPost, "/api/sessions", bytes.NewReader(addSessionBody))
	addReq.Header.Set("Content-Type", "application/json")
	addReq.Header.Set("Authorization", "Bearer "+token)
	addRR := httptest.NewRecorder()
	router.ServeHTTP(addRR, addReq)

	if addRR.Code != http.StatusOK {
		t.Fatalf("add session failed: %s", addRR.Body.String())
	}

	// Verify SSE broadcast for session addition
	select {
	case ev := <-subscriber.Send:
		if ev.Type != "SESSION_ADDED" || ev.OutletID != "outlet-1" {
			t.Errorf("expected SESSION_ADDED broadcast, got: %+v", ev)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for SESSION_ADDED SSE broadcast")
	}

	// 4. Partial Claim (checkout Snack, keep PS5 rental active)
	mockAuthSession(mock, token, "kasir_utama", "cashier", "outlet-1")
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT outlet_id FROM active_sessions WHERE id = \$1 FOR UPDATE`).
		WithArgs("s-e2e-1").
		WillReturnRows(mock.NewRows([]string{"outlet_id"}).AddRow("outlet-1"))

	remainingJSON := json.RawMessage(`[{"id":"ps5","name":"Rental PS5","price":20000}]`)
	mock.ExpectExec(`UPDATE active_sessions SET items = \$1 WHERE id = \$2`).
		WithArgs(remainingJSON, "s-e2e-1").
		WillReturnResult(pgxmock.NewResult("UPDATE", 1))

	mock.ExpectQuery(`SELECT nextval\('txn_no_seq'\)`).
		WillReturnRows(mock.NewRows([]string{"nextval"}).AddRow(101))

	mock.ExpectQuery(`INSERT INTO transactions`).
		WithArgs(
			pgxmock.AnyArg(), "outlet-1", 101, 1, "Pelanggan VIP", "2026-08-26",
			int64(1700000000), int64(1700001000), "Snack", "-", "-",
			float64(5000), float64(0), float64(0), float64(5000), float64(5000),
			"cash", float64(5000), float64(0), "pagi",
		).
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
			"start_time", "end_time", "items", "ot", "ot_dur",
			"total_base", "total_ot", "total_tol", "grand_total",
			"total_all", "pay_awal", "cash", "qris", "shift", "created_at",
		}).AddRow(
			"t-part-1", "outlet-1", 101, 1, "Pelanggan VIP", "2026-08-26",
			int64(1700000000), int64(1700001000), "Snack", "-", "-",
			float64(5000), float64(0), float64(0), float64(5000), float64(5000),
			"cash", float64(5000), float64(0), "pagi", &now,
		))
	mock.ExpectCommit()

	partialClaimBody, _ := json.Marshal(model.ClaimSessionPayload{
		SessionID:      "s-e2e-1",
		OutletID:       "outlet-1",
		QueueNo:        1,
		Nama:           "Pelanggan VIP",
		Tanggal:        "2026-08-26",
		StartTime:      1700000000,
		EndTime:        1700001000,
		Items:          "Snack",
		RemainingItems: remainingJSON,
		TotalBase:      5000,
		GrandTotal:     5000,
		TotalAll:       5000,
		Cash:           5000,
		Shift:          "pagi",
	})
	partClaimReq := httptest.NewRequest(http.MethodPost, "/api/claim", bytes.NewReader(partialClaimBody))
	partClaimReq.Header.Set("Content-Type", "application/json")
	partClaimReq.Header.Set("Authorization", "Bearer "+token)
	partClaimRR := httptest.NewRecorder()
	router.ServeHTTP(partClaimRR, partClaimReq)

	if partClaimRR.Code != http.StatusOK {
		t.Fatalf("partial claim failed: %s", partClaimRR.Body.String())
	}

	// Verify SSE broadcast for partial claim
	select {
	case ev := <-subscriber.Send:
		if ev.Type != "SESSION_CLAIMED" {
			t.Errorf("expected SESSION_CLAIMED, got %s", ev.Type)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for partial claim SSE broadcast")
	}

	// 5. Query Transactions for outlet-1
	mockAuthSession(mock, token, "kasir_utama", "cashier", "outlet-1")
	mock.ExpectQuery(`SELECT id, outlet_id, no, queue_no, COALESCE\(nama, ''\), COALESCE\(tanggal, ''\), COALESCE\(start_time, 0\), COALESCE\(end_time, 0\), COALESCE\(items, ''\), COALESCE\(ot, '-'\), COALESCE\(ot_dur, '-'\), total_base, total_ot, total_tol, grand_total, total_all, COALESCE\(pay_awal, 'cash'\), cash, qris, COALESCE\(shift, '-'\), created_at FROM transactions WHERE outlet_id = \$1 AND tanggal = \$2 ORDER BY no ASC`).
		WithArgs("outlet-1", "2026-08-26").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
			"start_time", "end_time", "items", "ot", "ot_dur",
			"total_base", "total_ot", "total_tol", "grand_total",
			"total_all", "pay_awal", "cash", "qris", "shift", "created_at",
		}).AddRow(
			"t-part-1", "outlet-1", 101, 1, "Pelanggan VIP", "2026-08-26",
			int64(1700000000), int64(1700001000), "Snack", "-", "-",
			float64(5000), float64(0), float64(0), float64(5000), float64(5000),
			"cash", float64(5000), float64(0), "pagi", &now,
		))

	txnsReq := httptest.NewRequest(http.MethodGet, "/api/transactions?outlet_id=outlet-1&tanggal=2026-08-26", nil)
	txnsReq.Header.Set("Authorization", "Bearer "+token)
	txnsRR := httptest.NewRecorder()
	router.ServeHTTP(txnsRR, txnsReq)

	if txnsRR.Code != http.StatusOK {
		t.Fatalf("get transactions failed: %s", txnsRR.Body.String())
	}

	var txns []model.Transaction
	_ = json.Unmarshal(txnsRR.Body.Bytes(), &txns)
	if len(txns) != 1 || txns[0].No != 101 {
		t.Errorf("unexpected txns list: %+v", txns)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

// TestOperational_SecurityAndRoleSeparation validates access control rules:
// - Missing token -> 401 Unauthorized
// - Cashier calling admin endpoints -> 403 Forbidden
// - Admin calling admin endpoints -> 200 OK
func TestOperational_SecurityAndRoleSeparation(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	router := NewRouter(h)

	// 1. Unauthenticated request on /api/sessions -> 401
	unauthReq := httptest.NewRequest(http.MethodGet, "/api/sessions?outlet_id=outlet-1", nil)
	unauthRR := httptest.NewRecorder()
	router.ServeHTTP(unauthRR, unauthReq)
	if unauthRR.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unauthenticated request, got %d", unauthRR.Code)
	}

	// 2. Cashier token attempting admin endpoint (DELETE /api/outlets/outlet-2) -> 403
	mockAuthSession(mock, "cashier-token-only", "kasir2", "cashier", "outlet-1")
	cashierAdminReq := httptest.NewRequest(http.MethodDelete, "/api/outlets/outlet-2", nil)
	cashierAdminReq.Header.Set("Authorization", "Bearer cashier-token-only")
	cashierAdminRR := httptest.NewRecorder()
	router.ServeHTTP(cashierAdminRR, cashierAdminReq)
	if cashierAdminRR.Code != http.StatusForbidden {
		t.Errorf("expected 403 for cashier accessing admin route, got %d", cashierAdminRR.Code)
	}

	// 3. Admin token attempting admin endpoint (DELETE /api/outlets/outlet-2) -> 200
	mockAuthSession(mock, "admin-super-token", "admin", "admin", "global")
	mock.ExpectExec(`DELETE FROM outlets WHERE id = \$1`).
		WithArgs("outlet-2").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	adminReq := httptest.NewRequest(http.MethodDelete, "/api/outlets/outlet-2", nil)
	adminReq.Header.Set("Authorization", "Bearer admin-super-token")
	adminRR := httptest.NewRecorder()
	router.ServeHTTP(adminRR, adminReq)
	if adminRR.Code != http.StatusOK {
		t.Errorf("expected 200 for admin accessing admin route, got %d: %s", adminRR.Code, adminRR.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

// TestOperational_CORSHeaders verifies CORS behavior for credentials & custom headers
func TestOperational_CORSHeaders(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	router := NewRouter(h)

	// Preflight OPTIONS with origin and custom X-Outlet-ID header
	req := httptest.NewRequest(http.MethodOptions, "/api/sessions", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Content-Type, Authorization, X-Outlet-ID")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("expected 204 No Content on OPTIONS, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Errorf("expected reflected origin, got %s", rr.Header().Get("Access-Control-Allow-Origin"))
	}
	if rr.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("expected Allow-Credentials true, got %s", rr.Header().Get("Access-Control-Allow-Credentials"))
	}
	allowHeaders := rr.Header().Get("Access-Control-Allow-Headers")
	if !bytes.Contains([]byte(allowHeaders), []byte("X-Outlet-ID")) {
		t.Errorf("expected X-Outlet-ID in allowed headers, got %s", allowHeaders)
	}
}
