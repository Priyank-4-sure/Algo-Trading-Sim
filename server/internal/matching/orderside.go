package matching

// orderside.go — Price ordering utilities for the HFT LOB
//
// The pulled version used a TreeSet (github.com/hashicorp/go-set) with float64 prices.
// The HFT architecture (lob.go) uses a sorted []int slice of price indices with a
// direct-mapped array for O(1) access. This file provides the comparison helpers
// and BestPrice helpers that work WITH the lob.go OrderSide — keeping the pull's
// intent (sorted price levels, bid/ask direction) while using the HFT structures.

// BestAskPrice returns the lowest ask price index or 0 if no asks.
func BestAskPrice(os *OrderSide) (int, bool) {
	if len(os.Prices) == 0 {
		return 0, false
	}
	// Asks are sorted ascending (lowest first) — best is index 0
	return os.Prices[0], true
}

// BestBidPrice returns the highest bid price index or 0 if no bids.
func BestBidPrice(os *OrderSide) (int, bool) {
	if len(os.Prices) == 0 {
		return 0, false
	}
	// Bids are sorted descending (highest first) — best is index 0
	return os.Prices[0], true
}

// BestPrice returns the best price index for either side.
// For asks: lowest price. For bids: highest price.
func BestPrice(os *OrderSide) (int, bool) {
	if os.IsBid {
		return BestBidPrice(os)
	}
	return BestAskPrice(os)
}

// NextAskPrice returns the next ask price index above the given one.
func NextAskPrice(os *OrderSide, above int) (int, bool) {
	for _, p := range os.Prices {
		if p > above {
			return p, true
		}
	}
	return 0, false
}

// NextBidPrice returns the next bid price index below the given one.
func NextBidPrice(os *OrderSide, below int) (int, bool) {
	for _, p := range os.Prices {
		if p < below {
			return p, true
		}
	}
	return 0, false
}
