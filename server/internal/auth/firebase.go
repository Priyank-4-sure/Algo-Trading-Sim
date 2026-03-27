package auth

import (
	"context"
	"fmt"
	"log"

	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var firebaseAuthClient *firebaseAuth.Client

// InitFirebase initializes the Firebase Admin SDK using the provided JSON credentials file.
func InitFirebase() error {
	opt := option.WithCredentialsFile("firebase-adminsdk.json")
	app, err := firebase.NewApp(context.Background(), nil, opt)
	if err != nil {
		return fmt.Errorf("error initializing firebase app: %v", err)
	}

	client, err := app.Auth(context.Background())
	if err != nil {
		return fmt.Errorf("error getting firebase auth client: %v", err)
	}

	firebaseAuthClient = client
	log.Println("Firebase Admin SDK initialized successfully.")
	return nil
}

// VerifyFirebaseIDToken verifies the ID token from the frontend and returns the Firebase Auth Token containing claims (like UID, email).
func VerifyFirebaseIDToken(ctx context.Context, idToken string) (*firebaseAuth.Token, error) {
	if firebaseAuthClient == nil {
		return nil, fmt.Errorf("firebase auth client is not initialized (call InitFirebase first)")
	}

	// Verify the token securely with Google
	token, err := firebaseAuthClient.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("error verifying firebase id token: %v", err)
	}

	return token, nil
}
