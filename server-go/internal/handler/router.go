package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func CorsMiddleware(origin string) func(http.Handler) http.Handler {
	if origin == "" {
		origin = "*"
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func NewRouter(h *Handler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(CorsMiddleware(h.Config.CorsOrigin))

	// Health Check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// SSE Realtime Stream
	r.Get("/api/stream", h.HandleStream)

	// API Routes
	r.Route("/api", func(api chi.Router) {
		// Outlets
		api.Get("/outlets", h.GetOutlets)
		api.Post("/outlets", h.CreateOutlet)
		api.Get("/outlets/{id}", h.GetOutletByID)
		api.Delete("/outlets/{id}", h.DeleteOutlet)

		// Sessions
		api.Get("/sessions", h.GetSessions)
		api.Post("/sessions", h.AddSession)
		api.Get("/sessions/{id}", h.GetSessionByID)
		api.Put("/sessions/{id}", h.EditSession)
		api.Delete("/sessions/{id}", h.DeleteSession)
		api.Post("/claim", h.ClaimSession)
		api.Post("/claim-session", h.ClaimSession)

		// Transactions
		api.Get("/transactions", h.GetTransactions)
		api.Delete("/transactions", h.DeleteTxn)
		api.Get("/transactions/{id}", h.GetTransactionByID)
		api.Delete("/transactions/{id}", h.DeleteTxn)
		api.Post("/transactions/clear-all", h.ClearAllTxns)

		// Deletion logs
		api.Get("/deletion-logs", h.GetDeletionLogs)
		api.Post("/deletion-logs", h.AddDeletionLog)

		// Settings & full dataset
		api.Get("/settings", h.GetSettings)
		api.Post("/settings", h.SaveSetting)
		api.Get("/fetch-all", h.FetchAllData)
		api.Get("/data", h.FetchAllData)

		// Auth & User Management
		api.Post("/login/cashier", h.LoginCashier)
		api.Post("/login/admin", h.LoginAdmin)
		api.Post("/verify-admin", h.VerifyAdmin)
		api.Post("/change-admin-pass", h.ChangeAdminPassword)
		api.Get("/users", h.GetUsers)
		api.Post("/users", h.SaveUser)
		api.Delete("/users/{username}", h.DeleteUser)

		// Customer tracking
		api.Get("/track/{id}", h.TrackSession)
		api.Get("/track-session", h.TrackSession)

		// Legacy action endpoints
		api.Get("/", h.FetchAllData)
		api.Post("/", h.HandleLegacyAction)
	})

	// Root-level legacy fallback
	r.Get("/", h.FetchAllData)
	r.Post("/", h.HandleLegacyAction)

	return r
}
