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
func NewProfileFactory(assetClass string) AssetProfile {
	var p AssetProfile

	switch assetClass {
	case "CRYPTO":
		p.MinDriftShift, p.MaxDriftShift = 10*time.Second, 60*time.Second
		p.MinSigmaShift, p.MaxSigmaShift = 2*time.Second, 10*time.Second

		baseDrift := [4][4]float64{
			{0.50, 0.20, 0.20, 0.10}, {0.20, 0.50, 0.20, 0.10}, 
			{0.15, 0.15, 0.50, 0.20}, {0.10, 0.10, 0.20, 0.60},
		}
		baseVol := [4][4]float64{
			{0.50, 0.40, 0.10, 0.00}, {0.20, 0.50, 0.25, 0.05}, 
			{0.05, 0.15, 0.70, 0.10}, {0.05, 0.10, 0.35, 0.50},
		}
		
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.05)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.05)

		baseDriftBounds := [4][2]float64{{-3.0, -0.5}, {0.8, 2.5}, {-0.1, 0.3}, {-0.05, 0.05}}
		baseSigmaBounds := [4][2]float64{{0.8, 2.0}, {0.4, 0.8}, {0.15, 0.35}, {0.05, 0.10}}
		
		p.DriftBounds = applyBoundsJitter(baseDriftBounds, 0.2, false)
		p.SigmaBounds = applyBoundsJitter(baseSigmaBounds, 0.1, true)

	case "MEME_COIN":
		// Extremely volatile, chaotic shifts. High chance of pump and dump.
		p.MinDriftShift, p.MaxDriftShift = 5*time.Second, 30*time.Second
		p.MinSigmaShift, p.MaxSigmaShift = 1*time.Second, 5*time.Second

		baseDrift := [4][4]float64{
			{0.40, 0.10, 0.30, 0.20}, // Bear often dumps into Flat
			{0.30, 0.50, 0.10, 0.10}, // Bull has high chance of instantly becoming Bear (Dump)
			{0.10, 0.30, 0.40, 0.20}, // Normal often pumps
			{0.10, 0.20, 0.20, 0.50}, 
		}
		baseVol := [4][4]float64{
			{0.60, 0.30, 0.10, 0.00}, {0.30, 0.40, 0.20, 0.10}, 
			{0.10, 0.20, 0.50, 0.20}, {0.05, 0.15, 0.30, 0.50},
		}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.08)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.08)

		baseDriftBounds := [4][2]float64{{-5.0, -1.5}, {2.0, 6.0}, {-0.5, 0.5}, {-0.1, 0.1}}
		baseSigmaBounds := [4][2]float64{{1.5, 4.0}, {0.8, 1.5}, {0.4, 0.8}, {0.1, 0.3}}
		p.DriftBounds = applyBoundsJitter(baseDriftBounds, 0.5, false)
		p.SigmaBounds = applyBoundsJitter(baseSigmaBounds, 0.2, true)

	case "PENNY_STOCK":
		// Spends forever flat, then randomly spikes massively
		p.MinDriftShift, p.MaxDriftShift = 30*time.Second, 120*time.Second
		p.MinSigmaShift, p.MaxSigmaShift = 10*time.Second, 30*time.Second

		baseDrift := [4][4]float64{
			{0.60, 0.05, 0.10, 0.25}, {0.30, 0.40, 0.20, 0.10}, 
			{0.10, 0.10, 0.60, 0.20}, {0.05, 0.10, 0.05, 0.80}, // 80% chance to stay dead flat
		}
		baseVol := [4][4]float64{
			{0.30, 0.40, 0.20, 0.10}, {0.10, 0.40, 0.30, 0.20}, 
			{0.05, 0.10, 0.60, 0.25}, {0.01, 0.04, 0.15, 0.80},
		}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.05)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.05)

		baseDriftBounds := [4][2]float64{{-2.0, -0.5}, {1.5, 5.0}, {-0.2, 0.1}, {-0.02, 0.02}}
		baseSigmaBounds := [4][2]float64{{1.0, 3.0}, {0.5, 1.0}, {0.1, 0.3}, {0.02, 0.05}}
		p.DriftBounds = applyBoundsJitter(baseDriftBounds, 0.3, false)
		p.SigmaBounds = applyBoundsJitter(baseSigmaBounds, 0.1, true)

	case "INDEX_FUND":
		// (e.g., S&P 500) Extremely stable, slow moving, low volatility
		p.MinDriftShift, p.MaxDriftShift = 120*time.Second, 600*time.Second
		p.MinSigmaShift, p.MaxSigmaShift = 30*time.Second, 120*time.Second

		baseDrift := [4][4]float64{
			{0.70, 0.05, 0.20, 0.05}, {0.05, 0.70, 0.20, 0.05}, 
			{0.05, 0.10, 0.75, 0.10}, {0.02, 0.08, 0.15, 0.75}, 
		}
		baseVol := [4][4]float64{
			{0.20, 0.60, 0.20, 0.00}, {0.10, 0.50, 0.40, 0.00},
			{0.01, 0.04, 0.85, 0.10}, {0.01, 0.02, 0.10, 0.87}, 
		}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.01) // Very tiny jitter, highly uniform
		p.VolTransitions = applyMatrixJitter(baseVol, 0.01)

		baseDriftBounds := [4][2]float64{{-0.3, -0.05}, {0.05, 0.3}, {-0.02, 0.08}, {-0.01, 0.01}}
		baseSigmaBounds := [4][2]float64{{0.2, 0.4}, {0.1, 0.2}, {0.04, 0.08}, {0.01, 0.03}}
		p.DriftBounds = applyBoundsJitter(baseDriftBounds, 0.02, false)
		p.SigmaBounds = applyBoundsJitter(baseSigmaBounds, 0.01, true)

	default: // "BLUE_CHIP" acts as standard fallback
		p.MinDriftShift, p.MaxDriftShift = 60*time.Second, 300*time.Second
		p.MinSigmaShift, p.MaxSigmaShift = 15*time.Second, 45*time.Second

		baseDrift := [4][4]float64{
			{0.80, 0.05, 0.10, 0.05}, {0.05, 0.80, 0.10, 0.05}, 
			{0.05, 0.05, 0.80, 0.10}, {0.05, 0.05, 0.10, 0.80}, 
		}
		baseVol := [4][4]float64{
			{0.20, 0.50, 0.30, 0.00}, {0.10, 0.40, 0.40, 0.10},
			{0.02, 0.08, 0.80, 0.10}, {0.01, 0.04, 0.15, 0.80}, 
		}
		p.DriftTransitions = applyMatrixJitter(baseDrift, 0.02)
		p.VolTransitions = applyMatrixJitter(baseVol, 0.02)

		baseDriftBounds := [4][2]float64{{-1.0, -0.2}, {0.3, 0.8}, {0.0, 0.1}, {-0.01, 0.02}}
		baseSigmaBounds := [4][2]float64{{0.4, 0.8}, {0.2, 0.4}, {0.08, 0.2}, {0.02, 0.06}}
		p.DriftBounds = applyBoundsJitter(baseDriftBounds, 0.05, false)
		p.SigmaBounds = applyBoundsJitter(baseSigmaBounds, 0.02, true)
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