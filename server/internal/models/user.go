package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents an entity interacting with the matching engine
type User struct {
	ID          string      `gorm:"type:uuid;primaryKey" json:"id"`
	FirebaseUID string      `gorm:"uniqueIndex;not null" json:"firebase_uid"`
	Username    string      `gorm:"not null" json:"username"`
	Portfolios  []Portfolio `gorm:"foreignKey:UserID" json:"portfolios"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// Portfolio tracks asset balances held by a specific User
type Portfolio struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    string    `gorm:"type:uuid;index;not null" json:"user_id"`
	Asset     string    `gorm:"not null" json:"asset"` // e.g., "USD", "BTC"
	Balance   float64   `gorm:"type:numeric(24,8)" json:"balance"` // Using native Postgres numeric sizing
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate hook auto-injects UUIDs
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	return
}

func (p *Portfolio) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	return
}
