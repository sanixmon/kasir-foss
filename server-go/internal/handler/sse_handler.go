package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

func (h *Handler) HandleStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	// Clear write deadline so the connection doesn't drop after http.Server.WriteTimeout
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{})

	outletID := r.URL.Query().Get("outlet_id")
	if outletID == "" {
		outletID = "all"
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	client := h.Hub.Register(outletID)
	defer h.Hub.Unregister(client)

	// Send initial connection confirmation comment
	_, _ = fmt.Fprintf(w, ": connected to outlet %s\n\n", outletID)
	flusher.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case ev, ok := <-client.Send:
			if !ok {
				return
			}
			data, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, string(data)); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
