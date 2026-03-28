package matching

import (
	"log"
	"time"

	"github.com/GC-OpenSoft-2026/Algorithmic-Trading-Simulator/internal/models"
)

type OrderBook struct {
	Bids *OrderSide
	Asks *OrderSide
}

type Engine struct {
	Books map[string] *OrderBook
	OrderIndex map[string] *OrderNode
	OrderStream <-chan models.Order
	TradeStream chan<- models.TradeMessage
}

func (e *Engine) Start(){
	log.Println("Matching Engine Started...")
	for order:= range e.OrderStream{
		e.processOrder(order)
	}
}

func (e *Engine) processOrder(order models.Order) {
    if order.Timestamp == 0 {
        order.Timestamp = time.Now().UnixNano()
    }
    book := e.getBook(order.Symbol)
    switch order.Type {
    case models.Limit:
        e.matchLimitOrder(order, book)
    case models.Market:
        e.matchMarketOrder(order, book)
    case models.Cancel:
        e.cancelOrder(order, book)
    }
}

func NewEngine(orderStream <-chan models.Order, tradeStream chan<- models.TradeMessage) *Engine {
    return &Engine{
        Books:       make(map[string]*OrderBook),
        OrderIndex:  make(map[string]*OrderNode),
        OrderStream: orderStream,
        TradeStream: tradeStream,
    }
}


func (e *Engine) getBook(symbol string) *OrderBook{
	book, exists := e.Books[symbol]
	if !exists {
		book = &OrderBook{
			Bids: NewOrderSide(true),
			Asks: NewOrderSide(false),
		}
		e.Books[symbol]=book
		log.Printf("Created new Order Book for symbol: %s", symbol)
	}
	return book
}

func (e *Engine) matchLimitOrder(order models.Order, book *OrderBook) {
    switch order.Side {
	case models.Buy:
        remaining := e.match(order,book.Asks)
        if remaining > 0 {
            order.Quantity = remaining
            book.Bids.Add(order, e.OrderIndex)
        }

    case models.Sell:
        remaining := e.match(order, book.Bids)
        if remaining > 0 {
            order.Quantity = remaining
            book.Asks.Add(order, e.OrderIndex)
        }
    }
}

func (e *Engine) match(taker models.Order, side *OrderSide) int64 {
    remaining := taker.Quantity

    for remaining > 0 {
        bestPrice, ok := side.BestPrice()
        if !ok {
            break
        }

        if taker.Type == models.Limit {
            if taker.Side == models.Buy && bestPrice > taker.Price {
                break
            }
            if taker.Side == models.Sell && bestPrice < taker.Price {
                break
            }
        }
        queue := side.GetQueue(bestPrice)

        for node := queue.Front(); node != nil && remaining > 0; node = queue.Front() {
            maker := &node.Order

            tradeQty := min(remaining, maker.Quantity)

            e.TradeStream <- models.TradeMessage{
                Symbol:       taker.Symbol,
                MakerOrderID: maker.ID,
                TakerOrderID: taker.ID,
                Price:        bestPrice,
                Quantity:     tradeQty,
                Timestamp:    time.Now().UnixNano(),
            }

            remaining -= tradeQty
            maker.Quantity -= tradeQty

            if maker.Quantity == 0 {
                queue.PopFront()
                delete(e.OrderIndex, maker.ID)
            }
        }
        if queue.Empty() {
            side.RemovePriceLevel(bestPrice)
        }
    }

    return remaining
}

func (e *Engine) matchMarketOrder(order models.Order, book *OrderBook) {
    switch order.Side {
	case models.Buy:
        remaining := e.match(order, book.Asks)
        if remaining > 0 {
            log.Printf("Market BUY not fully filled (%d remaining)", remaining)
        }
    case models.Sell:
        remaining := e.match(order, book.Bids)
        if remaining > 0 {
            log.Printf("Market SELL not fully filled (%d remaining)", remaining)
        }
    }
}

func (e *Engine) cancelOrder(order models.Order, book *OrderBook) {
	node,exists:=e.OrderIndex[order.ID]
	if !exists{
		return
	}
	side:=book.Asks
	if node.Order.Side==models.Buy {
		side=book.Bids
	}
	price:=node.Order.Price
	queue:=side.GetQueue(price)
	if queue == nil {
    	delete(e.OrderIndex, order.ID)
    	return
	}
	queue.Remove(node)
	delete(e.OrderIndex, order.ID)
	if queue.Empty(){
    	side.RemovePriceLevel(price)
	}
	log.Printf("Cancelled Order: %s", order.ID)
}

func min(a, b int64) int64 {
    if a < b {
        return a
    }
    return b
}

// time complexities

// for adding order
// O(1)      → if price level already exists
// O(log P)  → if new price level is inserted (TreeSet)

// for removing order (cancel order)-> O(1)

// for matching orders -> O(K + L log P)
// where K=number of trades executed,p=number of price levels,L=number of price levels traversed