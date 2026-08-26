package main

import (
	"context"
	"errors"
	"fmt"
	"log"
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
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	log.Printf("Connecting to database at %s...", cfg.DatabaseURL)
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize database pool: %v", err)
	}
	defer pool.Close()

	log.Println("Database connection pool established successfully.")

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
		log.Printf("Kasir Backend server running on http://0.0.0.0:%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	// Graceful shutdown handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		log.Fatalf("Server startup failed: %v", err)
	case sig := <-quit:
		log.Printf("Received signal %s, initiating graceful shutdown...", sig)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Kasir Backend server stopped cleanly.")
}
