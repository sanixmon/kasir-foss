package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type LoginResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token"`
	Error   string `json:"error"`
}

func main() {
	baseURL := flag.String("base", "http://localhost:8080", "Base API server URL")
	targetPath := flag.String("path", "/api/claim", "Target path to load test (e.g. /api/claim, /ready, /health)")
	concurrency := flag.Int("c", 200, "Number of concurrent workers")
	totalRequests := flag.Int("n", 2000, "Total number of requests to execute")
	username := flag.String("user", "cashier1", "Cashier username for auth")
	password := flag.String("pass", "cashier123", "Cashier password for auth")
	outletID := flag.String("outlet", "outlet-1", "Outlet ID")
	tokenFlag := flag.String("token", "", "Pre-existing auth token (optional)")
	simulateIPs := flag.Int("ips", 50, "Number of unique client IPs to simulate")
	flag.Parse()

	targetURL := *baseURL + *targetPath
	fmt.Printf("🚀 Starting Kasir FOSS Enterprise Load Test\n")
	fmt.Printf("🎯 Target:      %s\n", targetURL)
	fmt.Printf("👥 Concurrency: %d workers | Total Requests: %d\n", *concurrency, *totalRequests)
	fmt.Printf("🏢 Outlet:      %s | Simulated Client IPs: %d\n", *outletID, *simulateIPs)

	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        *concurrency * 2,
			MaxIdleConnsPerHost: *concurrency * 2,
			IdleConnTimeout:     60 * time.Second,
		},
	}

	// 1. Acquire Auth Token if testing protected endpoints
	token := *tokenFlag
	isClaimEndpoint := strings.Contains(targetURL, "/api/claim") || strings.Contains(targetURL, "/sessions") || strings.Contains(targetURL, "/transactions")
	if token == "" && isClaimEndpoint {
		fmt.Printf("🔑 Logging in to retrieve auth token for user '%s'...\n", *username)
		loginPayload := map[string]string{
			"username": *username,
			"password": *password,
			"outletId": *outletID,
		}
		bodyBytes, _ := json.Marshal(loginPayload)
		resp, err := client.Post(*baseURL+"/api/login/cashier", "application/json", bytes.NewReader(bodyBytes))
		if err != nil {
			fmt.Printf("⚠️  Auto-login failed: %v (continuing with simulated mock token)\n", err)
			token = "mock-token-loadtest"
		} else {
			defer resp.Body.Close()
			var loginResp LoginResponse
			_ = json.NewDecoder(resp.Body).Decode(&loginResp)
			if loginResp.Token != "" {
				token = loginResp.Token
				fmt.Printf(" Authentication successful! Token acquired: %s...\n", token[:min(16, len(token))])
			} else {
				fmt.Printf("⚠️  Login endpoint returned: %+v (continuing with fallback token)\n", loginResp)
				token = "mock-token-loadtest"
			}
		}
	}

	var (
		status2xx int64
		status401 int64
		status429 int64
		status5xx int64
		otherErr  int64

		latenciesMu sync.Mutex
		latencies   = make([]time.Duration, 0, *totalRequests)

		wg      sync.WaitGroup
		reqChan = make(chan struct{}, *totalRequests)
	)

	for i := 0; i < *totalRequests; i++ {
		reqChan <- struct{}{}
	}
	close(reqChan)

	start := time.Now()

	for i := 0; i < *concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for range reqChan {
				var req *http.Request
				var reqErr error

				if isClaimEndpoint {
					// Prepare realistic transactional checkout payload
					claimPayload := map[string]any{
						"outletId": *outletID,
						"nama":     fmt.Sprintf("LoadUser-%d", workerID),
						"items": []map[string]any{
							{
								"nama":  "Rental PS5 1 Jam",
								"qty":   1,
								"harga": 25000,
							},
						},
						"bayar": 25000,
					}
					payloadBytes, _ := json.Marshal(claimPayload)
					req, reqErr = http.NewRequest(http.MethodPost, targetURL, bytes.NewReader(payloadBytes))
					if req != nil {
						req.Header.Set("Content-Type", "application/json")
					}
				} else {
					req, reqErr = http.NewRequest(http.MethodGet, targetURL, nil)
				}

				if reqErr != nil {
					atomic.AddInt64(&otherErr, 1)
					continue
				}

				// Auth Headers & Cookies
				if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
					req.AddCookie(&http.Cookie{
						Name:  "auth_token",
						Value: token,
						Path:  "/",
					})
				}
				req.Header.Set("X-Outlet-ID", *outletID)

				// Simulate unique client IP rotation to test rate limiter per IP
				ipSuffix := (workerID % *simulateIPs) + 1
				req.Header.Set("X-Forwarded-For", fmt.Sprintf("192.168.1.%d", ipSuffix))
				req.Header.Set("X-Real-IP", fmt.Sprintf("192.168.1.%d", ipSuffix))

				t0 := time.Now()
				resp, err := client.Do(req)
				latency := time.Since(t0)

				if err != nil {
					atomic.AddInt64(&otherErr, 1)
					continue
				}

				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()

				latenciesMu.Lock()
				latencies = append(latencies, latency)
				latenciesMu.Unlock()

				switch {
				case resp.StatusCode >= 200 && resp.StatusCode < 300:
					atomic.AddInt64(&status2xx, 1)
				case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
					atomic.AddInt64(&status401, 1)
				case resp.StatusCode == http.StatusTooManyRequests:
					atomic.AddInt64(&status429, 1)
				case resp.StatusCode >= 500:
					atomic.AddInt64(&status5xx, 1)
				default:
					atomic.AddInt64(&otherErr, 1)
				}
			}
		}(i)
	}

	wg.Wait()
	totalDuration := time.Since(start)

	// Calculate Latency Percentiles
	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	var p50, p95, p99, minLat, maxLat, avgLat time.Duration
	if len(latencies) > 0 {
		minLat = latencies[0]
		maxLat = latencies[len(latencies)-1]
		p50 = latencies[len(latencies)*50/100]
		p95 = latencies[len(latencies)*95/100]
		p99 = latencies[len(latencies)*99/100]

		var sum time.Duration
		for _, l := range latencies {
			sum += l
		}
		avgLat = sum / time.Duration(len(latencies))
	}

	rps := float64(len(latencies)) / totalDuration.Seconds()

	fmt.Println("\n=================== LOAD TEST RESULTS ===================")
	fmt.Printf("⏱️  Total Duration:       %v\n", totalDuration.Round(time.Millisecond))
	fmt.Printf("⚡ Throughput:           %.2f req/sec\n", rps)
	fmt.Println("---------------------------------------------------------")
	fmt.Printf("📊 Latency (avg):        %v\n", avgLat.Round(time.Microsecond))
	fmt.Printf("📊 Latency (min / max):  %v / %v\n", minLat.Round(time.Microsecond), maxLat.Round(time.Microsecond))
	fmt.Printf("📊 Latency (p50):        %v\n", p50.Round(time.Microsecond))
	fmt.Printf("📊 Latency (p95):        %v\n", p95.Round(time.Microsecond))
	fmt.Printf("📊 Latency (p99):        %v\n", p99.Round(time.Microsecond))
	fmt.Println("---------------------------------------------------------")
	fmt.Printf("✅ Success (2xx):         %d\n", status2xx)
	fmt.Printf("🛑 Rate Limited (429):    %d\n", status429)
	fmt.Printf("🔒 Unauthorized (401):    %d\n", status401)
	fmt.Printf("❌ Server Error (5xx):    %d\n", status5xx)
	fmt.Printf("⚠️  Network / Other:       %d\n", otherErr)
	fmt.Println("=========================================================")

	if status5xx > 0 {
		fmt.Println("⚠️  WARNING: Encountered 5xx errors! Check server database connection pool.")
	} else if p95 < 10*time.Millisecond {
		fmt.Println("🎉 EXCELLENT: Sub-10ms p95 latency and 0 server errors achieved under 200 concurrency!")
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
