// Create and sign a Panaudia ticket with Go.
// Run with: go run .
package main

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
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
	// Load private key from PEM
	keyData, err := os.ReadFile("private.pem")
	if err != nil {
		panic(err)
	}
	block, _ := pem.Decode(keyData)
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		panic(err)
	}
	privateKey := parsed.(ed25519.PrivateKey)

	claims := TicketClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:   "my-app",
			Audience: jwt.ClaimStrings{"space_df8c7a85-0702-45e9-a626-a1c147eafce9"},
			ID:       uuid.New().String(),
			IssuedAt: jwt.NewNumericDate(time.Now()),
		},
		PreferredUsername: "Paul",
		Panaudia: &PanaudiaClaims{
			Gain:     1.5,
			Priority: true,
			Attrs:    map[string]string{"colour": "00aaff"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	token.Header["typ"] = "JWT"
	token.Header["crv"] = "Ed25519"

	ticket, err := token.SignedString(privateKey)
	if err != nil {
		panic(err)
	}
	fmt.Println(ticket)
}
