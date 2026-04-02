package gbm

import (
	"math/rand"
	"time"
)

type DriftState int
const (Bear DriftState = 0; Bull DriftState = 1; NormalDrift DriftState = 2; Flat DriftState = 3)

type VolState int
const (Panic VolState = 0; Elevated VolState = 1; NormalVol VolState = 2; Quiet VolState = 3)

type AssetProfile struct {
	MinDriftShift time.Duration
	MaxDriftShift time.Duration
	MinSigmaShift time.Duration
	MaxSigmaShift time.Duration

	DriftTransitions [4][4]float64
	VolTransitions   [4][4]float64
	DriftBounds      [4][2]float64
	SigmaBounds      [4][2]float64
}

// NewProfileFactory generates a unique profile based on the asset class
// NewProfileFactory generates a unique profile based on the asset class
func NewProfileFactory(assetClass string) AssetProfile {
	var p AssetProfile

	// Default regime shift durations for most assets (5 to 15 minutes)
	p.MinDriftShift, p.MaxDriftShift = 5*time.Minute, 15*time.Minute
	p.MinSigmaShift, p.MaxSigmaShift = 3*time.Minute, 10*time.Minute

	switch assetClass {

	case "STABLE_BANK":
		baseDrift := [4][4]float64{{0.60, 0.20, 0.15, 0.05}, {0.15, 0.60, 0.20, 0.05}, {0.10, 0.10, 0.75, 0.05}, {0.05, 0.05, 0.10, 0.80}}
		baseVol := [4][4]float64{{0.30, 0.50, 0.20, 0.00}, {0.10, 0.40, 0.40, 0.10}, {0.05, 0.10, 0.75, 0.10}, {0.05, 0.05, 0.15, 0.75}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.02)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.02)
		// Drift: 5% to 12% normal. Vol: 15% to 22% normal.
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.20, -0.05}, {0.15, 0.30}, {0.05, 0.12}, {-0.02, 0.02}}, 0.02, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.40, 0.60}, {0.25, 0.35}, {0.15, 0.22}, {0.08, 0.12}}, 0.02, true)

	case "TECH_GROWTH":
		baseDrift := [4][4]float64{{0.50, 0.30, 0.15, 0.05}, {0.10, 0.70, 0.15, 0.05}, {0.10, 0.20, 0.65, 0.05}, {0.05, 0.15, 0.20, 0.60}}
		baseVol := [4][4]float64{{0.40, 0.40, 0.20, 0.00}, {0.10, 0.50, 0.30, 0.10}, {0.05, 0.15, 0.70, 0.10}, {0.05, 0.10, 0.25, 0.60}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.03)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.03)
		// Drift: 10% to 25% normal. Vol: 30% to 45% normal.
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.40, -0.10}, {0.25, 0.60}, {0.10, 0.25}, {-0.05, 0.05}}, 0.05, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.60, 0.90}, {0.45, 0.60}, {0.30, 0.45}, {0.15, 0.30}}, 0.05, true)

	case "INDEX_FUND":
		baseDrift := [4][4]float64{{0.70, 0.05, 0.20, 0.05}, {0.05, 0.70, 0.20, 0.05}, {0.05, 0.10, 0.80, 0.05}, {0.02, 0.08, 0.10, 0.80}}
		baseVol := [4][4]float64{{0.20, 0.60, 0.20, 0.00}, {0.10, 0.50, 0.40, 0.00}, {0.01, 0.04, 0.85, 0.10}, {0.01, 0.02, 0.10, 0.87}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.01)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.01)
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.15, -0.05}, {0.10, 0.20}, {0.07, 0.10}, {-0.01, 0.01}}, 0.01, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.30, 0.45}, {0.18, 0.30}, {0.10, 0.18}, {0.05, 0.10}}, 0.01, true)

	case "FOREX_MAJOR":
		baseDrift := [4][4]float64{{0.40, 0.20, 0.30, 0.10}, {0.20, 0.40, 0.30, 0.10}, {0.10, 0.10, 0.70, 0.10}, {0.10, 0.10, 0.20, 0.60}}
		baseVol := [4][4]float64{{0.30, 0.40, 0.30, 0.00}, {0.10, 0.50, 0.40, 0.00}, {0.05, 0.15, 0.60, 0.20}, {0.05, 0.10, 0.20, 0.65}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.02)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.02)
		// Drift is near zero. Volatility is very low (6% to 12%).
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.05, -0.01}, {0.01, 0.05}, {-0.01, 0.01}, {-0.005, 0.005}}, 0.005, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.18, 0.25}, {0.12, 0.18}, {0.06, 0.12}, {0.03, 0.06}}, 0.01, true)

	case "COMMODITY_METAL":
		baseDrift := [4][4]float64{{0.50, 0.10, 0.30, 0.10}, {0.10, 0.50, 0.30, 0.10}, {0.10, 0.15, 0.65, 0.10}, {0.05, 0.05, 0.20, 0.70}}
		baseVol := [4][4]float64{{0.30, 0.40, 0.20, 0.10}, {0.10, 0.50, 0.30, 0.10}, {0.05, 0.15, 0.60, 0.20}, {0.05, 0.10, 0.25, 0.60}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.02)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.02)
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.15, -0.02}, {0.05, 0.20}, {0.02, 0.08}, {-0.01, 0.01}}, 0.02, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.35, 0.50}, {0.25, 0.35}, {0.15, 0.25}, {0.08, 0.15}}, 0.02, true)

	case "COMMODITY_ENERGY":
		baseDrift := [4][4]float64{{0.60, 0.10, 0.20, 0.10}, {0.10, 0.60, 0.20, 0.10}, {0.15, 0.15, 0.60, 0.10}, {0.10, 0.10, 0.20, 0.60}}
		baseVol := [4][4]float64{{0.40, 0.40, 0.10, 0.10}, {0.20, 0.50, 0.20, 0.10}, {0.10, 0.20, 0.50, 0.20}, {0.05, 0.15, 0.30, 0.50}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.04)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.04)
		// Cyclical and shock-prone. High volatility.
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.40, -0.10}, {0.15, 0.45}, {-0.05, 0.05}, {-0.02, 0.02}}, 0.04, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.60, 0.90}, {0.45, 0.60}, {0.30, 0.45}, {0.15, 0.30}}, 0.04, true)

	case "BOND_YIELD":
		baseDrift := [4][4]float64{{0.40, 0.20, 0.30, 0.10}, {0.20, 0.40, 0.30, 0.10}, {0.10, 0.10, 0.70, 0.10}, {0.05, 0.05, 0.10, 0.80}}
		baseVol := [4][4]float64{{0.20, 0.40, 0.30, 0.10}, {0.10, 0.50, 0.30, 0.10}, {0.05, 0.10, 0.70, 0.15}, {0.02, 0.08, 0.10, 0.80}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.01)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.01)
		// Bonds are exceptionally slow and safe. Volatility is tiny (2% to 5%).
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.03, -0.01}, {0.04, 0.08}, {0.02, 0.04}, {0.01, 0.02}}, 0.005, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.10, 0.15}, {0.05, 0.10}, {0.02, 0.05}, {0.005, 0.02}}, 0.005, true)

	case "PENNY_STOCK":
		// Flatlines mostly, random extreme spikes
		baseDrift := [4][4]float64{{0.60, 0.05, 0.10, 0.25}, {0.30, 0.40, 0.20, 0.10}, {0.10, 0.10, 0.60, 0.20}, {0.05, 0.10, 0.05, 0.80}} // 80% chance to stay flat
		baseVol := [4][4]float64{{0.30, 0.40, 0.20, 0.10}, {0.10, 0.40, 0.30, 0.20}, {0.05, 0.10, 0.60, 0.25}, {0.01, 0.04, 0.15, 0.80}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.05)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.05)
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.80, -0.20}, {0.50, 2.00}, {-0.10, 0.10}, {-0.02, 0.02}}, 0.1, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{1.50, 3.00}, {0.80, 1.50}, {0.40, 0.80}, {0.10, 0.40}}, 0.1, true)

	case "CRYPTO_MAJOR":
		baseDrift := [4][4]float64{{0.60, 0.20, 0.10, 0.10}, {0.10, 0.70, 0.10, 0.10}, {0.15, 0.20, 0.50, 0.15}, {0.10, 0.15, 0.25, 0.50}}
		baseVol := [4][4]float64{{0.50, 0.30, 0.10, 0.10}, {0.10, 0.60, 0.20, 0.10}, {0.05, 0.20, 0.60, 0.15}, {0.05, 0.10, 0.35, 0.50}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.05)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.05)
		// Massive swings. 60% to 90% normal vol.
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.80, -0.30}, {0.40, 1.20}, {0.05, 0.20}, {-0.05, 0.05}}, 0.05, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{1.20, 2.00}, {0.90, 1.20}, {0.60, 0.90}, {0.30, 0.60}}, 0.05, true)

	case "MEME_COIN":
		p.MinDriftShift, p.MaxDriftShift = 1*time.Minute, 4*time.Minute // Faster shifts for chaos
		p.MinSigmaShift, p.MaxSigmaShift = 1*time.Minute, 3*time.Minute
		baseDrift := [4][4]float64{{0.50, 0.10, 0.20, 0.20}, {0.40, 0.40, 0.10, 0.10}, {0.10, 0.30, 0.40, 0.20}, {0.10, 0.20, 0.20, 0.50}}
		baseVol := [4][4]float64{{0.60, 0.30, 0.10, 0.00}, {0.30, 0.40, 0.20, 0.10}, {0.10, 0.20, 0.50, 0.20}, {0.05, 0.15, 0.30, 0.50}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.08)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.08)
		// Complete anarchy. Up to 500% drift and 400% volatility.
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-2.50, -0.80}, {1.50, 5.00}, {-0.20, 0.20}, {-0.10, 0.10}}, 0.2, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{2.50, 4.00}, {1.50, 2.50}, {0.80, 1.50}, {0.40, 0.80}}, 0.2, true)

	case "PREMIUM_EQUITY":
		// Extremely stable blue-chip behavior, high institutional ownership
		baseDrift := [4][4]float64{{0.50, 0.20, 0.25, 0.05}, {0.10, 0.60, 0.25, 0.05}, {0.05, 0.10, 0.80, 0.05}, {0.02, 0.08, 0.10, 0.80}}
		baseVol := [4][4]float64{{0.20, 0.50, 0.30, 0.00}, {0.10, 0.60, 0.30, 0.00}, {0.02, 0.08, 0.80, 0.10}, {0.01, 0.04, 0.15, 0.80}}
		
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.02)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.02)
		
		// Drift is relatively slow and steady. Very low crash probability.
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.12, -0.04}, {0.08, 0.18}, {0.04, 0.09}, {-0.01, 0.02}}, 0.01, false)
		
		// Volatility is very compressed (10% to 15% in normal conditions)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.25, 0.35}, {0.15, 0.25}, {0.10, 0.15}, {0.05, 0.10}}, 0.01, true)

	default: // Fallback acts as a standard Mid-Cap equity
		baseDrift := [4][4]float64{{0.60, 0.15, 0.20, 0.05}, {0.15, 0.60, 0.20, 0.05}, {0.10, 0.15, 0.70, 0.05}, {0.05, 0.05, 0.10, 0.80}}
		baseVol := [4][4]float64{{0.30, 0.40, 0.20, 0.10}, {0.10, 0.50, 0.30, 0.10}, {0.05, 0.15, 0.70, 0.10}, {0.05, 0.10, 0.15, 0.70}}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.02)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.02)
		p.DriftBounds = applyBoundsJitter([4][2]float64{{-0.30, -0.10}, {0.20, 0.45}, {0.08, 0.18}, {-0.02, 0.02}}, 0.02, false)
		p.SigmaBounds = applyBoundsJitter([4][2]float64{{0.50, 0.75}, {0.35, 0.50}, {0.20, 0.35}, {0.10, 0.20}}, 0.02, true)
	}

	return p
}

// applyMatrixJitter adds random noise and re-normalizes the row to exactly 1.0
func applyMatrixJitter(base [4][4]float64, maxJitter float64) [4][4]float64 {
	var jittered [4][4]float64
	for i := 0; i < 4; i++ {
		rowSum := 0.0
		for j := 0; j < 4; j++ {
			noise := (rand.Float64() * 2 * maxJitter) - maxJitter
			newVal := base[i][j] + noise
			if newVal < 0.01 { newVal = 0.01 }
			jittered[i][j] = newVal
			rowSum += newVal
		}
		for j := 0; j < 4; j++ {
			jittered[i][j] = jittered[i][j] / rowSum
		}
	}
	return jittered
}

// applyBoundsJitter adds absolute random noise to the min and max bounds safely
func applyBoundsJitter(base [4][2]float64, maxJitter float64, isSigma bool) [4][2]float64 {
	var jittered [4][2]float64
	for i := 0; i < 4; i++ {
		noiseMin := (rand.Float64() * 2 * maxJitter) - maxJitter
		noiseMax := (rand.Float64() * 2 * maxJitter) - maxJitter

		jittered[i][0] = base[i][0] + noiseMin
		jittered[i][1] = base[i][1] + noiseMax

		// CRITICAL: Volatility (\sigma) cannot be <= 0, or math.Pow/math.Sqrt will fail
		if isSigma {
			if jittered[i][0] < 0.01 { jittered[i][0] = 0.01 }
			if jittered[i][1] < 0.02 { jittered[i][1] = 0.02 }
		}

		// Enforce that Min is always strictly less than Max
		if jittered[i][0] >= jittered[i][1] {
			jittered[i][1] = jittered[i][0] + 0.02 // Push the max slightly above the min
		}
	}
	return jittered
}