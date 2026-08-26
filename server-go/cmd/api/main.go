package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"kasir-backend/internal/config"
	"kasir-backend/internal/database"
	"kasir-backend/internal/handler"
	"kasir-backend/internal/realtime"
	"kasir-backend/internal/repository"
)

func main() {
	handler.InitStructuredLogger()
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	slog.Info("Connecting to PostgreSQL database", "url", cfg.DatabaseURL)
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("Failed to initialize database pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	slog.Info("Database connection pool established successfully")

	// Initialize repositories
	outletRepo := repository.NewOutletRepository(pool)
	sessionRepo := repository.NewSessionRepository(pool)
	txnRepo := repository.NewTxnRepository(pool)
	authRepo := repository.NewAuthRepository(pool)
	settingRepo := repository.NewSettingRepository(pool)

	// Initialize Realtime SSE Hub
	hub := realtime.NewHub()
	go hub.Run()

	// Initialize Handlers & Router
	h := handler.NewHandler(outletRepo, sessionRepo, txnRepo, authRepo, settingRepo, pool, hub, cfg)
	router := handler.NewRouter(h)

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // Disabled to allow permanent SSE real-time streaming
		IdleTimeout:  120 * time.Second,
	}

	// Server startup in background goroutine
	serverErr := make(chan error, 1)
	go func() {
		if cfg.TLSCertFile != "" && cfg.TLSKeyFile != "" {
			slog.Info("Kasir Backend HTTPS server running with TLS", "port", cfg.Port, "cert", cfg.TLSCertFile)
			if err := srv.ListenAndServeTLS(cfg.TLSCertFile, cfg.TLSKeyFile); err != nil && !errors.Is(err, http.ErrServerClosed) {
				serverErr <- err
			}
		} else {
			slog.Info("Kasir Backend HTTP server running", "port", cfg.Port, "addr", "http://0.0.0.0:"+cfg.Port)
			if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				serverErr <- err
			}
		}
	}()

	// Graceful shutdown handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		slog.Error("Server startup failed", "error", err)
		os.Exit(1)
	case sig := <-quit:
		slog.Info("Received termination signal, initiating graceful shutdown", "signal", sig.String())
	}

	// 1. Notify all active SSE clients so they can pause and prepare reconnection
	hub.BroadcastShutdown()
	time.Sleep(100 * time.Millisecond)

	// 2. Allow up to 30 seconds for active HTTP requests and in-flight transactions to drain
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Kasir Backend server stopped cleanly.")
}
