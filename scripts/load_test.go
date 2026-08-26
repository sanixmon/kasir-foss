package main

import (
	"bytes"
	"flag"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	targetURL := flag.String("url", "http://localhost:8080/ready", "Target URL to load test")
	concurrency := flag.Int("c", 200, "Number of concurrent workers")
	totalRequests := flag.Int("n", 2000, "Total number of requests to execute")
	flag.Parse()

	fmt.Printf("🚀 Starting Load Test against: %s\n", *targetURL)
	fmt.Printf("👥 Concurrency: %d workers | Total Requests: %d\n", *concurrency, *totalRequests)

	client := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        *concurrency,
			MaxIdleConnsPerHost: *concurrency,
			IdleConnTimeout:     30 * time.Second,
		},
	}

	var (
		status2xx int64
		status429 int64
		status5xx int64
		otherErr  int64
		wg        sync.WaitGroup
		reqChan   = make(chan struct{}, *totalRequests)
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
				req, err := http.NewRequest(http.MethodGet, *targetURL, bytes.NewBuffer(nil))
				if err != nil {
					atomic.AddInt64(&otherErr, 1)
					continue
				}

				// Simulate unique client IPs to test multi-client concurrency
				req.Header.Set("X-Forwarded-For", fmt.Sprintf("192.168.1.%d", (workerID%50)+1))

				resp, err := client.Do(req)
				if err != nil {
					atomic.AddInt64(&otherErr, 1)
					continue
				}
				_ = resp.Body.Close()

				switch {
				case resp.StatusCode >= 200 && resp.StatusCode < 300:
					atomic.AddInt64(&status2xx, 1)
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
	duration := time.Since(start)

	rps := float64(*totalRequests) / duration.Seconds()

	fmt.Println("\n================= LOAD TEST REPORT =================")
	fmt.Printf("⏱️  Total Duration:     %v\n", duration.Round(time.Millisecond))
	fmt.Printf("⚡ Throughput:         %.2f req/sec\n", rps)
	fmt.Printf("✅ Success (2xx):       %d\n", status2xx)
	fmt.Printf("🛑 Rate Limited (429):  %d\n", status429)
	fmt.Printf("❌ Server Error (5xx):  %d\n", status5xx)
	fmt.Printf("⚠️  Other / Connection: %d\n", otherErr)
	fmt.Println("====================================================")
}
