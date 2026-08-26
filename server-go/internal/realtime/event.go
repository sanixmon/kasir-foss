package realtime

type Event struct {
	Type     string      `json:"type"`
	OutletID string      `json:"outletId"`
	Payload  interface{} `json:"payload"`
}

type Client struct {
	OutletID string
	Send     chan Event
}
