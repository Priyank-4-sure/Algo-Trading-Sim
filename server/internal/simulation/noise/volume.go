package noise

import (
	"math"
	"math/rand"
)

// GenerateOrderSize determines the quantity of shares for a synthetic order.
// 'rng' is a localized random generator to prevent global seed locks.
// 'alpha' determines the fatness of the tail (e.g., 1.16).
// 'minSize' is the smallest possible order (e.g., 1.0).
func GenerateOrderSize(rng *rand.Rand, alpha float64, minSize float64) int64 {
	// 1. Generate a uniform random number U between [0.0, 1.0)
	u := rng.Float64()

	// Safety check: If U approaches exactly 1.0, the calculation approaches infinity.
	// We clamp it slightly to prevent math.Inf panics when simulating massive whales.
	if u > 0.999999 {
		u = 0.999999
	}

	// 2. Inverse Transform Sampling for Pareto distribution
	// Formula: x = x_m / (1 - U)^(1/alpha)
	rawSize := minSize / math.Pow(1.0-u, 1.0/alpha)

	// 3. IMPROVEMENT: Discretize the continuous volume to a whole number
	finalSize := math.Round(rawSize)

	// 4. Cast safely to int64 for the matching engine
	return int64(finalSize)
}