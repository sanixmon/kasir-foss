package handler

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// InitStructuredLogger configures slog with a JSON output handler
func InitStructuredLogger() {
	jsonHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	logger := slog.New(jsonHandler)
	slog.SetDefault(logger)
}

type structuredResponseWriter struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int
}

func (w *structuredResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *structuredResponseWriter) Write(b []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytesWritten += n
	return n, err
}

func (w *structuredResponseWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (w *structuredResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// StructuredLoggerMiddleware logs each incoming HTTP request with JSON format and contextual attributes
func StructuredLoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := middleware.GetReqID(r.Context())
		if reqID == "" {
			reqID = r.Header.Get("X-Request-ID")
		}

		outletID := r.Header.Get("X-Outlet-ID")
		if outletID == "" {
			outletID = r.URL.Query().Get("outlet_id")
		}

		sw := &structuredResponseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(sw, r)

		duration := time.Since(start)

		slog.Info("http_request",
			slog.String("request_id", reqID),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("remote_addr", r.RemoteAddr),
			slog.Int("status", sw.statusCode),
			slog.Int("bytes", sw.bytesWritten),
			slog.Float64("duration_ms", float64(duration.Microseconds())/1000.0),
			slog.String("outlet_id", outletID),
			slog.String("user_agent", r.UserAgent()),
		)
	})
}
