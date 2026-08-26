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
	Service       string         `json:"service"`
	Version       string         `json:"version"`
	Timestamp     string         `json:"timestamp"`
	Uptime        string         `json:"uptime"`
	UptimeSeconds int64          `json:"uptime_seconds"`
	Database      DatabaseHealth `json:"database"`
	Realtime      RealtimeHealth `json:"realtime"`
	System        SystemHealth   `json:"system"`
}

func (h *Handler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	// 1. Check Database Connectivity & Latency
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
		dbHealth.Status = "not_configured"
	}

	// 2. Realtime SSE Hub Status
	realtimeClients := 0
	if h.Hub != nil {
		realtimeClients = h.Hub.ActiveClientsCount()
	}

	// 3. System Runtime Stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	toMB := func(bytes uint64) float64 {
		return math.Round(float64(bytes)/1024/1024*100) / 100
	}

	uptimeDuration := time.Since(h.StartTime)
	uptimeSeconds := int64(uptimeDuration.Seconds())

	overallStatus := "ok"
	statusCode := http.StatusOK
	if !dbHealthy {
		overallStatus = "unhealthy"
		statusCode = http.StatusServiceUnavailable
	}

	// Support plaintext response for simple load-balancer probes
	if r.URL.Query().Get("format") == "plain" {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(statusCode)
		if dbHealthy {
			_, _ = fmt.Fprintf(w, "OK (uptime: %s)\n", uptimeDuration.Round(time.Second).String())
		} else {
			_, _ = fmt.Fprintf(w, "UNHEALTHY: %s\n", dbHealth.Error)
		}
		return
	}

	resp := HealthResponse{
		Status:        overallStatus,
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
