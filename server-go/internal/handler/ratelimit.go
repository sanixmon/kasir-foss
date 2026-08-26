package handler

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type clientVisitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type IPRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*clientVisitor
	rate     rate.Limit
	burst    int
}

func NewIPRateLimiter(r rate.Limit, b int, cleanupInterval time.Duration) *IPRateLimiter {
	limiter := &IPRateLimiter{
		visitors: make(map[string]*clientVisitor),
		rate:     r,
		burst:    b,
	}

	if cleanupInterval > 0 {
		go func() {
			for range time.Tick(cleanupInterval) {
				limiter.cleanupStaleVisitors(cleanupInterval * 2)
			}
		}()
	}

	return limiter
}

func (i *IPRateLimiter) cleanupStaleVisitors(ttl time.Duration) {
	i.mu.Lock()
	defer i.mu.Unlock()

	now := time.Now()
	for ip, v := range i.visitors {
		if now.Sub(v.lastSeen) > ttl {
			delete(i.visitors, ip)
		}
	}
}

func (i *IPRateLimiter) getVisitor(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	v, exists := i.visitors[ip]
	if !exists {
		limiter := rate.NewLimiter(i.rate, i.burst)
		i.visitors[ip] = &clientVisitor{
			limiter:  limiter,
			lastSeen: time.Now(),
		}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

func extractClientIP(r *http.Request) string {
	// Check X-Forwarded-For
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}

	// Check X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fallback to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// Middleware returns a Chi-compatible rate limiting middleware for this limiter
func (i *IPRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractClientIP(r)
		limiter := i.getVisitor(ip)

		if !limiter.Allow() {
			w.Header().Set("Retry-After", "5")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"Too many requests. Please slow down.","code":"RATE_LIMIT_EXCEEDED"}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}
