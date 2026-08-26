package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

func TestRateLimiter_AllowAndBlock(t *testing.T) {
	// 2 requests burst, 1 request per second
	limiter := NewIPRateLimiter(rate.Limit(1), 2, 10*time.Minute)

	handler := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}))

	// 1st request -> allowed
	req1 := httptest.NewRequest(http.MethodPost, "/api/login/cashier", nil)
	req1.RemoteAddr = "203.0.113.10:1234"
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on 1st request, got %d", rr1.Code)
	}

	// 2nd request -> allowed (burst = 2)
	req2 := httptest.NewRequest(http.MethodPost, "/api/login/cashier", nil)
	req2.RemoteAddr = "203.0.113.10:1234"
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on 2nd request, got %d", rr2.Code)
	}

	// 3rd rapid request -> blocked (429)
	req3 := httptest.NewRequest(http.MethodPost, "/api/login/cashier", nil)
	req3.RemoteAddr = "203.0.113.10:1234"
	rr3 := httptest.NewRecorder()
	handler.ServeHTTP(rr3, req3)
	if rr3.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests on 3rd request, got %d", rr3.Code)
	}
	if rr3.Header().Get("Retry-After") != "5" {
		t.Errorf("expected Retry-After 5, got %s", rr3.Header().Get("Retry-After"))
	}

	// Different IP -> allowed
	reqOther := httptest.NewRequest(http.MethodPost, "/api/login/cashier", nil)
	reqOther.RemoteAddr = "198.51.100.5:5678"
	rrOther := httptest.NewRecorder()
	handler.ServeHTTP(rrOther, reqOther)
	if rrOther.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for different IP, got %d", rrOther.Code)
	}
}

func TestAuth_CookieIssuedAndAccepted(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	// Mock token query for cookie auth
	mockAuthSession(mock, "cookie-token-123", "cashier1", "cashier", "outlet-1")

	router := NewRouter(h)

	// Protected request using Cookie instead of Authorization Header
	req := httptest.NewRequest(http.MethodGet, "/api/sessions?outlet_id=outlet-1", nil)
	req.AddCookie(&http.Cookie{
		Name:  "auth_token",
		Value: "cookie-token-123",
	})
	rr := httptest.NewRecorder()

	now := time.Now()
	rows := mock.NewRows([]string{"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at"}).
		AddRow("s-1", "outlet-1", 1, "Budi", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash", &now)
	mock.ExpectQuery(`SELECT id, outlet_id, queue_no, COALESCE\(nama, ''\), items, COALESCE\(start_time, 0\), COALESCE\(tanggal, ''\), COALESCE\(pay_awal, 'cash'\), created_at FROM active_sessions WHERE outlet_id = \$1`).
		WithArgs("outlet-1").
		WillReturnRows(rows)

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK with cookie authentication, got %d: %s", rr.Code, rr.Body.String())
	}
}
