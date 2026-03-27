package models

import "encoding/json"

// WSMessage is the standard WebSocket envelope for all client-server communication.
// Every message over the socket is wrapped in this struct.
type WSMessage struct {
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}
