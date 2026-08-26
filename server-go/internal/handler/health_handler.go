package handler

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"runtime"
	"time"
)

type DatabaseHealth struct {
	Status    string  `json:"status"`
	LatencyMs float64 `json:"latency_ms,omitempty"`
	Error     string  `json:"error,omitempty"`
}

type RealtimeHealth struct {
	Status            string `json:"status"`
	ActiveConnections int    `json:"active_connections"`
}

type SystemHealth struct {
	Goroutines    int     `json:"goroutines"`
	MemoryAllocMB float64 `json:"memory_alloc_mb"`
	TotalAllocMB  float64 `json:"total_alloc_mb"`
	SysMemoryMB   float64 `json:"sys_memory_mb"`
	GCRuns        uint32  `json:"gc_runs"`
}

type HealthResponse struct {
	Status        string         `json:"status"`
	CheckType     string         `json:"check_type"`
	Service       string         `json:"service"`
	Version       string         `json:"version"`
	Timestamp     string         `json:"timestamp"`
	Uptime        string         `json:"uptime"`
	UptimeSeconds int64          `json:"uptime_seconds"`
	Database      DatabaseHealth `json:"database"`
	Realtime      RealtimeHealth `json:"realtime"`
	System        SystemHealth   `json:"system"`
}

// HandleHealth serves as the Liveness Probe (process is alive and running)
func (h *Handler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	toMB := func(bytes uint64) float64 {
		return math.Round(float64(bytes)/1024/1024*100) / 100
	}

	uptimeDuration := time.Since(h.StartTime)
	uptimeSeconds := int64(uptimeDuration.Seconds())

	realtimeClients := 0
	if h.Hub != nil {
		realtimeClients = h.Hub.ActiveClientsCount()
	}

	if r.URL.Query().Get("format") == "plain" {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintf(w, "OK (liveness: %s)\n", uptimeDuration.Round(time.Second).String())
		return
	}

	resp := HealthResponse{
		Status:        "ok",
		CheckType:     "liveness",
		Service:       "kasir-foss-backend",
		Version:       "1.0.0",
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		Uptime:        uptimeDuration.Round(time.Second).String(),
		UptimeSeconds: uptimeSeconds,
		Database: DatabaseHealth{
			Status: "configured",
		},
		Realtime: RealtimeHealth{
			Status:            "running",
			ActiveConnections: realtimeClients,
		},
		System: SystemHealth{
			Goroutines:    runtime.NumGoroutine(),
			MemoryAllocMB: toMB(m.Alloc),
			TotalAllocMB:  toMB(m.TotalAlloc),
			SysMemoryMB:   toMB(m.Sys),
			GCRuns:        m.NumGC,
		},
	}

	h.writeJSON(w, http.StatusOK, resp)
}

// HandleReady serves as the Readiness Probe (database connected & ready for traffic)
func (h *Handler) HandleReady(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	dbHealth := DatabaseHealth{
		Status: "connected",
	}

	dbHealthy := true
	if h.DB != nil {
		start := time.Now()
		if err := h.DB.Ping(ctx); err != nil {
			dbHealthy = false
			dbHealth.Status = "disconnected"
			dbHealth.Error = err.Error()
		} else {
			latency := time.Since(start).Seconds() * 1000
			dbHealth.LatencyMs = math.Round(latency*100) / 100
		}
	} else {
		dbHealthy = false
		dbHealth.Status = "not_configured"
		dbHealth.Error = "database connection pool is nil"
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	toMB := func(bytes uint64) float64 {
		return math.Round(float64(bytes)/1024/1024*100) / 100
	}

	uptimeDuration := time.Since(h.StartTime)
	uptimeSeconds := int64(uptimeDuration.Seconds())

	realtimeClients := 0
	if h.Hub != nil {
		realtimeClients = h.Hub.ActiveClientsCount()
	}

	statusCode := http.StatusOK
	overallStatus := "ready"
	if !dbHealthy {
		statusCode = http.StatusServiceUnavailable
		overallStatus = "not_ready"
	}

	if r.URL.Query().Get("format") == "plain" {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(statusCode)
		if dbHealthy {
			_, _ = fmt.Fprintf(w, "READY (database latency: %.2fms)\n", dbHealth.LatencyMs)
		} else {
			_, _ = fmt.Fprintf(w, "NOT_READY: %s\n", dbHealth.Error)
		}
		return
	}

	resp := HealthResponse{
		Status:        overallStatus,
		CheckType:     "readiness",
		Service:       "kasir-foss-backend",
		Version:       "1.0.0",
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		Uptime:        uptimeDuration.Round(time.Second).String(),
		UptimeSeconds: uptimeSeconds,
		Database:      dbHealth,
		Realtime: RealtimeHealth{
			Status:            "running",
			ActiveConnections: realtimeClients,
		},
		System: SystemHealth{
			Goroutines:    runtime.NumGoroutine(),
			MemoryAllocMB: toMB(m.Alloc),
			TotalAllocMB:  toMB(m.TotalAlloc),
			SysMemoryMB:   toMB(m.Sys),
			GCRuns:        m.NumGC,
		},
	}

	h.writeJSON(w, statusCode, resp)
}
