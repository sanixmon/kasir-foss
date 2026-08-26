package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func CorsMiddleware(origin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqOrigin := r.Header.Get("Origin")
			if origin != "" && origin != "*" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			} else if reqOrigin != "" {
				w.Header().Set("Access-Control-Allow-Origin", reqOrigin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			} else {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Outlet-ID")

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

	// Monitoring & Health Check
	r.Get("/health", h.HandleHealth)
	r.Get("/api/health", h.HandleHealth)

	// SSE Realtime Stream
	r.Get("/api/stream", h.HandleStream)

	// API Routes
	r.Route("/api", func(api chi.Router) {
		// Public Auth Endpoints
		api.Post("/login/cashier", h.LoginCashier)
		api.Post("/login/admin", h.LoginAdmin)
		api.Post("/verify-admin", h.VerifyAdmin)

		// Public Tracking & Outlets Query
		api.Get("/track/{id}", h.TrackSession)
		api.Get("/track-session", h.TrackSession)
		api.Get("/outlets", h.GetOutlets)
		api.Get("/outlets/{id}", h.GetOutletByID)

		// Legacy Action Endpoints (Auth checked internally per action)
		api.Get("/fetch-all", h.FetchAllData)
		api.Get("/data", h.FetchAllData)
		api.Get("/", h.FetchAllData)
		api.Post("/", h.HandleLegacyAction)

		// Protected REST Routes (Require valid cashier / user session)
		api.Group(func(auth chi.Router) {
			auth.Use(h.RequireAuth)

			// Sessions & Claims
			auth.Get("/sessions", h.GetSessions)
			auth.Post("/sessions", h.AddSession)
			auth.Get("/sessions/{id}", h.GetSessionByID)
			auth.Put("/sessions/{id}", h.EditSession)
			auth.Delete("/sessions/{id}", h.DeleteSession)
			auth.Post("/claim", h.ClaimSession)
			auth.Post("/claim-session", h.ClaimSession)

			// Transactions & Logs
			auth.Get("/transactions", h.GetTransactions)
			auth.Get("/transactions/{id}", h.GetTransactionByID)
			auth.Get("/deletion-logs", h.GetDeletionLogs)
			auth.Post("/deletion-logs", h.AddDeletionLog)

			// Settings read
			auth.Get("/settings", h.GetSettings)
		})

		// Admin-Only REST Routes
		api.Group(func(admin chi.Router) {
			admin.Use(h.RequireAdmin)

			// Outlets Management
			admin.Post("/outlets", h.CreateOutlet)
			admin.Delete("/outlets/{id}", h.DeleteOutlet)

			// Transactions & Deletion
			admin.Delete("/transactions", h.DeleteTxn)
			admin.Delete("/transactions/{id}", h.DeleteTxn)
			admin.Post("/transactions/clear-all", h.ClearAllTxns)

			// Settings & Passwords
			admin.Post("/settings", h.SaveSetting)
			admin.Post("/change-admin-pass", h.ChangeAdminPassword)

			// User Management
			admin.Get("/users", h.GetUsers)
			admin.Post("/users", h.SaveUser)
			admin.Delete("/users/{username}", h.DeleteUser)
		})
	})

	// Root-level legacy fallback
	r.Get("/", h.FetchAllData)
	r.Post("/", h.HandleLegacyAction)

	return r
}
