// Verify Go ticket creation and signing.
// Run with: go run .
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type PanaudiaClaims struct {
	Gain        float64           `json:"gain,omitempty"`
	Attenuation float64           `json:"attenuation,omitempty"`
	Priority    bool              `json:"priority,omitempty"`
	Subspaces   []string          `json:"subspaces,omitempty"`
	Attrs       map[string]string `json:"attrs,omitempty"`
}

type TicketClaims struct {
	jwt.RegisteredClaims
	PreferredUsername string          `json:"preferred_username"`
	Panaudia          *PanaudiaClaims `json:"panaudia,omitempty"`
}

func main() {
	// --- Step 1: Generate keys ---
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		panic(err)
	}
	fmt.Println("Keys generated OK")

	// --- Step 2: Create and sign ticket ---
	jti := uuid.New().String()
	spaceID := "space_df8c7a85-0702-45e9-a626-a1c147eafce9"

	claims := TicketClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:   "test-verify",
			Audience: jwt.ClaimStrings{spaceID},
			ID:       jti,
			IssuedAt: jwt.NewNumericDate(time.Now()),
		},
		PreferredUsername: "TestUser",
		Panaudia: &PanaudiaClaims{
			Gain:        1.5,
			Attenuation: 2.0,
			Priority:    true,
			Subspaces:   []string{"a1b2c3d4-0000-0000-0000-000000000001"},
			Attrs:       map[string]string{"colour": "00aaff"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	token.Header["typ"] = "JWT"
	token.Header["crv"] = "Ed25519"

	ticket, err := token.SignedString(priv)
	if err != nil {
		panic(fmt.Sprintf("SignedString failed: %v", err))
	}
	fmt.Printf("Ticket created OK (%d chars)\n", len(ticket))

	// --- Step 3: Verify ---
	parts := strings.Split(ticket, ".")
	if len(parts) != 3 {
		panic(fmt.Sprintf("Expected 3 parts, got %d", len(parts)))
	}

	// Decode header
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		panic(err)
	}
	var header map[string]interface{}
	json.Unmarshal(headerBytes, &header)

	assertEqual("typ", header["typ"], "JWT")
	assertEqual("alg", header["alg"], "EdDSA")
	assertEqual("crv", header["crv"], "Ed25519")
	fmt.Printf("Header OK: %v\n", header)

	// Decode payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		panic(err)
	}
	var payload map[string]interface{}
	json.Unmarshal(payloadBytes, &payload)

	assertEqual("iss", payload["iss"], "test-verify")
	assertEqual("jti", payload["jti"], jti)
	assertEqual("preferred_username", payload["preferred_username"], "TestUser")

	// aud may be a string or array depending on library
	switch aud := payload["aud"].(type) {
	case string:
		assertEqual("aud", aud, spaceID)
	case []interface{}:
		assertEqual("aud[0]", aud[0], spaceID)
	default:
		panic(fmt.Sprintf("unexpected aud type: %T", payload["aud"]))
	}

	if _, ok := payload["iat"]; !ok {
		panic("missing iat")
	}

	panaudia := payload["panaudia"].(map[string]interface{})
	assertEqualFloat("gain", panaudia["gain"].(float64), 1.5)
	assertEqualFloat("attenuation", panaudia["attenuation"].(float64), 2.0)
	assertEqual("priority", panaudia["priority"], true)
	subspaces := panaudia["subspaces"].([]interface{})
	assertEqual("subspaces[0]", subspaces[0], "a1b2c3d4-0000-0000-0000-000000000001")
	attrs := panaudia["attrs"].(map[string]interface{})
	assertEqual("attrs.colour", attrs["colour"], "00aaff")
	fmt.Println("Payload OK: all claims verified")

	// Verify signature with public key
	parsed, err := jwt.Parse(ticket, func(t *jwt.Token) (interface{}, error) {
		return pub, nil
	}, jwt.WithValidMethods([]string{"EdDSA"}))
	if err != nil {
		panic(fmt.Sprintf("Signature verification failed: %v", err))
	}
	if !parsed.Valid {
		panic("Token not valid")
	}
	fmt.Println("Signature verified OK with public key")

	fmt.Println("\n=== GO: ALL TESTS PASSED ===")
}

func assertEqual(name string, got, want interface{}) {
	if got != want {
		panic(fmt.Sprintf("%s: got %v, want %v", name, got, want))
	}
}

func assertEqualFloat(name string, got, want float64) {
	if got != want {
		panic(fmt.Sprintf("%s: got %v, want %v", name, got, want))
	}
}
